/* istanbul ignore file */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

type PublicSocials = {
  instagram?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  discord?: string | null;
  telegram?: string | null;
};

type PublicProfileDoc = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
  bio?: string | null;
  website?: string | null;
  locationText?: string | null;
  socials?: PublicSocials | null;
};

@Component({
  standalone: true,
  selector: 'app-public-profile-page',
  imports: [CommonModule],
  templateUrl: './public-profile.page.html',
  styleUrls: ['./public-profile.page.css'],
})
export class PublicProfilePage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private afs = inject(Firestore);

  uid = signal('');
  loading = signal(true);
  errorMsg = signal<string | null>(null);
  profile = signal<PublicProfileDoc | null>(null);
  copied = signal(false);

  constructor() {
    this.route.paramMap.subscribe((pm) => {
      const id = (pm.get('uid') ?? '').trim();
      this.uid.set(id);
      this.loadProfile(id);
    });
  }

  private normalizeUrl(raw?: string | null) {
    const v = (raw ?? '').trim();
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  }

  async loadProfile(uid: string) {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.profile.set(null);

    if (!uid) {
      this.errorMsg.set('Keine UID angegeben.');
      this.loading.set(false);
      return;
    }

    try {
      const snap = await getDoc(doc(this.afs, 'profiles_public', uid));
      if (!snap.exists()) {
        this.profile.set(null);
        this.loading.set(false);
        return;
      }
      const d: any = snap.data() ?? {};
      const p: PublicProfileDoc = {
        id: uid,
        displayName: d.displayName ?? null,
        username: d.username ?? null,
        photoURL: d.photoURL ?? null,
        bio: d.bio ?? null,
        website: this.normalizeUrl(d.website ?? null),
        locationText: d.locationText ?? null,
        socials: d.socials ?? null,
      };
      this.profile.set(p);
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'Profil konnte nicht geladen werden.');
    } finally {
      this.loading.set(false);
    }
  }

  displayName() {
    const p = this.profile();
    if (!p) return this.uid() ? `User ${this.uid().slice(0, 6)}…` : 'Profil';
    return (p.username || p.displayName || `User ${p.id.slice(0, 6)}…`).toString();
  }

  async copyUid() {
    const id = this.uid();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    } catch {
      prompt('UID zum Kopieren:', id);
    }
  }

  openChat() {
    const id = this.uid();
    if (!id) return;
    this.router.navigate(['/social'], { queryParams: { openChatWith: id } });
  }

  back() {
    // wenn möglich zurück, sonst Social
    try {
      history.length > 1 ? history.back() : this.router.navigate(['/social']);
    } catch {
      this.router.navigate(['/social']);
    }
  }
}
