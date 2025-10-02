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
  DocumentData
} from '@angular/fire/firestore';
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

@Injectable({ providedIn: 'root' })
export class ChatService {
  private afs = inject(Firestore);

  private chatsCol!: CollectionReference<DocumentData>;
  private notiCol!: CollectionReference<DocumentData>;

  constructor() {
    this.chatsCol = collection(this.afs, 'chats');
    this.notiCol = collection(this.afs, 'notifications');
  }

  async ensureChatExists(a: UID, b: UID) {
    const id = chatIdFor(a, b);
    await setDoc(
      doc(this.chatsCol, id),
      { participants: [a, b], createdAt: TS(), updatedAt: TS() },
      { merge: true } as any
    );
    return id;
  }

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

  async send({ fromUid, toUid, text }: { fromUid: UID; toUid: UID; text: string }) {
    const body = (text || '').trim();
    if (!fromUid || !toUid || !body) return;
    const chatId = chatIdFor(fromUid, toUid);
    await this.ensureChatExists(fromUid, toUid);

    const chatRef = doc(this.chatsCol, chatId);
    const msgsCol = collection(chatRef, 'messages');

    await addDoc(msgsCol, {
      text: body,
      senderId: fromUid,
      recipientId: toUid,
      createdAt: TS(),
      readBy: [fromUid],
    });

    await setDoc(
      chatRef as any,
      { lastMessage: body, lastSenderId: fromUid, updatedAt: TS() },
      { merge: true } as any
    );

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

  async markRead(chatId: string, myUid: UID) {
    await setDoc(
      doc(this.chatsCol, chatId) as any,
      { [`reads.${myUid}`]: TS(), updatedAt: TS() },
      { merge: true } as any
    );
  }
}
