import { Injectable } from '@angular/core';
import { Firestore, doc, setDoc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';
import { Unsubscribe } from '@angular/fire/auth';
import { collectionData, query, collection, where, onSnapshot } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Interface für die Daten in der "presence" Collection
export interface Presence {
  heartbeatAt: any;
  lastSeenAt: any;
  activeGlobalChat?: boolean;
  activeChatId?: string | null;
  displayName?: string; // Denormalisiert für einfachere Abfragen
}

export interface OnlineUser {
    id: string;
    displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class PresenceService {
  private heartbeatTimer: any = null;
  private uid: string | null = null;

  constructor(private firestore: Firestore) { }

  /**
   * Startet einen periodischen Heartbeat, um den Nutzer als "online" zu markieren.
   * @param uid Die ID des angemeldeten Nutzers.
   * @param displayName Der Anzeigename des Nutzers zur Denormalisierung.
   * @param everyMs Das Intervall in Millisekunden (z.B. 15000 für 15 Sekunden).
   */
  startPresenceHeartbeat(uid: string, displayName: string, everyMs: number = 15000): void {
    this.stopPresenceHeartbeat(); // Sicherstellen, dass kein alter Timer läuft
    if (!uid) return;

    this.uid = uid;
    const presenceRef = doc(this.firestore, `presence/${this.uid}`);

    const beat = () => {
      const data: Presence = {
        heartbeatAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        displayName: displayName
      };
      setDoc(presenceRef, data, { merge: true })
        .catch(e => console.warn("[Presence] Heartbeat failed:", e));
    };

    beat(); // Sofortiger erster Beat
    this.heartbeatTimer = setInterval(beat, everyMs);
  }

  /**
   * Stoppt den Heartbeat und entfernt den Nutzer aus der "presence" Collection.
   */
  async stopPresenceHeartbeat(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (!this.uid) return;
    const presenceRef = doc(this.firestore, `presence/${this.uid}`);
    try {
      await deleteDoc(presenceRef); // Nutzer sofort als offline markieren
    } catch (e) {
      console.warn("[Presence] Deleting presence failed:", e);
    } finally {
      this.uid = null;
    }
  }

  /**
   * Markiert, ob ein Nutzer gerade im globalen Chat aktiv ist.
   */
  setGlobalChatActive(uid: string, isActive: boolean): Promise<void> {
    if (!uid) return Promise.resolve();
    const presenceRef = doc(this.firestore, `presence/${uid}`);
    return setDoc(presenceRef, {
      activeGlobalChat: isActive,
      heartbeatAt: serverTimestamp() // Heartbeat aktualisieren
    }, { merge: true });
  }

  /**
   * Streamt die Liste der Nutzer, die im globalen Chat aktiv sind.
   * @param thresholdSeconds Wie "alt" ein Heartbeat maximal sein darf.
   */
  listenForOnlineUsers(thresholdSeconds: number = 20): Observable<OnlineUser[]> {
      const presenceRef = collection(this.firestore, 'presence');
      // Wir filtern clientseitig, da Zeit-basierte Abfragen in Firestore komplex sind
      const q = query(presenceRef, where('activeGlobalChat', '==', true));

      return collectionData(q, { idField: 'id' }).pipe(
          map(users => {
              const now = Date.now();
              return users
                  .filter(user => {
                      const heartbeat = user['heartbeatAt']?.toDate();
                      if (!heartbeat) return false;
                      return (now - heartbeat.getTime()) / 1000 <= thresholdSeconds;
                  })
                  .map(user => ({
                      id: user['id'],
                      displayName: user['displayName'] || `User...`
                  }));
          })
      );
  }
}