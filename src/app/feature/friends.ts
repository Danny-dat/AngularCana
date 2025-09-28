import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, addDoc, query, where, getDocs, serverTimestamp, writeBatch } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

// Daten-Interfaces
export interface FriendRequest {
  id?: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'declined' | 'removed' | 'blocked';
  participants: string[];
  createdAt: any;
  respondedAt?: any;
  fromDisplayName?: string;
}

export interface PublicProfile {
  id: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  lastLocation?: any;
}

@Injectable({
  providedIn: 'root'
})
export class FriendsService {

  constructor(private firestore: Firestore) { }

  /**
   * Streamt die Liste der Freunde eines Nutzers als Live-Daten.
   */
  getFriends(myUid: string): Observable<PublicProfile[]> {
    const requestsRef = collection(this.firestore, 'friend_requests');
    const q = query(requestsRef, where('participants', 'array-contains', myUid), where('status', '==', 'accepted'));

    return collectionData(q).pipe(
      switchMap(requests => {
        if (requests.length === 0) return of([]);
        
        const friendIds = [...new Set(
          requests.map(r => (r['fromUid'] === myUid ? r['toUid'] : r['fromUid']))
        )];

        if (friendIds.length === 0) return of([]);

        const profilesRef = collection(this.firestore, 'profiles_public');
        // Firestore 'in' Abfragen sind auf 30 Werte pro Abfrage limitiert, daher ggf. aufteilen (chunking)
        const profilesQuery = query(profilesRef, where('__name__', 'in', friendIds.slice(0, 30)));
        
        return collectionData(profilesQuery, { idField: 'id' }) as Observable<PublicProfile[]>;
      })
    );
  }

  /**
   * Streamt die Liste der eingehenden Freundschaftsanfragen.
   */
  getIncomingRequests(myUid: string): Observable<FriendRequest[]> {
    const requestsRef = collection(this.firestore, 'friend_requests');
    const q = query(requestsRef, where('toUid', '==', myUid), where('status', '==', 'pending'));
    return collectionData(q, { idField: 'id' }) as Observable<FriendRequest[]>;
  }

  /**
   * Sendet eine Freundschaftsanfrage.
   */
  async sendFriendRequest(fromUid: string, fromDisplayName: string, toUid: string): Promise<void> {
    if (!fromUid || !toUid) throw new Error('UID fehlt.');
    if (fromUid === toUid) throw new Error('Du kannst dich nicht selbst hinzufügen.');

    // TODO: Füge hier die Logik zur Vermeidung von Duplikaten aus deiner alten JS-Datei ein
    // (Prüfen, ob bereits eine 'pending' oder 'accepted' Anfrage existiert)

    const requestsRef = collection(this.firestore, 'friend_requests');
    const newRequest: Omit<FriendRequest, 'id'> = {
      fromUid,
      toUid,
      fromDisplayName,
      status: 'pending',
      createdAt: serverTimestamp(),
      participants: [fromUid, toUid]
    };
    const requestRef = await addDoc(requestsRef, newRequest);

    // Benachrichtigung erstellen
    const notificationsRef = collection(this.firestore, 'notifications');
    await addDoc(notificationsRef, {
      type: 'friend_request',
      requestId: requestRef.id,
      recipientId: toUid,
      senderId: fromUid,
      message: `${fromDisplayName || 'Jemand'} hat dir eine Freundschaftsanfrage gesendet.`,
      read: false,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Akzeptiert eine Freundschaftsanfrage.
   */
  async acceptRequest(myUid: string, request: FriendRequest): Promise<void> {
    if (!request.id) throw new Error('Request-ID fehlt.');
    const requestRef = doc(this.firestore, `friend_requests/${request.id}`);
    await setDoc(requestRef, { status: 'accepted', respondedAt: serverTimestamp() }, { merge: true });

    // Benachrichtigung an den Absender
    const notificationsRef = collection(this.firestore, 'notifications');
    await addDoc(notificationsRef, {
      type: 'friend_request_accepted',
      requestId: request.id,
      recipientId: request.fromUid,
      senderId: myUid,
      message: 'Deine Freundschaftsanfrage wurde akzeptiert.',
      read: false,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Lehnt eine Freundschaftsanfrage ab.
   */
  async declineRequest(requestId: string): Promise<void> {
    const requestRef = doc(this.firestore, `friend_requests/${requestId}`);
    await setDoc(requestRef, { status: 'declined', respondedAt: serverTimestamp() }, { merge: true });
  }

  /**
   * Entfernt einen Freund.
   */
  async removeFriend(myUid: string, friendUid: string): Promise<void> {
    const requestsRef = collection(this.firestore, 'friend_requests');
    // Diese Abfrage ist in Firestore komplex. Eine einfachere Methode ist, beide Richtungen abzufragen.
    const q1 = query(requestsRef, where('participants', '==', [myUid, friendUid]));
    const q2 = query(requestsRef, where('participants', '==', [friendUid, myUid]));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const batch = writeBatch(this.firestore);
    const docsToUpdate = [...snap1.docs, ...snap2.docs].filter(d => d.data()['status'] === 'accepted');

    if (docsToUpdate.length === 0) throw new Error('Keine bestehende Freundschaft gefunden.');

    docsToUpdate.forEach(docSnap => {
      batch.update(docSnap.ref, { status: 'removed', respondedAt: serverTimestamp() });
    });

    await batch.commit();
  }

  /**
   * Blockiert einen Nutzer.
   */
  async blockFriend(myUid: string, friendUid: string): Promise<void> {
    // Implementierung ähnlich zu removeFriend, aber setzt den Status auf 'blocked'
  }
}