// src/app/services/notification.service.ts
import {
  Injectable,
  inject,
  PLATFORM_ID,
  Injector,
  NgZone,
  runInInjectionContext,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { deleteDoc } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { FriendsService } from './friends.services';
import { AppNotification } from '../models/notification-module';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private fs = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private zone = inject(NgZone);

  notifications$ = new BehaviorSubject<AppNotification[]>([]);
  unreadCount$ = new BehaviorSubject<number>(0);

  // === LISTENER (bestehend) ===
  listen(userId: string, isChatOpenWith?: (senderId?: string) => boolean) {
    if (!userId || !isPlatformBrowser(this.platformId)) return () => {};

    return runInInjectionContext(this.injector, () => {
      const colRef = collection(this.fs, 'notifications');
      const qRef = query(
        colRef,
        where('recipientId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const unsub = onSnapshot(
        qRef,
        (snap) => {
          this.zone.run(() => {
            const all: AppNotification[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
            const filtered = all.filter(
              (n) => !(n.type === 'chat_message' && isChatOpenWith?.(n.senderId))
            );
            this.notifications$.next(filtered);
            this.unreadCount$.next(filtered.filter((n) => !n.read).length);
          });
        },
        (err) => console.error('notifications snapshot error:', err)
      );

      return () => unsub();
    });
  }

  async markAsRead(id: string) {
    const ref = doc(this.fs, 'notifications', id);
    await setDoc(ref, { read: true }, { merge: true });
  }

  async delete(id: string) {
    const ref = doc(this.fs, 'notifications', id);
    await deleteDoc(ref);
  }

  // === NEU: Benachrichtigung an Freunde schicken ===
  constructor(private friends: FriendsService) {}

  async sendConsumptionToFriends(params: {
    userId: string;
    displayName?: string | null;
    product: string;
    device: string;
    location: string;
  }): Promise<void> {
    const { userId, displayName, product, device, location } = params;
    if (!userId || !product || !device || !location) return;

    // akzeptierte Freunde besorgen
    const recipientIds = await this.friends.getAcceptedFriendIds(userId);
    if (!recipientIds.length) return;

    return runInInjectionContext(this.injector, async () => {
      const batch = writeBatch(this.fs);
      const colRef = collection(this.fs, 'notifications');
      const senderName = displayName || 'Ein Freund';
      const message = `${senderName} hat ${product} mit einem ${device} in/im ${location} konsumiert.`;

      recipientIds.forEach((rid) => {
        const ref = doc(colRef);
        batch.set(ref, {
          type: 'consumption_activity',
          recipientId: rid,
          senderId: userId,
          senderName,
          message,
          timestamp: serverTimestamp(),
          read: false,
        });
      });

      await batch.commit();
    });
  }
}
