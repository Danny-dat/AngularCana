import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from '@angular/fire/firestore';

import { FriendRequest, FriendPublicProfile } from '../../models/social.models';
import { ChatService } from '../../services/chat.services';
import { FriendsService } from '../../services/friends.services';
import { PresenceService } from '../../services/presence.service';
import { ChatOverlayComponent } from '../../feature/chat-overlay/chat-overlay.component';

type ReportEvent = {
  userId: string;
  messageId?: string | null;
  text: string;
  reasonCategory: string;
  reasonText?: string | null;
};

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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Subscriptions/Listener
  private subs: Array<() => void> = [];
  private unlisten: (() => void) | null = null;
  private offPresence: (() => void) | null = null;

  // User
  user = signal<{ uid: string; email?: string; displayName?: string | null }>({ uid: '' });

  // State
  friendCodeInput = signal('');
  friendSearch = signal('');
  blockedSearch = signal('');
  incoming = signal<FriendRequest[]>([]);
  list = signal<FriendPublicProfile[]>([]);
  blockedProfiles = signal<FriendPublicProfile[]>([]);

  readonly onlineCount = computed(() => {
    const ids = this.onlineIds();
    return this.list().reduce((acc, f) => acc + (ids.has(f.id) ? 1 : 0), 0);
  });

  readonly filteredFriends = computed(() => {
    const q = (this.friendSearch() ?? '').toString().trim().toLowerCase();
    const ids = this.onlineIds();
    const items = [...this.list()];

    // online zuerst, dann alphabetisch
    items.sort((a, b) => {
      const ao = ids.has(a.id) ? 0 : 1;
      const bo = ids.has(b.id) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const an = (a.username || a.displayName || a.label || a.id).toString().toLowerCase();
      const bn = (b.username || b.displayName || b.label || b.id).toString().toLowerCase();
      return an.localeCompare(bn);
    });

    if (!q) return items;
    return items.filter((f) => {
      const name = (f.username || f.displayName || f.label || '').toString().toLowerCase();
      return name.includes(q) || f.id.toLowerCase().includes(q);
    });
  });

  readonly filteredBlocked = computed(() => {
    const q = (this.blockedSearch() ?? '').toString().trim().toLowerCase();
    const items = [...this.blockedProfiles()];
    if (!q) return items;
    return items.filter((f) => {
      const name = (f.username || f.displayName || f.label || '').toString().toLowerCase();
      return name.includes(q) || f.id.toLowerCase().includes(q);
    });
  });

  // Share/QR
  shareHelpOpen = signal(false);
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

  // QueryParam: /social?openChatWith=<uid>
  private pendingOpenUid = signal<string | null>(null);

  constructor() {
    // QueryParams (Notifications -> Direkt-Chat öffnen)
    this.route.queryParams.subscribe((qp) => {
      const open = (qp?.['openChatWith'] ?? '').toString().trim();
      if (open) {
        this.pendingOpenUid.set(open);
        // falls User schon eingeloggt ist -> direkt öffnen
        this.tryOpenFromQuery();
      }
    });

    onAuthStateChanged(this.auth, (u: User | null) => {
      // bestehende Listener sauber beenden
      this.subs.forEach((fn) => fn?.());
      this.subs = [];
      this.unlisten?.();
      this.unlisten = null;
      this.offPresence?.();
      this.offPresence = null;

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

      // wenn wir via Notification reinkommen
      this.tryOpenFromQuery();

      // 1) Offene Anfragen
      const offIncoming = this.friends.listenIncoming(myUid, (reqs) => this.incoming.set(reqs));
      this.subs.push(offIncoming);

      // 2) Freunde + Presence (nur lesen)
      const offFriends = this.friends.listenFriends(myUid, (friends) => {
        this.list.set(friends);

        const ids = friends.map((x) => x.id);
        // Presence-Listener wechseln (sonst sammelt sich das bei Updates)
        this.offPresence?.();
        this.offPresence = this.presence.listen(ids, (online: string[]) => {
          this.onlineIds.set(new Set(online));
        });
      });
      this.subs.push(offFriends);

      // 3) Blockierte (mit Profilen)
      const offBlocked = this.friends.listenBlockedProfiles(myUid, (profiles) => {
        this.blockedProfiles.set(profiles);
      });
      this.subs.push(offBlocked);
    });
  }

  private async tryOpenFromQuery() {
    const targetUid = this.pendingOpenUid();
    const me = this.user().uid;
    if (!targetUid || !me) return;
    // nicht selbst
    if (targetUid === me) {
      this.pendingOpenUid.set(null);
      return;
    }

    try {
      // Public Profile holen (damit Header schön aussieht)
      const snap = await getDoc(doc(this.afs, 'profiles_public', targetUid));
      const data: any = snap.exists() ? snap.data() : {};
      const label = data?.username || data?.displayName || `${targetUid.slice(0, 6)}…`;

      const partner: FriendPublicProfile = {
        id: targetUid,
        label,
        displayName: data?.displayName ?? null,
        username: data?.username ?? null,
        photoURL: data?.photoURL ?? null,
        lastLocation: data?.lastLocation ?? null,
        _action: '',
      };

      this.openChat(partner);
    } catch (e) {
      // auch ohne Profil starten
      this.openChat({
        id: targetUid,
        label: `${targetUid.slice(0, 6)}…`,
        displayName: null,
        username: null,
        photoURL: null,
        lastLocation: null,
        _action: '',
      });
    } finally {
      this.pendingOpenUid.set(null);
      // Param entfernen, damit es nicht bei jeder Navigation wieder aufgeht
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { openChatWith: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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

  goToProfile(uid: string, evt?: Event) {
    evt?.stopPropagation();
    const id = (uid ?? '').toString().trim();
    if (!id) return;
    this.router.navigate(['/u', id]);
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

    // Guard / Normalisierung (sicherer)
    const cat = (evt.reasonCategory || '').trim();
    const note = (evt.reasonText ?? '').toString().trim();
    if (!cat) return;

    try {
      await addDoc(collection(this.afs, 'reports'), {
        type: 'chat_message',
        scope: 'direct',
        chatId: cid,

        reporterId: me,
        reportedId: evt.userId,

        messageId: evt.messageId ?? null,
        messageText: evt.text ?? '',

        // hier die normalisierten Werte nutzen
        reasonCategory: cat,
        reasonText: note ? note : null,

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
    this.offPresence?.();
    this.offPresence = null;
    this.subs.forEach((fn) => fn?.());
    this.subs = [];
    // KEIN presence.stop() mehr hier – Heartbeat wird global verwaltet
  }
}
