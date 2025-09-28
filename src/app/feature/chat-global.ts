import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, serverTimestamp, orderBy, query, limit, Timestamp, doc, getDoc } from '@angular/fire/firestore';
import { Observable, combineLatest, of, from } from 'rxjs'; // <-- 'from' HIER HINZUGEFÜGT
import { map, switchMap } from 'rxjs/operators';

// Interface für eine globale Chat-Nachricht
export interface GlobalChatMessage {
  id?: string;
  text: string;
  senderId: string;
  createdAt: Date | Timestamp;
  // Denormalisiertes Feld für die Anzeige:
  senderName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatGlobalService {
  // Einfacher Cache für Anzeigenamen, um wiederholte DB-Abfragen zu vermeiden
  private displayNameCache = new Map<string, string>();

  constructor(private firestore: Firestore) { }

  /**
   * Streamt die Nachrichten des globalen Chats in Echtzeit
   * und reichert sie mit den Anzeigenamen der Absender an.
   */
  getGlobalMessages(messageLimit: number = 200): Observable<GlobalChatMessage[]> {
    const messagesRef = collection(this.firestore, 'global_chat');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(messageLimit));

    return (collectionData(q, { idField: 'id' }) as Observable<GlobalChatMessage[]>).pipe(
      // switchMap ist perfekt, um die Ergebnisse einer Abfrage für eine weitere zu nutzen
      switchMap(messages => {
        if (messages.length === 0) return of([]);

        // Sammle alle eindeutigen Sender-IDs, für die wir noch keinen Namen im Cache haben
        const senderIdsToFetch = [...new Set(messages.map(m => m.senderId))]
            .filter(id => !this.displayNameCache.has(id));

        if (senderIdsToFetch.length === 0) {
            // Alle Namen sind im Cache, wir können die Nachrichten direkt anreichern
            return of(this.enrichMessagesWithSenderName(messages));
        }

        // Für die neuen IDs die Anzeigenamen aus 'profiles_public' holen
        const userProfileObservables = senderIdsToFetch.map(id => 
            from(getDoc(doc(this.firestore, `profiles_public/${id}`)))
        );
        
        return combineLatest(userProfileObservables).pipe(
            map(profileSnaps => {
                profileSnaps.forEach(snap => {
                    if (snap.exists()) {
                        this.displayNameCache.set(snap.id, snap.data()['displayName'] || `User...`);
                    }
                });
                return this.enrichMessagesWithSenderName(messages);
            })
        );
      })
    );
  }

  /**
   * Sendet eine Nachricht in den globalen Chat.
   */
  sendGlobalMessage(fromUid: string, text: string): Promise<any> {
    if (!fromUid || !text?.trim()) return Promise.resolve();
    
    const messagesRef = collection(this.firestore, 'global_chat');
    return addDoc(messagesRef, {
      senderId: fromUid,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  }

  // Private Helper-Funktion zum Anreichern der Nachrichten
  private enrichMessagesWithSenderName(messages: GlobalChatMessage[]): GlobalChatMessage[] {
      return messages.map(msg => ({
          ...msg,
          senderName: this.displayNameCache.get(msg.senderId) || '...',
          createdAt: (msg.createdAt as Timestamp)?.toDate ? (msg.createdAt as Timestamp).toDate() : msg.createdAt
      }));
  }
}