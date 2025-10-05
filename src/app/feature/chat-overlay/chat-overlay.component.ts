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
  @Output() report = new EventEmitter<{ userId: string; messageId?: string; text: string }>();

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

  onReport(m: ChatMessage) {
    if (!this.myUid || m.senderId === this.myUid) return;
    this.report.emit({ userId: m.senderId, messageId: (m as any).id, text: m.text });
  }
}
