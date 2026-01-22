// src/app/services/presence.service.ts
import {
  Injectable,
  inject,
  DestroyRef,
  EnvironmentInjector,
  PLATFORM_ID,
  runInInjectionContext,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  CollectionReference,
  DocumentData,
} from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private afs = inject(Firestore);
  private env = inject(EnvironmentInjector);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  private presenceCol: CollectionReference<DocumentData>;

  private heartbeatTimer: any = null;
  private cleanupFns: Array<() => void> = [];
  private startedForUid: string | null = null;

  private static readonly THRESHOLD_MS = 45_000;
  private static readonly HEARTBEAT_MS = 20_000;
  private lastWrite = 0;

  constructor() {
    this.presenceCol = collection(this.afs, 'presence');
  }

  /** eigenen Heartbeat starten (idempotent, nur im Browser) */
  start(myUid: string) {
    if (!this.isBrowser) return;
    if (!myUid || this.startedForUid === myUid) return;

    // ▼▼▼ HIER IST DIE FINALE KORREKTUR ▼▼▼
    // Wir umschließen die gesamte Logik, um alle Firebase-Aufrufe abzudecken.
    runInInjectionContext(this.env, () => {
      this.stop(); // evtl. Altzustand aufräumen
      this.startedForUid = myUid;

      const meRef = doc(this.presenceCol, myUid); // `doc()` ist jetzt im richtigen Kontext

      const writeOnline = async () => {
        // Wir machen die Funktion async
        const now = Date.now();
        if (now - this.lastWrite < 4_000) return;
        this.lastWrite = now;

        try {
          // Die innere runInInjectionContext-Verpackung ist jetzt nicht mehr nötig
          await updateDoc(meRef, { state: 'online', lastActiveAt: serverTimestamp() } as any).catch(
            async () => {
              await setDoc(meRef, { state: 'online', lastActiveAt: serverTimestamp() } as any);
            },
          );
        } catch {
          // still – kann bei Hot-Reload/Offline mal fehlschlagen
        }
      };

      writeOnline();
      this.heartbeatTimer = setInterval(writeOnline, PresenceService.HEARTBEAT_MS);

      const onVis = () => {
        if (document.visibilityState === 'visible') writeOnline();
      };
      document.addEventListener('visibilitychange', onVis, true);

      const onBeforeUnload = () => {
        /* optional: offline markieren */
      };
      window.addEventListener('beforeunload', onBeforeUnload, true);

      this.cleanupFns.push(
        () => document.removeEventListener('visibilitychange', onVis, true),
        () => window.removeEventListener('beforeunload', onBeforeUnload, true),
      );
    });
  }

  /** Heartbeat & Listener zuverlässig stoppen */
  stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    this.cleanupFns = [];
    this.startedForUid = null;
  }

  /**
   * Präsenz für eine Liste von UIDs beobachten.
   * (Dieser Teil war bereits korrekt)
   */
  listen(uids: string[], cb: (onlineIds: string[]) => void): () => void {
    if (!this.isBrowser || !uids?.length) {
      cb([]);
      return () => {};
    }

    const states = new Map<string, { state: string; lastActiveAt?: number }>();
    const unsubs: Array<() => void> = [];

    const emit = () => {
      const now = Date.now();
      const online = [...states.entries()]
        .filter(
          ([_, v]) =>
            v.state === 'online' &&
            v.lastActiveAt != null &&
            now - v.lastActiveAt <= PresenceService.THRESHOLD_MS,
        )
        .map(([uid]) => uid);
      cb(online);
    };

    for (const uid of uids) {
      const ref = doc(this.presenceCol, uid);
      const off = runInInjectionContext(this.env, () =>
        onSnapshot(ref, (snap) => {
          if (!snap.exists()) {
            states.delete(uid);
            emit();
            return;
          }
          const d = snap.data() as any;
          const ts = d?.lastActiveAt?.toMillis ? d.lastActiveAt.toMillis() : undefined;
          states.set(uid, { state: d?.state ?? 'offline', lastActiveAt: ts });
          emit();
        }),
      ) as unknown as () => void;
      unsubs.push(off);
    }

    const tick = setInterval(emit, 10_000);
    unsubs.push(() => clearInterval(tick));

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {}
      });
    };
  }
}
