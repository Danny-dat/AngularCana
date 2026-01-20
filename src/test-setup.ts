// Globaler Test-Setup-Code (wird vor allen Specs ausgeführt)

import { getApp, getApps } from 'firebase/app';
import { disableNetwork, getFirestore as getFirestoreNative } from 'firebase/firestore';

declare const jasmine: any;

// ✅ Jasmine Konfig – deterministische Reihenfolge + respy
try {
  jasmine.getEnv().configure({ random: false });
  jasmine.getEnv().allowRespy(true);
} catch {}

// ✅ löscht gespeicherte Jasmine-UI-Optionen (damit Checkbox nicht direkt wieder an ist)
try {
  Object.keys(localStorage)
    .filter((k) => k.toLowerCase().includes('jasmine'))
    .forEach((k) => localStorage.removeItem(k));
} catch {}

// ✅ verhindert echte Reloads/Redirects in Karma (einige Flows nutzen window.location.*)
try {
  spyOn(window.location, 'reload').and.callFake(() => void 0);
  spyOn(window.location, 'assign').and.callFake(() => void 0);
  spyOn(window.location, 'replace').and.callFake(() => void 0);
} catch {
  // manche Browser blocken location mocking
}

// ✅ matchMedia Stub (wird oft für prefers-color-scheme genutzt)
try {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => {
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => void 0,
        removeListener: () => void 0,
        addEventListener: () => void 0,
        removeEventListener: () => void 0,
        dispatchEvent: () => false,
      };
    };
  }
} catch {}

// ✅ Firestore: keine echten Netzwerk-Calls in Unit-Tests
try {
  const app = getApps().length ? getApp() : null;
  if (app) {
    const fs = getFirestoreNative(app);
    disableNetwork(fs).catch(() => void 0);
  }
} catch {}
