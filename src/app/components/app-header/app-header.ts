import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user, signOut } from '@angular/fire/auth';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { Observable, Subscription } from 'rxjs';
import { playSoundAndVibrate } from '../../utils/notify';
import { Timestamp } from 'firebase/firestore';
import { AppSidenav } from '../app-sidenav/app-sidenav';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, AppSidenav],
  templateUrl: './app-header.html',
  styleUrls: ['./app-header.css'],
})
export class AppHeaderComponent {
  private auth = inject(Auth);
  private noti = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  showNotifications = false;
  showSidebar = false;
  showSettings = false;

  pageTitle = 'Dashboard';

  unreadCount$: Observable<number> = this.noti.unreadCount$;
  notifications$: Observable<AppNotification[]> = this.noti.notifications$;

  userDisplayName = '';
  private unsubNoti?: () => void;
  private subAuth?: Subscription;
  private subCount?: Subscription;
  private subRoute?: Subscription;

  asDate(x: Date | Timestamp): Date {
    return x instanceof Date ? x : x.toDate();
  }

  constructor() {
    // User & Noti-Listener
    this.subAuth = user(this.auth).subscribe((u) => {
      this.userDisplayName = u?.displayName ?? (u?.email ?? '').split('@')[0];
      this.unsubNoti?.();
      this.unsubNoti = u?.uid ? this.noti.listen(u.uid) : undefined;
    });

    // Sound/Vibration bei neuem Unread
    let last = 0;
    this.subCount = this.unreadCount$.subscribe((c) => {
      if (c > last) playSoundAndVibrate();
      last = c;
    });

    // Dynamischer Titel aus Route.data.title
    this.subRoute = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => {
        let r = this.route.firstChild;
        while (r?.firstChild) r = r.firstChild;
        const dataTitle = r?.snapshot.data?.['title'] as string | undefined;
        if (dataTitle) return dataTitle;
        const urlSeg = r?.snapshot.url?.[0]?.path || 'Dashboard';
        return urlSeg.charAt(0).toUpperCase() + urlSeg.slice(1);
      })
    ).subscribe(t => this.pageTitle = t);
  }

  toggleSidebar(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showSidebar = !this.showSidebar;
  }

  openSettings(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showSettings = !this.showSettings;
  }

  toggleNotifications(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showNotifications = !this.showNotifications;
  }

  closeDropdown() { this.showNotifications = false; }

  async markRead(id: string) {
    await this.noti.markAsRead(id);
  }

  async logout() {
  await signOut(this.auth);
  this.router.navigateByUrl('/login');
}

  ngOnDestroy() {
    this.unsubNoti?.();
    this.subAuth?.unsubscribe();
    this.subCount?.unsubscribe();
    this.subRoute?.unsubscribe();
  }
}
