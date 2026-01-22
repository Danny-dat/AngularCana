import { Component, inject, signal, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ChatService } from '../../services/chat.services';
import { FriendsService } from '../../services/friends.services';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
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
  selector: 'app-global-chat-page',
  imports: [CommonModule, ChatOverlayComponent],
  templateUrl: './global-chat.html',
  styleUrls: ['./global-chat.css'],
})
export class GlobalChatPage implements AfterViewInit, OnDestroy {
  private auth = inject(Auth);
  private chat = inject(ChatService);
  private friends = inject(FriendsService);
  private afs = inject(Firestore);

  readonly channelId = 'global';

  // Auth / User
  uid = signal<string>('');
  displayName = signal<string>(''); // wird an sendGroup() übergeben
  email = signal<string>('');

  // Chat
  messages = signal<any[]>([]);
  text = signal('');

  private unlisten: (() => void) | null = null;
  private offAuth: (() => void) | null = null;

  // Cache für Namen von fremden Nachrichten (für alte Messages ohne senderName)
  private nameCache = new Map<string, string>();

  constructor() {
    // Auth-Status beobachten
    this.offAuth = onAuthStateChanged(this.auth, (u: User | null) => {
      this.uid.set(u?.uid ?? '');
      this.email.set(u?.email ?? '');
      // Fallbacks: displayName > email > uid
      this.displayName.set(u?.displayName ?? u?.email ?? u?.uid ?? '');
    });
  }

  async ngAfterViewInit() {
    // Channel-Dokument sicherstellen (type: 'channel')
    await this.chat.ensureChannel(this.channelId, 'Globaler Chat');

    // Nachrichten streamen
    this.unlisten = this.chat.listenMessages(this.channelId, async (msgs) => {
      // 1) direkt anzeigen
      this.messages.set(msgs);

      // 2) Namen für alte Messages ohne senderName nachladen
      await this.hydrateMissingSenderNames(msgs);

      // 3) autoscroll ans Ende
      setTimeout(() => {
        const el = document.getElementById('chatMessages');
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnDestroy() {
    this.unlisten?.();
    this.unlisten = null;
    this.offAuth?.();
    this.offAuth = null;
  }

  // ---- Senden --------------------------------------------------------------

  async onSend(text: string) {
    const body = (text || '').trim();
    const me = this.uid();
    if (!body || !me) return;

    try {
      await this.chat.sendGroup({
        fromUid: me,
        chatId: this.channelId,
        text: body,
        senderName: this.displayName(),
      });
      this.text.set(''); // Eingabefeld leeren
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        // Spam-Limit o.ä.
        alert('Du schreibst zu schnell. Bitte warte kurz.');
      } else {
        console.error('Senden fehlgeschlagen:', e);
        alert('Senden fehlgeschlagen. Bitte später erneut versuchen.');
      }
    }
  }

  // ---- Overlay-Aktionen ----------------------------------------------------

  async onAddFriend(userId: string) {
    const me = this.uid();
    if (!me || !userId || me === userId) return;

    await this.friends.sendFriendRequest({
      fromUid: me,
      fromEmail: this.email() || null,
      fromDisplayName: this.displayName() || this.email() || me,
      toUid: userId,
    });
  }

  // Report enthält jetzt Kategorie + optionalen Text
  async onReport(evt: ReportEvent) {
    const me = this.uid();
    if (!me) return;

    // Guard / Normalisierung
    const cat = (evt.reasonCategory || '').trim();
    const note = (evt.reasonText ?? '').toString().trim();
    if (!cat) return;

    try {
      await addDoc(collection(this.afs, 'reports'), {
        type: 'chat_message',
        scope: 'channel',
        status: 'new',
        chatId: this.channelId,

        reporterId: me,
        reportedId: evt.userId,

        messageId: evt.messageId ?? null,
        messageText: evt.text ?? '',

        reasonCategory: cat,
        reasonText: note ? note : null,

        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Report fehlgeschlagen', e);
      alert('Melden hat nicht funktioniert.');
    }
  }

  close() {
    history.back();
  }

  // ---- Namen ergänzen für alte Nachrichten --------------------------------

  private async hydrateMissingSenderNames(msgs: any[]) {
    // sammle UIDs ohne senderName
    const missing = new Set<string>();
    for (const m of msgs) {
      if (!m?.senderName && m?.senderId) {
        if (this.nameCache.has(m.senderId)) {
          // aus Cache ergänzen
          m.senderName = this.nameCache.get(m.senderId);
        } else {
          missing.add(m.senderId);
        }
      }
    }
    if (missing.size === 0) {
      // ggf. UI refreshen, wenn wir gecachte Namen gesetzt haben
      this.messages.set([...msgs]);
      return;
    }

    // einzeln laden (einfach & robust)
    await Promise.all(
      Array.from(missing).map(async (uid) => {
        try {
          const ref = doc(this.afs, 'profiles_public', uid);
          const snap = await getDoc(ref);
          const name =
            (snap.exists() &&
              ((snap.data() as any).displayName || (snap.data() as any).username)) ||
            uid;
          this.nameCache.set(uid, name);
        } catch {
          this.nameCache.set(uid, uid);
        }
      }),
    );

    // Namen in Messages eintragen
    for (const m of msgs) {
      if (!m.senderName && m.senderId && this.nameCache.has(m.senderId)) {
        m.senderName = this.nameCache.get(m.senderId)!;
      }
    }
    this.messages.set([...msgs]);
  }
}
