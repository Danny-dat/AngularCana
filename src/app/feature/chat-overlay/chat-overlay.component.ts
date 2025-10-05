import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FriendPublicProfile, ChatMessage } from '../../models/social.models';

@Component({
  standalone: true,
  selector: 'app-chat-overlay',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-overlay.component.html',
  styleUrls: ['./chat-overlay.component.css'],
})
export class ChatOverlayComponent {
  /** Direktchat-Partner (optional im Global/Channel-Modus) */
  @Input() partner: FriendPublicProfile | null = null;

  /** Optionaler Titel (z. B. "Globaler Chat"); überschreibt Partner/Fallback */
  @Input() title: string | null = null;

  /** Eigene UID, damit die Bubble-Ausrichtung im Global/Channel stimmt */
  @Input() myUid: string | null = null;

  /** Absender oberhalb der Bubble anzeigen (für Global/Channel empfehlenswert) */
  @Input() showSender = false;

  @Input() messages: ChatMessage[] = [];
  @Input() text: string | null = null;

  @Output() textChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  onSend() {
    const trimmed = this.text?.trim();
    if (!trimmed) return;
    this.send.emit(trimmed);
    this.text = '';
    this.textChange.emit(this.text);
  }

  /** Bestimmt, ob eine Bubble als "sent" (rechts) gerendert wird */
  isSent(m: ChatMessage): boolean {
    // Direktchat: "sent", wenn Nachricht NICHT vom Partner kommt (also von mir)
    if (this.partner && !this.showSender) {
      return m.senderId !== this.partner.id;
    }
    // Global/Channel: "sent", wenn Nachricht von mir kommt
    if (this.myUid) {
      return m.senderId === this.myUid;
    }
    return false;
  }

  /** Anzeige-Name für Sender (fällt zurück auf senderId) */
  displayNameFor(m: ChatMessage): string {
    return (m as any).senderName || m.senderId;
  }
}
