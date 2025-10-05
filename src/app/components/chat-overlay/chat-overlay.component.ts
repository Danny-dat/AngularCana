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
}
