import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { Auth, user, signOut } from '@angular/fire/auth';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/notification-module';
import { Observable, Subscription, fromEvent } from 'rxjs';
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
  private subStorage?: Subscription;
  private subNameEvent?: Subscription;

  asDate(x: Date | Timestamp): Date {
    return x instanceof Date ? x : x.toDate();
  }

  constructor() {
    // 1) Auth-Änderungen -> Anzeigename und Noti-Stream
    this.subAuth = user(this.auth).subscribe((u) => {
      this.applyLocalOrAuthName(u?.displayName, u?.email);
      this.unsubNoti?.();
      this.unsubNoti = u?.uid ? this.noti.listen(u.uid) : undefined;
    });

    // 2) Live-Updates aus ANDEREN Tabs/Fenstern (storage feuert nicht im selben Tab)
    this.subStorage = fromEvent<StorageEvent>(window, 'storage')
      .pipe(startWith(null as any)) // initial prüfen (liest localStorage einmal)
      .subscribe((ev) => {
        if (ev === null || ev.key === 'displayName') {
          const ls = this.getLocalName();
          if (ls) this.userDisplayName = ls;
        }
      });

    // 3) Live-Updates im SELBEN Tab (wird von deiner UserDataComponent gefeuert)
    this.subNameEvent = fromEvent<CustomEvent<string>>(window as any, 'displayNameChanged')
      .subscribe((ev) => {
        const name = (ev.detail ?? '').trim();
        if (name) this.userDisplayName = name;
      });

    // 4) Sound/Vibration bei neuem Unread
    let last = 0;
    this.subCount = this.unreadCount$.subscribe((c) => {
      if (c > last) playSoundAndVibrate();
      last = c;
    });

    // 5) Dynamischer Titel aus Route.data.title oder URL-Segment
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

    // 6) Fallback: falls oben noch nichts gesetzt wurde, initial aus localStorage ziehen
    if (!this.userDisplayName) this.userDisplayName = this.getLocalName() || 'User';
  }

  // Lokalen Anzeigenamen lesen
  private getLocalName(): string {
    try { return (localStorage.getItem('displayName') || '').trim(); }
    catch { return ''; }
  }

  // Einheitliche Logik: localStorage bevorzugen, sonst Auth-Daten/Fallback
  private applyLocalOrAuthName(authDisplayName?: string | null, email?: string | null) {
    const local = this.getLocalName();
    if (local) {
      this.userDisplayName = local;
      return;
    }
    if (authDisplayName && authDisplayName.trim()) {
      this.userDisplayName = authDisplayName.trim();
      return;
    }
    const mailName = (email ?? '').split('@')[0];
    this.userDisplayName = mailName || 'User';
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
    this.subStorage?.unsubscribe();
    this.subNameEvent?.unsubscribe();
  }
}
