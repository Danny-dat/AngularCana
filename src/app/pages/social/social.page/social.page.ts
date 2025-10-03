import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';

import { FriendRequest, FriendPublicProfile } from '../../../models/social.models';
import { ChatService, chatIdFor } from '../../../services/chat.services';
import { FriendsService } from '../../../services/friends.services';
import { PresenceService } from '../../../services/presence.service';
import { ChatOverlayComponent } from '../chat-overlay.component/chat-overlay.component';
import QRCode from 'qrcode';

@Component({
  standalone: true,
  selector: 'app-social-page',
  imports: [CommonModule, FormsModule, ChatOverlayComponent],
  templateUrl: './social.page.html',
  styleUrls: ['./social.page.css'],
})
export class SocialPage implements OnDestroy {
  // Services
  private friends = inject(FriendsService);
  private chat = inject(ChatService);
  private auth = inject(Auth);
  private presence = inject(PresenceService); // nur zum Lesen (listen), Heartbeat läuft global

  // Subscriptions/Listener
  private subs: Array<() => void> = [];
  private unlisten: (() => void) | null = null;

  // User
  user = signal<{ uid: string; email?: string; displayName?: string | null }>({ uid: '' });

  // Tabs
  activeTab = signal<'code' | 'add' | 'requests' | 'blocked'>('code');

  // State
  friendCodeInput = signal('');
  incoming = signal<FriendRequest[]>([]);
  list = signal<FriendPublicProfile[]>([]);
  blockedProfiles = signal<FriendPublicProfile[]>([]);

  // Share/QR
  shareMenuOpen = signal(false);
  shareHelpOpen = signal(false);
  toggleShareMenu = () => this.shareMenuOpen.set(!this.shareMenuOpen());
  toggleShareHelp = () => this.shareHelpOpen.set(!this.shareHelpOpen());
  copied = signal(false);
  qrOpen = signal(false);
  qrDataUrl = signal<string | null>(null);

  // Presence (nur Anzeige)
  onlineIds = signal<Set<string>>(new Set());
  isOnline = (id: string) => this.onlineIds().has(id);

  // Chat
  showChat = signal(false);
  partner = signal<FriendPublicProfile | null>(null);
  messages = signal<any[]>([]);
  chatInput = signal('');

  constructor() {
    onAuthStateChanged(this.auth, (u: User | null) => {
      // bestehende Listener sauber beenden
      this.subs.forEach((fn) => fn?.());
      this.subs = [];
      this.unlisten?.();
      this.unlisten = null;

      if (!u) {
        // ausgeloggt → State zurücksetzen
        this.user.set({ uid: '' });
        this.incoming.set([]);
        this.list.set([]);
        this.blockedProfiles.set([]);
        this.onlineIds.set(new Set());
        this.showChat.set(false);
        this.partner.set(null);
        this.messages.set([]);
        return;
      }

      // eingeloggter Nutzer
      this.user.set({
        uid: u.uid,
        email: u.email ?? undefined,
        displayName: u.displayName ?? null,
      });

      const myUid = u.uid;

      // 1) Offene Anfragen
      const offIncoming = this.friends.listenIncoming(myUid, (reqs) => this.incoming.set(reqs));
      this.subs.push(offIncoming);

      // 2) Freunde + Presence (nur lesen)
      const offFriends = this.friends.listenFriends(myUid, (friends) => {
        this.list.set(friends);

        const ids = friends.map((x) => x.id);
        const offPresence = this.presence.listen(ids, (online: string[]) => {
          this.onlineIds.set(new Set(online));
        });
        this.subs.push(offPresence);
      });
      this.subs.push(offFriends);

      // 3) Blockierte (mit Profilen)
      const offBlocked = this.friends.listenBlockedProfiles(myUid, (profiles) => {
        this.blockedProfiles.set(profiles);
      });
      this.subs.push(offBlocked);
    });
  }

  // Anzeige-Code
  get myCode() { return this.user().uid || '…'; }
  get myCodeGrouped() { return this.myCode.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim(); }

  // Teilen
  async shareCopy(evt?: Event) {
    evt?.stopPropagation();
    try {
      await navigator.clipboard.writeText(this.myCode);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    } catch {
      prompt('Code zum Kopieren:', this.myCode);
    }
    this.shareMenuOpen.set(false);
  }

  async shareNative() {
    try {
      await navigator.share?.({ title: 'CannaTrack', text: `Mein CannaTrack Freundschaftscode: ${this.myCode}` });
    } catch {
      await this.shareCopy();
    }
    this.shareMenuOpen.set(false);
  }

  async shareQR() {
    try {
      const url = await QRCode.toDataURL(this.myCode, {
        width: 256,
        margin: 1,
        color: { dark: '#000000', light: '#00000000' },
      });
      this.qrDataUrl.set(url);
      this.qrOpen.set(true);
    } catch {
      alert('QR-Code konnte nicht erzeugt werden.');
    }
    this.shareMenuOpen.set(false);
  }

  closeQR() {
    this.qrOpen.set(false);
    this.qrDataUrl.set(null);
  }

  downloadQR() {
    const url = this.qrDataUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `cannatrack-code-${this.myCode}.png`;
    a.click();
  }

  // Requests/Friends Actions
  sendRequest() {
    const toUid = this.friendCodeInput().trim();
    if (!toUid || !this.user().uid) return;
    this.friends.sendFriendRequest({
      fromUid: this.user().uid,
      fromEmail: this.user().email ?? null,
      fromDisplayName: this.user().displayName ?? this.user().email ?? null,
      toUid,
    });
    this.friendCodeInput.set('');
  }

  accept(req: FriendRequest) {
    if (this.user().uid) this.friends.accept(this.user().uid, req);
  }

  decline(req: FriendRequest) {
    if (this.user().uid) this.friends.decline(this.user().uid, req);
  }

  handleAction(friend: FriendPublicProfile) {
    if (!this.user().uid) return;
    switch (friend._action) {
      case 'remove':
        this.friends.remove(this.user().uid, friend.id);
        break;
      case 'block':
        this.friends.block(this.user().uid, friend.id);
        break;
      case 'unblock':
        this.friends.unblock(this.user().uid, friend.id);
        break;
    }
    friend._action = '';
  }

  // Blockierte-Tab Buttons
  unblockDirectProfile(p: FriendPublicProfile) {
    if (this.user().uid) this.friends.unblock(this.user().uid, p.id);
  }

  deleteBlockedProfile(p: FriendPublicProfile) {
    if (this.user().uid) this.friends.deleteBlocked(this.user().uid, p.id);
  }

  // Chat
  openChat(friend: FriendPublicProfile) {
    if (!this.user().uid) return;
    this.partner.set(friend);
    const cid = chatIdFor(this.user().uid, friend.id);
    this.chat.ensureChatExists(this.user().uid, friend.id);

    this.unlisten?.();
    this.unlisten = this.chat.listenMessages(cid, (msgs) => {
      this.messages.set(msgs);
      setTimeout(() => {
        const box = document.getElementById('chatMessages');
        if (box) box.scrollTop = box.scrollHeight;
      });
    });

    this.showChat.set(true);
  }

  async sendMsg() {
    const txt = this.chatInput().trim();
    const p = this.partner();
    if (!txt || !p || !this.user().uid) return;
    await this.chat.send({ fromUid: this.user().uid, toUid: p.id, text: txt });
    this.chatInput.set('');
  }

  closeChat() {
    this.unlisten?.();
    this.unlisten = null;
    this.showChat.set(false);
    this.partner.set(null);
    this.messages.set([]);
  }

  // Cleanup
  ngOnDestroy() {
    this.unlisten?.();
    this.subs.forEach((fn) => fn?.());
    this.subs = [];
    // KEIN presence.stop() mehr hier – Heartbeat wird global verwaltet
  }
}
