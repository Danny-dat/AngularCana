import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';

import { FriendRequest, FriendPublicProfile } from '../../../models/social.models';
import { ChatService, chatIdFor } from '../../../services/chat.services';
import { FriendsService } from '../../../services/friends.services';
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

  // Subscriptions/Listener zum Aufräumen
  private subs: Array<() => void> = [];
  private unlisten: (() => void) | null = null;

  // Aktueller Benutzer
  user = signal<{ uid: string; email?: string; displayName?: string | null }>({ uid: '' });

  // Tabs
  activeTab = signal<'code' | 'add' | 'requests' | 'blocked'>('code');

  // Zustände
  friendCodeInput = signal('');
  incoming = signal<FriendRequest[]>([]);
  list = signal<FriendPublicProfile[]>([]);
  blocked = signal<FriendPublicProfile[]>([]);

  // Teilen/Hilfe
  shareMenuOpen = signal(false);
  shareHelpOpen = signal(false);
  toggleShareMenu = () => this.shareMenuOpen.set(!this.shareMenuOpen());
  toggleShareHelp = () => this.shareHelpOpen.set(!this.shareHelpOpen());
  copied = signal(false); // optionales UI-Feedback
  // QR-Overlay
  qrOpen = signal(false);
  qrDataUrl = signal<string | null>(null);

  // Online-Status
  onlineIds = signal<Set<string>>(new Set());
  isOnline = (id: string) => this.onlineIds().has(id);
  isBlocked = (id: string) => this.blocked().some((b) => b.id === id);

  // Chat
  showChat = signal(false);
  partner = signal<FriendPublicProfile | null>(null);
  messages = signal<any[]>([]);
  chatInput = signal('');

  constructor() {
    // Auf Login/Logout reagieren und Streams (re)initialisieren
    onAuthStateChanged(this.auth, (u: User | null) => {
      // alte Listener beenden
      this.subs.forEach((fn) => fn?.());
      this.subs = [];
      this.unlisten?.();
      this.unlisten = null;

      if (!u) {
        // ausgeloggt → State leeren
        this.user.set({ uid: '' });
        this.incoming.set([]);
        this.list.set([]);
        this.blocked.set([]);
        this.onlineIds.set(new Set());
        this.showChat.set(false);
        this.partner.set(null);
        this.messages.set([]);
        return;
      }

      // eingeloggter User
      this.user.set({
        uid: u.uid,
        email: u.email ?? undefined,
        displayName: u.displayName ?? null,
      });

      const myUid = u.uid;

      // 1) Offene Anfragen
      const offIncoming = this.friends.listenIncoming(myUid, (reqs) => this.incoming.set(reqs));
      this.subs.push(offIncoming);

      // 2) Freundeliste (+ Presence falls vorhanden)
      const offFriends = this.friends.listenFriends(myUid, (fr) => {
        this.list.set(fr);

        // Presence (nur wenn Service sie anbietet)
        const ids = fr.map((x) => x.id);
        const anyFriends = this.friends as any;
        if (typeof anyFriends.listenPresence === 'function') {
          const offPresence = anyFriends.listenPresence(ids, (online: string[]) => {
            this.onlineIds.set(new Set(online));
          });
          this.subs.push(offPresence);
        } else {
          this.onlineIds.set(new Set());
        }
      });
      this.subs.push(offFriends);

      // 3) Blockierte (Service liefert aktuell string[] → zu minimalen Profilen mappen)
      const offBlocked = this.friends.listenBlocked(myUid, (ids: string[]) => {
        const blockedProfiles: FriendPublicProfile[] = ids.map((id) => ({
          id,
          label: id.slice(0, 6) + '…',
          displayName: null,
          username: null,
          photoURL: null,
          lastLocation: null,
          _action: 'unblock',
        }));
        this.blocked.set(blockedProfiles);
      });
      this.subs.push(offBlocked);
    });
  }

  // Anzeige-Code (UID)
  get myCode() {
    return this.user().uid || '…';
  }

  // hübscher gruppiert (z. B. ABCD-EFGH-…); wird nur für die Anzeige verwendet
  get myCodeGrouped() {
    const raw = this.myCode.replace(/\s+/g, '');
    return raw.replace(/(.{4})/g, '$1 ').trim();
  }

  // -------- Teilen / Code --------
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
      await navigator.share?.({
        title: 'CannaTrack',
        text: `Mein CannaTrack Freundschaftscode: ${this.myCode}`,
      });
    } catch {
      await this.shareCopy();
    }
    this.shareMenuOpen.set(false);
  }

  async shareQR() {
    const text = this.myCode;
    try {
      const url = await QRCode.toDataURL(text, {
        width: 256,
        margin: 1,
        color: { dark: '#000000', light: '#00000000' }, // transparenter Hintergrund
      });
      this.qrDataUrl.set(url);
      this.qrOpen.set(true);
    } catch (e) {
      console.error(e);
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

  // -------- Freunde / Requests --------
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

  unblockDirect(friend: FriendPublicProfile) {
    if (this.user().uid) this.friends.unblock(this.user().uid, friend.id);
  }

  // -------- Chat --------
  openChat(friend: FriendPublicProfile) {
    if (!this.user().uid) return;
    this.partner.set(friend);
    const cid = chatIdFor(this.user().uid, friend.id);
    this.chat.ensureChatExists(this.user().uid, friend.id);

    this.unlisten?.();
    this.unlisten = this.chat.listenMessages(cid, (msgs) => {
      this.messages.set(msgs);
      // auto-scroll
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

  // -------- Lifecycle --------
  ngOnDestroy() {
    this.unlisten?.();
    this.subs.forEach((fn) => fn?.());
    this.subs = [];
  }
}
