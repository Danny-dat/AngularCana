import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { EventsService } from '../../services/events.service';
import { EventItem } from '../../models/event.model';

// hier dein Auth-User holen – falls du bereits einen AuthService hast, ersetzen:
const getUid = () => localStorage.getItem('uid') ?? 'demo-user';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, AsyncPipe],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css']
})
export class EventsComponent {
  private eventsSvc = inject(EventsService);

  uid = getUid();
  eventsSig = signal<EventItem[]>([]);
  events$ = this.eventsSvc.listen();

  constructor() {
    this.events$.subscribe(this.eventsSig.set);
  }

  isUpvoted = (e: EventItem) => !!e.upvotes?.includes(this.uid);
  isDownvoted = (e: EventItem) => !!e.downvotes?.includes(this.uid);

  vote(e: EventItem, type: 'up'|'down') {
    this.eventsSvc.voteEvent(e.id, this.uid, type).catch(console.error);
  }

  showOnMap(e: EventItem) {
    document.dispatchEvent(new CustomEvent('events:showOnMap', { detail: e }));
  }

  routeTo(e: EventItem) {
    document.dispatchEvent(new CustomEvent('events:routeTo', { detail: e }));
  }

  likedCount = computed(() => this.eventsSig().filter(e => this.isUpvoted(e)).length);
}
