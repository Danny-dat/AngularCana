import { Component, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { ThemeService, Theme } from '../../services/theme.service';
import { UserDataService } from '../../services/user-data.service';
import { Auth, user, signOut } from '@angular/fire/auth';
import { NotificationService } from '../../services/notification.service';
import { AppNotification } from '../../models/notification-module';
import { Observable, Subscription, fromEvent } from 'rxjs';
import { vibrate } from '../../utils/notify';
import { NotificationSoundService } from '../../services/notification-sound.service';
import { Timestamp } from '@angular/fire/firestore';
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
  private theme = inject(ThemeService);
  private userData = inject(UserDataService);

  // Sound-Service injizieren
  private sound = inject(NotificationSoundService);

  showNotifications = false;
  showSidebar = false;
  showSettings = false;

  pageTitle = 'Dashboard';

  unreadCount$: Observable<number> = this.noti.unreadCount$;
  notifications$: Observable<AppNotification[]> = this.noti.notifications$;

  userDisplayName = '';
  themeMode: Theme = 'light';
  private currentUid = '';

  private unsubNoti?: () => void;
  private subAuth?: Subscription;
  private subCount?: Subscription;
  private subRoute?: Subscription;
  private subStorage?: Subscription;
  private subNameEvent?: Subscription;

  // Ref auf Glocken-/Dropdown-Wrapper + Doc-Click-Subscription
  @ViewChild('bellWrap', { static: true }) bellWrap!: ElementRef<HTMLElement>;
  private docClickSub?: Subscription;

  asDate(x: Date | Timestamp): Date {
    return x instanceof Date ? x : x.toDate();
  }

  constructor() {
    this.themeMode = this.theme.getTheme();
    // 1) Auth-Änderungen -> Anzeigename und Noti-Stream
    this.subAuth = user(this.auth).subscribe((u) => {
      this.currentUid = u?.uid ?? '';

      if (!u) {
        this.userDisplayName = 'User';
        this.unsubNoti?.();
        this.unsubNoti = undefined;

        // optional: UI sauber halten
        try {
          this.noti.notifications$.next([]);
          this.noti.unreadCount$.next(0);
        } catch {}

        return;
      }

      this.applyLocalOrAuthName(u.displayName, u.email);
      this.unsubNoti?.();
      this.unsubNoti = this.noti.listen(u.uid);
    });

    // 2) Live-Updates aus anderen Tabs
    this.subStorage = fromEvent<StorageEvent>(window, 'storage')
      .pipe(startWith(null as any))
      .subscribe((ev) => {
        if (ev === null || ev.key === 'displayName') {
          if (!this.auth.currentUser) return;
          const ls = this.getLocalName();
          if (ls) this.userDisplayName = ls;
        }

        // Theme live-update (andere Tabs)
        if (ev === null || ev.key === 'pref-theme' || ev.key === 'ui:theme') {
          this.themeMode = this.theme.getTheme();
        }
      });

    // 3) Live-Updates im selben Tab (von UserDataComponent gefeuert)
    this.subNameEvent = fromEvent<CustomEvent<string>>(
      window as any,
      'displayNameChanged',
    ).subscribe((ev) => {
      const name = (ev.detail ?? '').trim();
      if (name) this.userDisplayName = name;
    });

    // 4) 🔔 Neuer Unread -> Asset-Sound + kurze Vibration
    let last = 0;
    this.subCount = this.unreadCount$.subscribe(async (c) => {
      if (c > last) {
        const enabled = localStorage.getItem('notify:sound') !== 'off';
        if (enabled) {
          try {
            await this.sound.play();
          } catch {}
        }
        vibrate(100);
      }
      last = c;
    });

    // 5) Dynamischer Titel
    this.subRoute = this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => {
          let r = this.route.firstChild;
          while (r?.firstChild) r = r.firstChild;
          const dataTitle = r?.snapshot.data?.['title'] as string | undefined;
          if (dataTitle) return dataTitle;
          const urlSeg = r?.snapshot.url?.[0]?.path || 'Dashboard';
          return urlSeg.charAt(0).toUpperCase() + urlSeg.slice(1);
        }),
      )
      .subscribe((t) => (this.pageTitle = t));

    if (!this.userDisplayName) this.userDisplayName = this.getLocalName() || 'User';
  }

  private getLocalName(): string {
    try {
      return (localStorage.getItem('displayName') || '').trim();
    } catch {
      return '';
    }
  }

  private applyLocalOrAuthName(authDisplayName?: string | null, email?: string | null) {
    if (authDisplayName && authDisplayName.trim()) {
      this.userDisplayName = authDisplayName.trim();
      return;
    }
    if (email && email.trim()) {
      this.userDisplayName = email.split('@')[0] || 'User';
      return;
    }
    const local = this.getLocalName();
    this.userDisplayName = local || 'User';
  }

  toggleSidebar(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showSidebar = !this.showSidebar;
  }

  openSettings(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showSettings = !this.showSettings;
  }

  async toggleTheme(ev?: MouseEvent) {
    ev?.stopPropagation();
    const cur = this.theme.getTheme();
    const next: Theme = cur === 'dark' ? 'light' : 'dark';

    this.theme.setTheme(next);
    this.themeMode = next;
    try {
      localStorage.setItem('ui:theme', next);
    } catch {}

    const uid = this.auth.currentUser?.uid || this.currentUid;
    if (uid) {
      try {
        await this.userData.saveUserData(uid, { theme: next } as any);
      } catch {
        // best effort
      }
    }
  }

  // Öffnen/Schließen inkl. „Klick außerhalb schließt“
  toggleNotifications(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.showNotifications = !this.showNotifications;

    if (this.showNotifications) {
      // bestehenden Listener sicher entfernen
      this.docClickSub?.unsubscribe();

      this.docClickSub = fromEvent<MouseEvent>(document, 'click').subscribe((evt) => {
        const anyEvt = evt as any;
        const path: EventTarget[] =
          (typeof anyEvt.composedPath === 'function' && anyEvt.composedPath()) || anyEvt.path || [];

        const hostEl = this.bellWrap?.nativeElement;
        const clickedInside =
          (Array.isArray(path) && hostEl ? path.includes(hostEl) : false) ||
          (hostEl ? hostEl.contains(evt.target as Node) : false);

        if (!clickedInside) {
          this.showNotifications = false;
          this.docClickSub?.unsubscribe();
          this.docClickSub = undefined;
        }
      });
    } else {
      // Dropdown zu -> Listener aufräumen
      this.docClickSub?.unsubscribe();
      this.docClickSub = undefined;
    }
  }

  closeDropdown() {
    this.showNotifications = false;
    // optional: sicherheitshalber auch hier aufräumen
    this.docClickSub?.unsubscribe();
    this.docClickSub = undefined;
  }

  /**
   * Öffnet je nach Notification-Typ das richtige Ziel.
   * - chat_message  -> /social?openChatWith=<senderId>
   * - friend_request -> /social?tab=requests
   * Markiert dabei die Notification als gelesen und schließt das Dropdown.
   */
  async openNotification(n: AppNotification) {
    try {
      await this.noti.markAsRead(n.id);
    } catch {}

    // Dropdown schließen + Listener aufräumen
    this.showNotifications = false;
    this.docClickSub?.unsubscribe();
    this.docClickSub = undefined;

    switch (n.type) {
      case 'chat_message':
        if (n.senderId) {
          this.router.navigate(['/social'], {
            queryParams: { openChatWith: n.senderId },
          });
        } else {
          this.router.navigate(['/social']);
        }
        break;

      case 'friend_request':
        this.router.navigate(['/social'], {
          queryParams: { tab: 'requests' },
        });
        break;

      default:
        this.router.navigate(['/social']);
    }
  }

  /**
   * Löscht eine Benachrichtigung (ohne sie zu "öffnen").
   * stopPropagation verhindert, dass der Klick den Eintrag ebenfalls öffnet.
   */
  async deleteNotification(id: string, ev?: MouseEvent) {
    ev?.stopPropagation();
    try {
      await this.noti.delete(id);
    } catch (e) {
      console.error('delete notification failed', e);
    }
  }

  // Einzelnes Lesen-Markieren
  async markRead(id: string) {
    await this.noti.markAsRead(id);
  }

  async logout() {
    // WICHTIG: Firestore Listener stoppen, bevor Auth auf null springt
    try {
      this.unsubNoti?.();
    } catch {}
    this.unsubNoti = undefined;

    // Dropdown / Listener im Header auch weg
    this.showNotifications = false;
    this.docClickSub?.unsubscribe();
    this.docClickSub = undefined;

    // optional: UI sofort leeren (verhindert "alte" Notis nach Logout)
    try {
      this.noti.notifications$.next([]);
      this.noti.unreadCount$.next(0);
    } catch {}

    try {
      localStorage.removeItem('displayName');
      localStorage.removeItem('username'); // legacy
      window.dispatchEvent(new StorageEvent('storage', { key: 'displayName' }));
    } catch {}

    try {
      await signOut(this.auth);
    } catch (e) {
      console.error('signOut failed', e);
    }

    this.router.navigateByUrl('/login');
  }

  ngOnDestroy() {
    this.unsubNoti?.();
    this.subAuth?.unsubscribe();
    this.subCount?.unsubscribe();
    this.subRoute?.unsubscribe();
    this.subStorage?.unsubscribe();
    this.subNameEvent?.unsubscribe();
    this.docClickSub?.unsubscribe();
  }
}
