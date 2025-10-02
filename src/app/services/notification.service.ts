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
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';
import { AppNotification } from '../models/notification-module';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private fs = inject(Firestore);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private zone = inject(NgZone);

  notifications$ = new BehaviorSubject<AppNotification[]>([]);
  unreadCount$ = new BehaviorSubject<number>(0);

  listen(userId: string, isChatOpenWith?: (senderId?: string) => boolean) {
    if (!userId || !isPlatformBrowser(this.platformId)) return () => {};

    // ALLES innerhalb eines Injection Contexts ausführen
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
          // Zurück in Angulars Zone, damit CD/Hydration sauber laufen
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
}
