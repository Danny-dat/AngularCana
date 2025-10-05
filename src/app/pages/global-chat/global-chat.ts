import { Component, inject, signal, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import { ChatService } from '../../services/chat.services';
import { ChatOverlayComponent } from '../../feature/chat-overlay/chat-overlay.component';

@Component({
  standalone: true,
  selector: 'app-global-chat-page',
  imports: [CommonModule, ChatOverlayComponent],
  templateUrl: './global-chat.html',
  styleUrls: ['./global-chat.css'], // optional
})
export class GlobalChatPage implements AfterViewInit, OnDestroy {
  private auth = inject(Auth);
  private chat = inject(ChatService);

  readonly channelId = 'global';

  // State
  uid = signal<string>('');            // ← eigene UID als Signal
  messages = signal<any[]>([]);
  text = signal('');

  private unlisten: (() => void) | null = null;
  private offAuth: (() => void) | null = null;

  constructor() {
    // Auth-Status beobachten → uid setzen
    this.offAuth = onAuthStateChanged(this.auth, (u: User | null) => {
      this.uid.set(u?.uid ?? '');
    });
  }

  async ngAfterViewInit() {
    // Channel sicherstellen (legt/merged chats/global)
    await this.chat.ensureChannel(this.channelId, 'Globaler Chat');

    // Nachrichten streamen
    this.unlisten = this.chat.listenMessages(this.channelId, (msgs) => {
      this.messages.set(msgs);
      // autoscroll ans Ende (gleicher IDs wie im Overlay)
      setTimeout(() => {
        const el = document.getElementById('chatMessages');
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnDestroy() {
    this.unlisten?.();
    this.unlisten = null;
    this.offAuth?.();
    this.offAuth = null;
  }

  async onSend(text: string) {
    const body = (text || '').trim();
    const me = this.uid();
    if (!body) return;

    if (!me) {
      console.warn('Kein eingeloggter Benutzer – Nachricht nicht gesendet.');
      // Optional: user feedback
      // alert('Bitte zuerst einloggen, um zu senden.');
      return;
    }

    try {
      await this.chat.sendGroup({
        fromUid: me,
        chatId: this.channelId,
        text: body,
      });
      this.text.set('');
    } catch (err) {
      console.error('Senden fehlgeschlagen:', err);
      // Optional: user feedback
      // alert('Nachricht konnte nicht gesendet werden.');
    }
  }

  close() {
    // Globaler Chat ist eine Seite – beim "X" zurück
    history.back();
  }
}
