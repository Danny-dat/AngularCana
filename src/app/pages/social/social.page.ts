import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { Firestore, addDoc, collection, serverTimestamp } from '@angular/fire/firestore';

import { FriendRequest, FriendPublicProfile } from '../../models/social.models';
import { ChatService } from '../../services/chat.services';
import { FriendsService } from '../../services/friends.services';
import { PresenceService } from '../../services/presence.service';
import { ChatOverlayComponent } from '../../feature/chat-overlay/chat-overlay.component';

type ReportEvent = { userId: string; messageId?: string | null; text: string };

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
  private afs = inject(Firestore);

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

  // wichtig für Reports im Direct-Chat
  private currentChatId = signal<string | null>(null);

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
        this.chatInput.set('');
        this.currentChatId.set(null);
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
  get myCode() {
    return this.user().uid || '…';
  }
  get myCodeGrouped() {
    return this.myCode
      .replace(/\s+/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim();
  }

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
    try {
      // Lazy-load nur wenn gebraucht -> kleineres initial bundle + keine CommonJS-Warnung
      const { toDataURL } = await import('qrcode');
      const url = await toDataURL(this.myCode, {
        width: 256,
        margin: 1,
        color: { dark: '#000000', light: '#00000000' },
      });
      this.qrDataUrl.set(url);
      this.qrOpen.set(true);
    } catch (err) {
      console.error('QR-Fehler:', err);
      alert('QR-Code konnte nicht erzeugt werden.');
    }
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

  // ─────────────────────────────────────────────
  // Chat
  // ─────────────────────────────────────────────

  openChat(friend: FriendPublicProfile) {
    if (!this.user().uid) return;

    this.partner.set(friend);

    // Chat-ID über den Service berechnen
    const cid = this.chat.getDirectChatId(this.user().uid, friend.id);
    this.currentChatId.set(cid);

    // sicherstellen, dass der Chat existiert
    this.chat.ensureChatExists(this.user().uid, friend.id);

    // alten Listener beenden und neuen setzen
    this.unlisten?.();
    this.unlisten = this.chat.listenMessages(cid, (msgs) => {
      this.messages.set(msgs);

      // Autoscroll ans Ende
      setTimeout(() => {
        const box = document.getElementById('chatMessages');
        if (box) box.scrollTop = box.scrollHeight;
      });

      // optional: als gelesen markieren (wenn du willst)
      // this.chat.markRead(cid, this.user().uid);
    });

    this.showChat.set(true);
  }

  async sendMsg(text: string) {
    const txt = (text || '').trim();
    const p = this.partner();
    if (!txt || !p || !this.user().uid) return;

    // vereinheitlicht über Service (Direct)
    await this.chat.sendDirect({
      fromUid: this.user().uid,
      toUid: p.id,
      text: txt,
    });

    this.chatInput.set('');
  }

  closeChat() {
    this.unlisten?.();
    this.unlisten = null;
    this.showChat.set(false);
    this.partner.set(null);
    this.messages.set([]);
    this.chatInput.set('');
    this.currentChatId.set(null);
  }

  // Report aus dem ChatOverlay
  async onReport(evt: ReportEvent) {
    const me = this.user().uid;
    const cid = this.currentChatId();
    if (!me || !cid) return;

    try {
      await addDoc(collection(this.afs, 'reports'), {
        type: 'chat_message',
        scope: 'direct',
        chatId: cid,

        reporterId: me,
        reportedId: evt.userId,

        messageId: evt.messageId ?? null,
        messageText: evt.text ?? '',

        status: 'new',
        createdAt: serverTimestamp(),
      });

      alert('Danke! Die Nachricht wurde gemeldet.');
    } catch (e) {
      console.error('Report fehlgeschlagen', e);
      alert('Melden hat nicht funktioniert.');
    }
  }

  // Cleanup
  ngOnDestroy() {
    this.unlisten?.();
    this.subs.forEach((fn) => fn?.());
    this.subs = [];
    // KEIN presence.stop() mehr hier – Heartbeat wird global verwaltet
  }
}
