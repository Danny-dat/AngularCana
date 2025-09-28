import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, setDoc, serverTimestamp, orderBy, query, limit, Timestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Interface für eine saubere Datenstruktur
export interface ChatMessage {
  id?: string;
  text: string;
  senderId: string;
  recipientId: string;
  createdAt: Date | Timestamp; // Kann ein JS Date oder ein Firestore Timestamp sein
  readBy: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  constructor(private firestore: Firestore) { }

  /**
   * Erstellt eine eindeutige und sortierte ID für einen Chat zwischen zwei Nutzern.
   */
  chatIdFor(a: string, b: string): string {
    return [a, b].sort().join("_");
  }

  /**
   * Streamt die Nachrichten eines Chats in Echtzeit.
   * @param chatId Die ID des Chats.
   * @param messageLimit Die maximale Anzahl der zu ladenden Nachrichten.
   */
  getChatMessages(chatId: string, messageLimit: number = 200): Observable<ChatMessage[]> {
    const messagesRef = collection(this.firestore, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(messageLimit));
    
    // collectionData streamt die Daten und fügt die Dokument-ID hinzu
    return (collectionData(q, { idField: 'id' }) as Observable<ChatMessage[]>).pipe(
      map(messages => messages.map(msg => {
        // Firestore Timestamps in JS Date-Objekte umwandeln für einfachere Anzeige
        const timestamp = msg.createdAt as Timestamp;
        return { ...msg, createdAt: timestamp?.toDate ? timestamp.toDate() : msg.createdAt };
      }))
    );
  }

  /**
   * Sendet eine neue Chat-Nachricht.
   */
  async sendChatMessage(fromUid: string, toUid: string, text: string): Promise<void> {
    const body = (text || "").trim();
    if (!fromUid || !toUid || !body) return;

    const chatId = this.chatIdFor(fromUid, toUid);
    
    // 1. Sicherstellen, dass das Chat-Hauptdokument existiert
    const chatRef = doc(this.firestore, `chats/${chatId}`);
    await setDoc(chatRef, { 
      participants: [fromUid, toUid], 
      updatedAt: serverTimestamp() 
    }, { merge: true });

    // 2. Die neue Nachricht in die Sub-Collection 'messages' schreiben
    const messagesRef = collection(chatRef, 'messages');
    await addDoc(messagesRef, {
      text: body,
      senderId: fromUid,
      recipientId: toUid,
      createdAt: serverTimestamp(),
      readBy: [fromUid],
    });

    // 3. Das Hauptdokument mit der letzten Nachricht aktualisieren (für Chat-Übersichten)
    await setDoc(chatRef, {
      lastMessage: body,
      lastSenderId: fromUid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // 4. Benachrichtigung für den Empfänger erstellen
    const notificationsRef = collection(this.firestore, 'notifications');
    await addDoc(notificationsRef, {
        type: "chat_message",
        chatId: chatId,
        recipientId: toUid,
        senderId: fromUid,
        message: body.length > 80 ? body.slice(0, 80) + "…" : body,
        read: false,
        timestamp: serverTimestamp(),
    });
  }
}
