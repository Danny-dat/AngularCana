import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  CollectionReference,
  DocumentData,
  deleteDoc,
} from '@angular/fire/firestore';

import { FriendPublicProfile, FriendRequest, UID } from '../models/social.models';

function pickAllowed<T extends object, K extends keyof T>(
  obj: Partial<T>,
  allowed: K[],
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of allowed) if (key in obj) (out as any)[key] = (obj as any)[key];
  return out;
}

const TS = () => serverTimestamp();

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private firestore = inject(Firestore);

  private friendRequestsCollection!: CollectionReference<DocumentData>;
  private publicProfilesCollection!: CollectionReference<DocumentData>;
  private notificationsCollection!: CollectionReference<DocumentData>;

  constructor() {
    this.friendRequestsCollection = collection(this.firestore, 'friend_requests');
    this.publicProfilesCollection = collection(this.firestore, 'profiles_public');
    this.notificationsCollection = collection(this.firestore, 'notifications');
  }

  /** Neue Freundschaftsanfrage senden */
  async sendFriendRequest(params: {
    fromUid: UID;
    fromEmail?: string | null;
    fromDisplayName?: string | null;
    toUid: UID;
  }): Promise<void> {
    const { fromUid, toUid, fromEmail = null, fromDisplayName = null } = params;
    if (!fromUid || !toUid) throw new Error('UID fehlt.');
    if (fromUid === toUid) throw new Error('Du kannst dich nicht selbst hinzufügen.');

    // Duplikat-Prüfungen...
    const pendingFromTo = await getDocs(
      query(
        this.friendRequestsCollection,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending'),
      ),
    );
    const pendingToFrom = await getDocs(
      query(
        this.friendRequestsCollection,
        where('fromUid', '==', toUid),
        where('toUid', '==', fromUid),
        where('status', '==', 'pending'),
      ),
    );
    if (!pendingFromTo.empty || !pendingToFrom.empty) return;

    const acceptedFromTo = await getDocs(
      query(
        this.friendRequestsCollection,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'accepted'),
      ),
    );
    const acceptedToFrom = await getDocs(
      query(
        this.friendRequestsCollection,
        where('fromUid', '==', toUid),
        where('toUid', '==', fromUid),
        where('status', '==', 'accepted'),
      ),
    );
    if (!acceptedFromTo.empty || !acceptedToFrom.empty) return;

    // Anfrage und Benachrichtigung erstellen...
    const newRequestRef = await addDoc(this.friendRequestsCollection, {
      fromUid,
      toUid,
      fromEmail,
      fromDisplayName,
      status: 'pending',
      createdAt: TS(),
      participants: [fromUid, toUid],
    });

    await addDoc(this.notificationsCollection, {
      type: 'friend_request',
      requestId: newRequestRef.id,
      recipientId: toUid,
      senderId: fromUid,
      message: `${
        fromDisplayName || fromEmail || 'Jemand'
      } hat dir eine Freundschaftsanfrage gesendet.`,
      read: false,
      timestamp: TS(),
    });
  }

  /** Live-Listener für eingehende pending-Requests */
  listenIncoming(myUid: UID, callback: (reqs: FriendRequest[]) => void) {
    // ▼▼▼ SICHERHEITSPRÜFUNG HINZUGEFÜGT ▼▼▼
    if (!myUid) return () => {}; // Beendet die Funktion sicher, wenn keine UID vorhanden ist.

    const requestsQuery = query(
      this.friendRequestsCollection,
      where('participants', 'array-contains', myUid),
    );
    return onSnapshot(requestsQuery, (snapshot) => {
      const incoming: FriendRequest[] = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }))
        .filter((request) => request.toUid === myUid && request.status === 'pending');
      callback(incoming);
    });
  }

  async fetchIncoming(myUid: UID): Promise<FriendRequest[]> {
    if (!myUid) return []; // Zusätzliche Sicherheitsprüfung
    const requestsSnapshot = await getDocs(
      query(this.friendRequestsCollection, where('participants', 'array-contains', myUid)),
    );
    return requestsSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }))
      .filter((request) => request.toUid === myUid && request.status === 'pending');
  }

  /** Live-Listener für akzeptierte Freunde inkl. Public Profile */
  listenFriends(myUid: UID, callback: (friends: FriendPublicProfile[]) => void) {
    // ▼▼▼ SICHERHEITSPRÜFUNG HINZUGEFÜGT ▼▼▼
    if (!myUid) return () => {};

    const requestsQuery = query(
      this.friendRequestsCollection,
      where('participants', 'array-contains', myUid),
    );
    return onSnapshot(requestsQuery, async (snapshot) => {
      const acceptedRequests = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as any) }))
        .filter((request) => request.status === 'accepted');

      const friendIds = Array.from(
        new Set<string>(
          acceptedRequests.map(
            (req) => (req.fromUid === myUid ? req.toUid : req.fromUid) as string,
          ),
        ),
      );

      if (!friendIds.length) return callback([]);

      const profileSnapshots = await Promise.all(
        friendIds.map(async (friendId: string) => {
          // Die Prüfung hier drin ist wichtig, falls ein Profil gelöscht wurde
          if (!friendId) return null;
          const profileRef = doc(this.publicProfilesCollection, friendId);
          try {
            const profileDoc = await getDoc(profileRef);
            return profileDoc.exists() ? (profileDoc.data() as any) : null;
          } catch {
            return null;
          }
        }),
      );

      const friends: FriendPublicProfile[] = friendIds.map((friendId, index) => {
        const profile = profileSnapshots[index] ?? {};
        const label =
          profile.username || profile.displayName || (friendId ? `${friendId.slice(0, 6)}…` : '');
        return {
          id: friendId,
          label,
          displayName: profile.displayName ?? null,
          username: profile.username ?? null,
          photoURL: profile.photoURL ?? null,
          lastLocation: profile.lastLocation ?? null,
          _action: '',
        };
      });

      callback(friends);
    });
  }

  /** Regelkonformes Update: nur 'status' und 'respondedAt' */
  private async safeUpdateRequest(requestId: string, patch: Partial<FriendRequest>) {
    const requestRef = doc(this.friendRequestsCollection, requestId);
    const payload = pickAllowed(patch, ['status', 'respondedAt']);
    if (!Object.keys(payload).length) throw new Error('Kein gültiges Update.');
    await updateDoc(requestRef, payload as any);
    return payload;
  }

  async accept(myUid: UID, request: FriendRequest) {
    if (request.toUid !== myUid) throw new Error('Nur der Empfänger darf annehmen.');
    await this.safeUpdateRequest(request.id, { status: 'accepted', respondedAt: TS() });
    await addDoc(this.notificationsCollection, {
      type: 'friend_request_accepted',
      requestId: request.id,
      recipientId: request.fromUid,
      senderId: myUid,
      message: `Deine Freundschaftsanfrage wurde akzeptiert.`,
      read: false,
      timestamp: TS(),
    });
  }

  async decline(myUid: UID, requestOrId: string | FriendRequest) {
    const requestId = typeof requestOrId === 'string' ? requestOrId : requestOrId.id;
    await this.safeUpdateRequest(requestId, { status: 'declined', respondedAt: TS() });
    try {
      const requestRef = doc(this.friendRequestsCollection, requestId);
      const currentData = (await getDoc(requestRef)).data() as FriendRequest | undefined;
      if (currentData) {
        await addDoc(this.notificationsCollection, {
          type: 'friend_request_declined',
          requestId,
          recipientId: currentData.fromUid,
          senderId: myUid,
          message: `Deine Freundschaftsanfrage wurde abgelehnt.`,
          read: false,
          timestamp: TS(),
        });
      }
    } catch {}
  }

  private async findRelationshipDocs(userA: UID, userB: UID) {
    const snapshot = await getDocs(
      query(this.friendRequestsCollection, where('participants', 'array-contains', userA)),
    );
    return snapshot.docs.filter((docSnap) => (docSnap.data() as any).participants?.includes(userB));
  }

  async remove(myUid: UID, friendUid: UID) {
    const relationshipDocs = await this.findRelationshipDocs(myUid, friendUid);
    const acceptedDocs = relationshipDocs.filter(
      (docSnap) => (docSnap.data() as any).status === 'accepted',
    );
    if (!acceptedDocs.length) throw new Error('Keine bestehende Freundschaft gefunden.');
    for (const acceptedDoc of acceptedDocs) {
      await this.safeUpdateRequest(acceptedDoc.id, { status: 'removed', respondedAt: TS() });
    }
    try {
      await addDoc(this.notificationsCollection, {
        type: 'friend_removed',
        requestId: acceptedDocs[0].id,
        recipientId: friendUid,
        senderId: myUid,
        message: 'Die Freundschaft wurde beendet.',
        read: false,
        timestamp: TS(),
      });
    } catch {}
  }

  async block(myUid: UID, friendUid: UID) {
    const relationshipDocs = await this.findRelationshipDocs(myUid, friendUid);
    if (!relationshipDocs.length) throw new Error('Kein Beziehungs-Dokument gefunden.');
    for (const docSnap of relationshipDocs) {
      await this.safeUpdateRequest(docSnap.id, { status: 'blocked', respondedAt: TS() });
    }
  }

  async unblock(myUid: UID, friendUid: UID) {
    const relationshipDocs = await this.findRelationshipDocs(myUid, friendUid);
    const blockedDocs = relationshipDocs.filter(
      (docSnap) => (docSnap.data() as any).status === 'blocked',
    );
    if (!blockedDocs.length) throw new Error('Kein blockiertes Dokument gefunden.');
    for (const blockedDoc of blockedDocs) {
      await this.safeUpdateRequest(blockedDoc.id, { status: 'accepted', respondedAt: TS() });
    }
  }

  /** Live-Listener für blockierte Nutzer */
  listenBlocked(myUid: string, callback: (ids: string[]) => void) {
    // ▼▼▼ SICHERHEITSPRÜFUNG HINZUGEFÜGT ▼▼▼
    if (!myUid) return () => {};

    const requestsQuery = query(
      this.friendRequestsCollection,
      where('participants', 'array-contains', myUid),
    );
    return onSnapshot(requestsQuery, (snapshot) => {
      const blockedIds = new Set<string>();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.status === 'blocked') {
          const otherId = data.fromUid === myUid ? data.toUid : data.fromUid;
          if (otherId) blockedIds.add(otherId);
        }
      });
      callback([...blockedIds]);
    });
  }

  /** Blockierte Beziehung endgültig löschen (Hard Delete) */
  async deleteBlocked(myUid: UID, friendUid: UID) {
    const relationshipDocs = await this.findRelationshipDocs(myUid, friendUid);
    const blockedDocs = relationshipDocs.filter((d) => (d.data() as any).status === 'blocked');
    if (!blockedDocs.length) throw new Error('Kein blockiertes Dokument gefunden.');
    for (const d of blockedDocs) {
      await deleteDoc(doc(this.friendRequestsCollection, d.id));
    }
  }

  /** Blockierte als Profile zurückgeben (statt nur IDs) */
  listenBlockedProfiles(myUid: string, callback: (list: FriendPublicProfile[]) => void) {
    // ▼▼▼ SICHERHEITSPRÜFUNG HINZUGEFÜGT ▼▼▼
    if (!myUid) return () => {};

    const q = query(this.friendRequestsCollection, where('participants', 'array-contains', myUid));
    return onSnapshot(q, async (snap) => {
      const idSet = new Set<string>();
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.status === 'blocked') {
          idSet.add(data.fromUid === myUid ? data.toUid : data.fromUid);
        }
      });

      const ids = [...idSet];
      if (!ids.length) return callback([]);

      const profiles = await Promise.all(
        ids.map(async (id) => {
          if (!id) return null; // Zusätzliche Sicherheit
          const ref = doc(this.publicProfilesCollection, id);
          const s = await getDoc(ref);
          const p = s.exists() ? (s.data() as any) : {};
          const label = p.username || p.displayName || `${id.slice(0, 6)}…`;
          const profile: FriendPublicProfile = {
            id,
            label,
            displayName: p.displayName ?? null,
            username: p.username ?? null,
            photoURL: p.photoURL ?? null,
            lastLocation: p.lastLocation ?? null,
            _action: '',
          };
          return profile;
        }),
      );
      // Filtere eventuelle null-Werte heraus
      callback(profiles.filter((p) => p !== null) as FriendPublicProfile[]);
    });
  }

  async getAcceptedFriendIds(myUid: string): Promise<string[]> {
    const snap = await getDocs(
      query(this.friendRequestsCollection, where('participants', 'array-contains', myUid)),
    );
    const ids = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.status === 'accepted') {
        const other = data.fromUid === myUid ? data.toUid : data.fromUid;
        if (other) ids.add(other);
      }
    });
    return [...ids];
  }
}
