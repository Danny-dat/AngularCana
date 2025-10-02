import { Component, computed, inject, signal } from '@angular/core';
import { EventsService, EventItem } from '../../services/events.service';
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged } from 'firebase/auth';

@Component({
  selector: 'app-events',
  standalone: true,
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
})
export class EventsComponent {
  private eventsSvc = inject(EventsService);
  private auth = inject(Auth);

  uid = signal<string | null>(null);

  // Live-Daten
  events$ = this.eventsSvc.listen();
  eventsSig = signal<EventItem[]>([]);

  // UI-State
  onlyMine = signal<boolean>(false);
  query = signal<string>('');
  pending = signal<Record<string, boolean>>({});

  constructor() {
    this.events$.subscribe(this.eventsSig.set);
    onAuthStateChanged(this.auth, (u) => this.uid.set(u?.uid ?? null));
  }

  isUpvoted = (e: EventItem) => !!this.uid() && !!e.upvotes?.includes(this.uid()!);
  isDownvoted = (e: EventItem) => !!this.uid() && !!e.downvotes?.includes(this.uid()!);

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const mine = this.onlyMine();
    const me = this.uid();
    let res = this.eventsSig();

    if (q) {
      res = res.filter(e =>
        (e.name ?? '').toLowerCase().includes(q) ||
        (e.address ?? '').toLowerCase().includes(q)
      );
    }
    if (mine && me) res = res.filter(e => e.upvotes?.includes(me));
    return res;
  });

  likedCount = computed(() => {
    const me = this.uid();
    return me ? this.eventsSig().filter(e => e.upvotes?.includes(me)).length : 0;
  });

  async vote(e: EventItem, type: 'up' | 'down') {
    const me = this.uid();
    if (!me) { alert('Bitte zuerst einloggen.'); return; }

    this.pending.update(p => ({ ...p, [e.id]: true }));
    try {
      await this.eventsSvc.voteEvent(e.id, me, type);
    } catch (err) {
      console.error('vote failed', err);
    } finally {
      this.pending.update(p => { const { [e.id]: _, ...rest } = p; return rest; });
    }
  }

  showOnMap(e: EventItem) {
    document.dispatchEvent(new CustomEvent('events:showOnMap', { detail: e }));
  }
  routeTo(e: EventItem) {
    document.dispatchEvent(new CustomEvent('events:routeTo', { detail: e }));
  }
}
