import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  CollectionReference,
  DocumentData,
} from '@angular/fire/firestore';

import { FriendPublicProfile, FriendRequest, UID } from '../models/social.models';

function pickAllowed<T extends object, K extends keyof T>(
  obj: Partial<T>,
  allowed: K[]
): Partial<T> {
  const out: Partial<T> = {};
  for (const k of allowed) if (k in obj) (out as any)[k] = (obj as any)[k];
  return out;
}
const TS = () => serverTimestamp();

@Injectable({ providedIn: 'root' })
export class FriendsService {
  // AngularFire v17+: inject statt Konstruktor-Param
  private afs = inject(Firestore);

  // nach Initialisierung der afs erzeugen
  private requestsCol!: CollectionReference<DocumentData>;
  private profilesCol!: CollectionReference<DocumentData>;
  private notificationsCol!: CollectionReference<DocumentData>;

  constructor() {
    this.requestsCol = collection(this.afs, 'friend_requests');
    this.profilesCol = collection(this.afs, 'profiles_public');
    this.notificationsCol = collection(this.afs, 'notifications');
  }

  async sendFriendRequest(params: {
    fromUid: UID;
    fromEmail?: string | null;
    fromDisplayName?: string | null;
    toUid: UID;
  }): Promise<void> {
    const { fromUid, toUid, fromEmail = null, fromDisplayName = null } = params;
    if (!fromUid || !toUid) throw new Error('UID fehlt.');
    if (fromUid === toUid) throw new Error('Du kannst dich nicht selbst hinzufügen.');

    // Pending-Duplikate (beide Richtungen) vermeiden
    const pendingA = await getDocs(
      query(
        this.requestsCol,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
      )
    );
    const pendingB = await getDocs(
      query(
        this.requestsCol,
        where('fromUid', '==', toUid),
        where('toUid', '==', fromUid),
        where('status', '==', 'pending')
      )
    );
    if (!pendingA.empty || !pendingB.empty) return;

    // bereits accepted?
    const accA = await getDocs(
      query(
        this.requestsCol,
        where('fromUid', '==', fromUid),
        where('toUid', '==', toUid),
        where('status', '==', 'accepted')
      )
    );
    const accB = await getDocs(
      query(
        this.requestsCol,
        where('fromUid', '==', toUid),
        where('toUid', '==', fromUid),
        where('status', '==', 'accepted')
      )
    );
    if (!accA.empty || !accB.empty) return;

    const ref = await addDoc(this.requestsCol, {
      fromUid,
      toUid,
      fromEmail,
      fromDisplayName,
      status: 'pending',
      createdAt: TS(),
      participants: [fromUid, toUid],
    });

    await addDoc(this.notificationsCol, {
      type: 'friend_request',
      requestId: ref.id,
      recipientId: toUid,
      senderId: fromUid,
      message: `${
        fromDisplayName || fromEmail || 'Jemand'
      } hat dir eine Freundschaftsanfrage gesendet.`,
      read: false,
      timestamp: TS(),
    });
  }

  /** Live: eingehende pending Requests */
  listenIncoming(myUid: UID, cb: (reqs: FriendRequest[]) => void) {
    const q = query(this.requestsCol, where('participants', 'array-contains', myUid));
    return onSnapshot(q, (snap) => {
      const incoming: FriendRequest[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => r.toUid === myUid && r.status === 'pending');
      cb(incoming);
    });
  }

  async fetchIncoming(myUid: UID): Promise<FriendRequest[]> {
    const snap = await getDocs(
      query(this.requestsCol, where('participants', 'array-contains', myUid))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((r) => r.toUid === myUid && r.status === 'pending');
  }

  /** Live: akzeptierte Freunde + Public Profile laden */
  listenFriends(myUid: UID, cb: (friends: FriendPublicProfile[]) => void) {
    const q = query(this.requestsCol, where('participants', 'array-contains', myUid));
    return onSnapshot(q, async (snap) => {
      const accepted = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => r.status === 'accepted');

      const friendIds: string[] = Array.from(
        new Set<string>(accepted.map((r) => (r.fromUid === myUid ? r.toUid : r.fromUid) as string))
      );

      if (!friendIds.length) return cb([]);

      const profiles = await Promise.all(
        friendIds.map(async (id: string) => {
          const psRef = doc(this.profilesCol, id); // doc(collectionRef, id) ✓
          try {
            const ps = await getDoc(psRef);
            return ps.exists() ? (ps.data() as any) : null;
          } catch {
            return null;
          }
        })
      );

      const out: FriendPublicProfile[] = friendIds.map((id, i) => {
        const pub = profiles[i] ?? {};
        const label =
          (pub.username as string | undefined) ||
          (pub.displayName as string | undefined) ||
          (id ? `${id.slice(0, 6)}…` : '');
        return {
          id,
          label,
          displayName: (pub.displayName as string | null) ?? null,
          username: (pub.username as string | null) ?? null,
          photoURL: (pub.photoURL as string | null) ?? null,
          lastLocation: (pub.lastLocation as any) ?? null,
          _action: '',
        };
      });

      cb(out);
    });
  }

  /** Request vollständig schreiben (regelkompatibel) */
  private async safeUpdateRequestFull(docId: string, patch: Partial<FriendRequest>) {
    const ref = doc(this.requestsCol, docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Request existiert nicht mehr.');
    const cur = snap.data() as FriendRequest;

    const full: FriendRequest = {
      fromUid: cur.fromUid,
      toUid: cur.toUid,
      participants: cur.participants,
      createdAt: cur.createdAt ?? TS(),
      status: cur.status,
      respondedAt: cur.respondedAt ?? null,
      ...(pickAllowed(patch, ['status', 'respondedAt']) as any),
      id: docId,
    };

    await setDoc(ref, full as any, { merge: false });
    return { cur, full };
  }

  async accept(myUid: UID, req: FriendRequest) {
    if (req.toUid !== myUid) throw new Error('Nur der Empfänger darf annehmen.');
    await this.safeUpdateRequestFull(req.id, { status: 'accepted', respondedAt: TS() });
    await addDoc(this.notificationsCol, {
      type: 'friend_request_accepted',
      requestId: req.id,
      recipientId: req.fromUid,
      senderId: myUid,
      message: `Deine Freundschaftsanfrage wurde akzeptiert.`,
      read: false,
      timestamp: TS(),
    });
  }

  async decline(myUid: UID, idOrReq: string | FriendRequest) {
    const id = typeof idOrReq === 'string' ? idOrReq : idOrReq.id;
    const { cur } = await this.safeUpdateRequestFull(id, { status: 'declined', respondedAt: TS() });
    try {
      await addDoc(this.notificationsCol, {
        type: 'friend_request_declined',
        requestId: id,
        recipientId: cur.fromUid,
        senderId: myUid,
        message: `Deine Freundschaftsanfrage wurde abgelehnt.`,
        read: false,
        timestamp: TS(),
      });
    } catch {}
  }

  private async findRelationshipDocs(a: UID, b: UID) {
    const snap = await getDocs(query(this.requestsCol, where('participants', 'array-contains', a)));
    return snap.docs.filter((d) => (d.data() as any).participants?.includes(b));
  }

  async remove(myUid: UID, friendUid: UID) {
    const docs = await this.findRelationshipDocs(myUid, friendUid);
    const accepted = docs.filter((d) => (d.data() as any).status === 'accepted');
    if (!accepted.length) throw new Error('Keine bestehende Freundschaft gefunden.');
    for (const d of accepted)
      await this.safeUpdateRequestFull(d.id, { status: 'removed', respondedAt: TS() });
    try {
      await addDoc(this.notificationsCol, {
        type: 'friend_removed',
        requestId: accepted[0].id,
        recipientId: friendUid,
        senderId: myUid,
        message: 'Die Freundschaft wurde beendet.',
        read: false,
        timestamp: TS(),
      });
    } catch {}
  }

  async block(myUid: UID, friendUid: UID) {
    const docs = await this.findRelationshipDocs(myUid, friendUid);
    if (!docs.length) throw new Error('Kein Beziehungs-Dokument gefunden.');
    for (const d of docs)
      await this.safeUpdateRequestFull(d.id, { status: 'blocked', respondedAt: TS() });
  }

  async unblock(myUid: UID, friendUid: UID) {
    const docs = await this.findRelationshipDocs(myUid, friendUid);
    const targets = docs.filter((d) => (d.data() as any).status === 'blocked');
    if (!targets.length) throw new Error('Kein blockiertes Dokument gefunden.');
    for (const d of targets)
      await this.safeUpdateRequestFull(d.id, { status: 'removed', respondedAt: TS() });
  }

  listenBlocked(myUid: string, cb: (ids: string[]) => void) {
    const q = query(this.requestsCol, where('participants', 'array-contains', myUid));

    return onSnapshot(q, (snap) => {
      const blocked: string[] = [];

      snap.docs.forEach((d) => {
        const data = d.data() as any;
        if (data.status === 'blocked') {
          const otherId = data.fromUid === myUid ? data.toUid : data.fromUid;
          if (otherId) blocked.push(otherId);
        }
      });

      cb(blocked);
    });
  }
}
