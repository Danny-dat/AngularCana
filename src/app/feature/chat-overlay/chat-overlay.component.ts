import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FriendPublicProfile, ChatMessage } from '../../models/social.models';

type ReportPayload = {
  userId: string;
  messageId?: string;
  text: string;
  reasonCategory: string;
  reasonText?: string | null;
};

@Component({
  standalone: true,
  selector: 'app-chat-overlay',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-overlay.component.html',
  styleUrls: ['./chat-overlay.component.css'],
})
export class ChatOverlayComponent {
  @Input() partner: FriendPublicProfile | null = null;
  @Input() title: string | null = null;
  @Input() myUid: string | null = null;
  @Input() showSender = false;

  @Input() messages: ChatMessage[] = [];
  @Input() text: string | null = null;

  @Output() textChange = new EventEmitter<string>();
  @Output() send = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  // neue Aktionen:
  @Output() addFriend = new EventEmitter<string>(); // userId
  @Output() report = new EventEmitter<ReportPayload>();

  // ─────────────────────────────────────────────
  // Report-Dialog State
  // ─────────────────────────────────────────────
  reportOpen = false;
  reportTarget: ChatMessage | null = null;

  reportReason = 'spam';
  reportNote = '';
  reportError = '';

  readonly reportReasons: Array<{ id: string; label: string }> = [
    { id: 'spam', label: 'Spam / Werbung' },
    { id: 'harassment', label: 'Belästigung / Mobbing' },
    { id: 'hate', label: 'Hass / Hetze' },
    { id: 'misinfo', label: 'Falsche Informationen' },
    { id: 'illegal', label: 'Illegale Inhalte' },
    { id: 'other', label: 'Sonstiges' },
  ];

  onSend() {
    const trimmed = this.text?.trim();
    if (!trimmed) return;
    this.send.emit(trimmed);
    this.text = '';
    this.textChange.emit(this.text);
  }

  isSent(m: ChatMessage): boolean {
    if (this.partner && !this.showSender) {
      return m.senderId !== this.partner.id;
    }
    if (this.myUid) {
      return m.senderId === this.myUid;
    }
    return false;
  }

  displayNameFor(m: ChatMessage): string {
    return (m as any).senderName || m.senderId;
  }

  onAddFriend(m: ChatMessage) {
    if (!this.myUid || m.senderId === this.myUid) return;
    this.addFriend.emit(m.senderId);
  }

  // öffnet Modal statt direkt zu melden
  openReport(m: ChatMessage) {
    if (!this.myUid || m.senderId === this.myUid) return;

    this.reportTarget = m;
    this.reportReason = 'spam';
    this.reportNote = '';
    this.reportError = '';
    this.reportOpen = true;
  }

  cancelReport() {
    this.reportOpen = false;
    this.reportTarget = null;
    this.reportNote = '';
    this.reportError = '';
  }

  confirmReport() {
    if (!this.reportTarget || !this.myUid) return;

    const reason = (this.reportReason || '').trim();
    const note = (this.reportNote || '').trim();

    if (!reason) {
      this.reportError = 'Bitte wähle einen Grund aus.';
      return;
    }

    // "Sonstiges" -> Text Pflicht
    if (reason === 'other' && note.length < 3) {
      this.reportError = 'Bitte gib bei „Sonstiges“ kurz eine Begründung an (mind. 3 Zeichen).';
      return;
    }

    // max Länge (optional)
    if (note.length > 300) {
      this.reportError = 'Der Text ist zu lang (max. 300 Zeichen).';
      return;
    }

    this.report.emit({
      userId: this.reportTarget.senderId,
      messageId: (this.reportTarget as any).id ?? undefined,
      text: this.reportTarget.text,
      reasonCategory: reason,
      reasonText: note ? note : null,
    });

    this.cancelReport();
  }
}
