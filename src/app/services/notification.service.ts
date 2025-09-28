// src/app/services/notification.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore, collection, query, where, orderBy, limit,
  onSnapshot, doc, setDoc
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { Timestamp } from 'firebase/firestore'; // optional für Typing

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  message: string;
  type?: 'default' | 'chat_message';
  timestamp: Timestamp | Date;  // ← klarer Typ (statt any)
  read?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private fs = inject(Firestore);
  private platformId = inject(PLATFORM_ID);

  notifications$ = new BehaviorSubject<AppNotification[]>([]);
  unreadCount$  = new BehaviorSubject<number>(0);

  /** Startet den Realtime-Listener für einen User. */
  listen(userId: string, isChatOpenWith?: (senderId?: string) => boolean) {
    // SSR-Schutz: nicht im Server starten
    if (!userId || !isPlatformBrowser(this.platformId)) return () => {};

    const colRef = collection(this.fs, 'notifications');
    const qRef = query(
      colRef,
      where('recipientId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(qRef, (snap) => {
      const all: AppNotification[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const filtered = all.filter(n => !(n.type === 'chat_message' && isChatOpenWith?.(n.senderId)));
      this.notifications$.next(filtered);
      this.unreadCount$.next(filtered.filter(n => !n.read).length);
    }, (err) => {
      // Hilft beim Debuggen (Index/Rules/Netzwerk)
      console.error('notifications snapshot error:', err);
    });

    return unsub;
  }

  /** Als gelesen markieren (merge) */
  async markAsRead(id: string) {
    const ref = doc(this.fs, 'notifications', id);
    await setDoc(ref, { read: true }, { merge: true });
  }
}
