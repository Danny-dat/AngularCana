import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Auth, user } from '@angular/fire/auth';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { Observable, Subscription } from 'rxjs';
import { playSoundAndVibrate } from '../../utils/notify';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-header.html',
  styleUrls: ['./app-header.css'],
})
export class AppHeaderComponent {
  private auth = inject(Auth);
  private noti = inject(NotificationService);

  // UI-Status
  showNotifications = false;

  // Streams aus dem Service
  unreadCount$: Observable<number> = this.noti.unreadCount$;
  notifications$: Observable<AppNotification[]> = this.noti.notifications$;

  // Anzeige
  userDisplayName = '';

  private unsubNoti?: () => void;
  private subAuth?: Subscription;
  private subCount?: Subscription;

  asDate(x: Date | Timestamp): Date {
  return x instanceof Date ? x : x.toDate();
}

  constructor() {
    // 1) User-Status beobachten und Noti-Listener managen
    this.subAuth = user(this.auth).subscribe(u => {
      this.userDisplayName = u?.displayName ?? (u?.email ?? '').split('@')[0];

      // alten Listener beenden
      this.unsubNoti?.();
      this.unsubNoti = undefined;

      if (u?.uid) {
        this.unsubNoti = this.noti.listen(u.uid);
      }
    });

    // 2) Sound/Vibration bei neuem Unread-Count
    let last = 0;
    this.subCount = this.unreadCount$.subscribe(c => {
      if (c > last) playSoundAndVibrate();
      last = c;
    });
  }

  toggleNotifications() { this.showNotifications = !this.showNotifications; }

  async markRead(id: string) {
    await this.noti.markAsRead(id);
  }

  ngOnDestroy() {
    this.unsubNoti?.();
    this.subAuth?.unsubscribe();
    this.subCount?.unsubscribe();
  }
}
