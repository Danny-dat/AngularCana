import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  setDoc,
  doc,
  query,
  orderBy,
  addDoc,
  onSnapshot,
  serverTimestamp,
  limit,
  CollectionReference,
  DocumentData,
} from '@angular/fire/firestore';
import { arrayUnion, arrayRemove } from 'firebase/firestore';
import { ChatMessage, UID } from '../models/social.models';

const NOTIFY_COOLDOWN_MS = 8000;
const lastNotify = new Map<string, number>();

const shouldNotify = (fromUid: UID, toUid: UID) => {
  if (!NOTIFY_COOLDOWN_MS) return true;
  const k = `${fromUid}->${toUid}`;
  const now = Date.now();
  const last = lastNotify.get(k) ?? 0;
  if (now - last < NOTIFY_COOLDOWN_MS) return false;
  lastNotify.set(k, now);
  return true;
};

const TS = () => serverTimestamp();
export const chatIdFor = (a: UID, b: UID) => [a, b].sort().join('_');

type ChatKind = 'direct' | 'group';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private afs = inject(Firestore);

  private chatsCol!: CollectionReference<DocumentData>;
  private notiCol!: CollectionReference<DocumentData>;

  constructor() {
    this.chatsCol = collection(this.afs, 'chats');
    this.notiCol = collection(this.afs, 'notifications');
  }

  // ─────────────────────────────
  // 📌 DIRECT-CHAT (bestehend, rückwärtskompatibel)
  // ─────────────────────────────

  /** Bestehende Methode – bleibt erhalten. */
  async ensureChatExists(a: UID, b: UID) {
    const id = chatIdFor(a, b);
    await setDoc(
      doc(this.chatsCol, id),
      { type: 'direct', participants: [a, b].sort(), createdAt: TS(), updatedAt: TS() },
      { merge: true } as any
    );
    return id;
  }

  /** Convenience: gibt dir direkt die Chat-ID (sortiert). */
  getDirectChatId(a: UID, b: UID) {
    return chatIdFor(a, b);
  }

  // ─────────────────────────────
  // 👥 GRUPPEN-CHAT (neu, vorbereitet)
  // ─────────────────────────────

  /**
   * Gruppe anlegen. Wenn groupId übergeben wird, wird diese verwendet;
   * sonst wird eine neue ID erzeugt (return value).
   */
  async createGroup(params: {
    name: string;
    members: UID[];
    groupId?: string;
    avatarUrl?: string;
  }): Promise<string> {
    const { name, members, groupId, avatarUrl } = params;
    if (!name || !members?.length) throw new Error('Group name and members required');

    // Neue ID oder vorgegebene ID verwenden
    if (groupId) {
      const chatRef = doc(this.chatsCol, groupId);
      await setDoc(
        chatRef,
        {
          type: 'group' as ChatKind,
          name,
          participants: [...new Set(members)].sort(),
          avatarUrl: avatarUrl ?? null,
          createdAt: TS(),
          updatedAt: TS(),
        },
        { merge: true } as any
      );
      return groupId;
    } else {
      const ref = await addDoc(this.chatsCol, {
        type: 'group' as ChatKind,
        name,
        participants: [...new Set(members)].sort(),
        avatarUrl: avatarUrl ?? null,
        createdAt: TS(),
        updatedAt: TS(),
      });
      return ref.id;
    }
  }

  /** Mitglied hinzufügen (idempotent). */
  async addMember(groupId: string, uid: UID) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { participants: arrayUnion(uid), updatedAt: TS() }, { merge: true } as any);
  }

  /** Mitglied entfernen. */
  async removeMember(groupId: string, uid: UID) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { participants: arrayRemove(uid), updatedAt: TS() }, { merge: true } as any);
  }

  /** Gruppe umbenennen. */
  async renameGroup(groupId: string, name: string) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { name, updatedAt: TS() }, { merge: true } as any);
  }

  // ─────────────────────────────
  // 🔔 Lesen / Abonnieren
  // ─────────────────────────────

  /** Nachrichten-Stream für direct ODER group. */
  listenMessages(chatId: string, cb: (msgs: ChatMessage[]) => void, max = 200) {
    const msgsCol = collection(doc(this.chatsCol, chatId), 'messages');
    const q = query(msgsCol, orderBy('createdAt', 'asc'), limit(max));
    return onSnapshot(q, (snap) => {
      cb(
        snap.docs.map((d) => {
          const data: any = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
          };
        })
      );
    });
  }

  /** Optional: Chat-Metadaten (Titel, Teilnehmer, lastMessage) abonnieren. */
  listenChatMeta(chatId: string, cb: (meta: any) => void) {
    const chatRef = doc(this.chatsCol, chatId);
    return onSnapshot(chatRef, (snap) => cb({ id: chatId, ...snap.data() }));
  }

  // ─────────────────────────────
  // ✉️ Senden (vereinheitlicht)
  // ─────────────────────────────

  /** Alte Signatur – bleibt für Kompatibilität und ruft sendDirect auf. */
  async send({ fromUid, toUid, text }: { fromUid: UID; toUid: UID; text: string }) {
    return this.sendDirect({ fromUid, toUid, text });
  }

  /** Direct-Message senden (a↔b). */
  async sendDirect({ fromUid, toUid, text }: { fromUid: UID; toUid: UID; text: string }) {
    const body = (text || '').trim();
    if (!fromUid || !toUid || !body) return;

    const chatId = chatIdFor(fromUid, toUid);
    await this.ensureChatExists(fromUid, toUid);

    await this.writeMessage({
      chatId,
      body,
      senderId: fromUid,
      recipientId: toUid,
      kind: 'direct',
    });

    // einfache Notification nur bei Direct-Chat
    if (shouldNotify(fromUid, toUid)) {
      await addDoc(this.notiCol, {
        type: 'chat_message',
        recipientId: toUid,
        senderId: fromUid,
        message: body.length > 80 ? body.slice(0, 80) + '…' : body,
        read: false,
        timestamp: TS(),
      });
    }
  }

  /** Gruppen-Nachricht senden (erfordert bestehende groupId). */
  async sendGroup({ fromUid, chatId, text }: { fromUid: UID; chatId: string; text: string }) {
    const body = (text || '').trim();
    if (!fromUid || !chatId || !body) return;

    await this.touchChat(chatId); // falls Chat schon existiert, updatedAt setzen

    await this.writeMessage({
      chatId,
      body,
      senderId: fromUid,
      recipientId: null,
      kind: 'group',
    });
  }

  // ─────────────────────────────
  // 🧩 Intern
  // ─────────────────────────────

  private async writeMessage(args: {
    chatId: string;
    body: string;
    senderId: UID;
    recipientId: UID | null;
    kind: ChatKind;
  }) {
    const { chatId, body, senderId, recipientId, kind } = args;
    const chatRef = doc(this.chatsCol, chatId);
    const msgsCol = collection(chatRef, 'messages');

    await addDoc(msgsCol, {
      text: body,
      senderId,
      recipientId: recipientId ?? null,
      createdAt: TS(),
      readBy: [senderId],
      type: kind,
    });

    await setDoc(
      chatRef as any,
      { lastMessage: body, lastSenderId: senderId, updatedAt: TS() },
      { merge: true } as any
    );
  }

  private async touchChat(chatId: string) {
    const chatRef = doc(this.chatsCol, chatId);
    await setDoc(chatRef as any, { updatedAt: TS() }, { merge: true } as any);
  }

  async markRead(chatId: string, myUid: UID) {
    await setDoc(
      doc(this.chatsCol, chatId) as any,
      { [`reads.${myUid}`]: TS(), updatedAt: TS() },
      { merge: true } as any
    );
  }
}
