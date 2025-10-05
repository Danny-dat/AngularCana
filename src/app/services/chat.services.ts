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

// erweitert um 'channel'
type ChatKind = 'direct' | 'group' | 'channel';

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
  // 📌 DIRECT-CHAT
  // ─────────────────────────────
  async ensureChatExists(a: UID, b: UID) {
    const id = chatIdFor(a, b);
    await setDoc(
      doc(this.chatsCol, id),
      { type: 'direct', participants: [a, b].sort(), createdAt: TS(), updatedAt: TS() },
      { merge: true } as any
    );
    return id;
  }

  getDirectChatId(a: UID, b: UID) {
    return chatIdFor(a, b);
  }

  // ─────────────────────────────
  // 👥 GRUPPE
  // ─────────────────────────────
  async createGroup(params: {
    name: string;
    members: UID[];
    groupId?: string;
    avatarUrl?: string;
  }): Promise<string> {
    const { name, members, groupId, avatarUrl } = params;
    if (!name || !members?.length) throw new Error('Group name and members required');

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

  async addMember(groupId: string, uid: UID) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { participants: arrayUnion(uid), updatedAt: TS() }, { merge: true } as any);
  }

  async removeMember(groupId: string, uid: UID) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { participants: arrayRemove(uid), updatedAt: TS() }, { merge: true } as any);
  }

  async renameGroup(groupId: string, name: string) {
    const chatRef = doc(this.chatsCol, groupId);
    await setDoc(chatRef as any, { name, updatedAt: TS() }, { merge: true } as any);
  }

  // ─────────────────────────────
  // 🌍 CHANNEL (z. B. global)
  // ─────────────────────────────
  async ensureChannel(channelId: string, name = 'Globaler Chat') {
    const chatRef = doc(this.chatsCol, channelId);
    await setDoc(
      chatRef as any,
      {
        type: 'channel' as ChatKind,
        name,
        participants: [], // öffentlich; tatsächliche Teilnahme erzwingen wir in sendGroup()
        createdAt: TS(),
        updatedAt: TS(),
      },
      { merge: true } as any
    );
    return channelId;
  }

  // ─────────────────────────────
  // 🔔 Lesen / Abonnieren
  // ─────────────────────────────
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

  listenChatMeta(chatId: string, cb: (meta: any) => void) {
    const chatRef = doc(this.chatsCol, chatId);
    return onSnapshot(chatRef, (snap) => cb({ id: chatId, ...snap.data() }));
  }

  // ─────────────────────────────
  // ✉️ Senden (vereinheitlicht)
  // ─────────────────────────────

  /** Kompatibel zur alten Signatur */
  async send({ fromUid, toUid, text }: { fromUid: UID; toUid: UID; text: string }) {
    return this.sendDirect({ fromUid, toUid, text });
  }

  /** Direct-Message; optional mit senderName */
  async sendDirect(params: { fromUid: UID; toUid: UID; text: string; senderName?: string }) {
    const { fromUid, toUid, text, senderName } = params;
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
      extra: senderName ? { senderName } : undefined,
    });

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

  /** Gruppen-/Channel-Nachricht; optional mit senderName (für Global/Channels) */
  async sendGroup(params: { fromUid: UID; chatId: string; text: string; senderName?: string }) {
    const { fromUid, chatId, text, senderName } = params;
    const body = (text || '').trim();
    if (!fromUid || !chatId || !body) return;

    // Teilnehmer sicherstellen (erfüllt gängige Rules)
    await setDoc(
      doc(this.chatsCol, chatId) as any,
      { participants: arrayUnion(fromUid), updatedAt: TS() },
      { merge: true } as any
    );

    await this.touchChat(chatId);

    await this.writeMessage({
      chatId,
      body,
      senderId: fromUid,
      recipientId: null,
      kind: 'group', // Channel nutzt denselben Message-Typ
      extra: senderName ? { senderName } : undefined,
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
    extra?: Record<string, any>;
  }) {
    const { chatId, body, senderId, recipientId, kind, extra } = args;
    const chatRef = doc(this.chatsCol, chatId);
    const msgsCol = collection(chatRef, 'messages');

    const payload: any = {
      text: body,
      senderId,
      recipientId: recipientId ?? null,
      createdAt: TS(),
      readBy: [senderId],
      type: kind,
      ...(extra ?? {}),
    };

    await addDoc(msgsCol, payload);

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
