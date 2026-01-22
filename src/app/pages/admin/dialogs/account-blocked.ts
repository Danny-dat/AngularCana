/* istanbul ignore file */
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { Auth, user } from '@angular/fire/auth';
import { Firestore,addDoc, collection, doc, getDoc, serverTimestamp, Timestamp } from '@angular/fire/firestore';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type BanDoc = {
  type: 'ban' | 'lock';
  until?: any | null; // Timestamp | null
  reason?: string;
  createdAt?: any;
  createdBy?: string;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="wrap">
      <mat-card class="card">
        <div class="head">
          <mat-icon class="ic">block</mat-icon>
          <div>
            <h2>Zugriff gesperrt</h2>
            <div class="sub">Dein Account ist aktuell gesperrt oder gebannt.</div>
          </div>
        </div>

        <div class="info" *ngIf="loaded; else loadingTpl">
          <ng-container *ngIf="uid; else notLoggedTpl">
            <div class="grid">
              <div class="row">
                <div class="lbl">Status</div>
                <div class="val">
                  <span class="pill" [class.ban]="ban?.type==='ban'" [class.lock]="ban?.type==='lock'">
                    {{ statusLabel() }}
                  </span>
                </div>
              </div>

              <div class="row">
                <div class="lbl">Dauer</div>
                <div class="val">{{ untilLabel() }}</div>
              </div>

              <div class="row">
                <div class="lbl">Grund</div>
                <div class="val">{{ reasonLabel() }}</div>
              </div>
            </div>

            <div class="hint">
              Wenn du denkst, dass das ein Fehler ist, kannst du hier direkt ein Ticket erstellen.
            </div>

            <div class="actions">
              <button mat-stroked-button routerLink="/">
                <mat-icon>home</mat-icon>
                Startseite
              </button>
              <button mat-stroked-button routerLink="/login">
                <mat-icon>login</mat-icon>
                Zum Login
              </button>
              <button mat-flat-button color="primary" (click)="showForm = !showForm">
                <mat-icon>report</mat-icon>
                Ticket erstellen
              </button>
            </div>

            <div class="form" *ngIf="showForm">
              <mat-form-field appearance="outline" class="full">
                <mat-label>Nachricht an den Support / Admin</mat-label>
                <textarea matInput rows="5" [formControl]="form.controls.message"></textarea>
                <mat-hint>Bitte kurz beschreiben, warum du glaubst, dass die Sperre ein Fehler ist.</mat-hint>
              </mat-form-field>

              <div class="form-actions">
                <button mat-button (click)="showForm=false">Abbrechen</button>
                <button mat-flat-button color="primary" [disabled]="form.invalid || submitting" (click)="submit()">
                  {{ submitting ? 'Senden…' : 'Senden' }}
                </button>
              </div>
            </div>
          </ng-container>
        </div>

        <ng-template #loadingTpl>
          <div class="hint">Lade Infos…</div>
        </ng-template>

        <ng-template #notLoggedTpl>
          <div class="hint">
            Du bist aktuell nicht eingeloggt. Bitte logge dich ein, um Details zu sehen oder ein Ticket zu erstellen.
          </div>
          <div class="actions">
            <button mat-flat-button color="primary" routerLink="/login">
              <mat-icon>login</mat-icon>
              Zum Login
            </button>
          </div>
        </ng-template>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap {
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .card {
        width: min(640px, 96vw);
        padding: 18px;
      }

      .head {
        display: flex;
        gap: 12px;
        align-items: center;
        margin-bottom: 10px;
      }

      .ic {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      h2 {
        margin: 0;
      }

      .sub {
        opacity: 0.75;
        font-size: 13px;
        margin-top: 2px;
      }

      .grid {
        display: grid;
        gap: 10px;
        margin: 12px 0 14px 0;
      }

      .row {
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 10px;
        align-items: start;
      }

      .lbl {
        font-size: 12px;
        opacity: 0.7;
      }

      .val {
        word-break: break-word;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        background: rgba(0, 0, 0, 0.06);
      }

      .pill.ban {
        background: rgba(220, 38, 38, 0.12);
      }
      .pill.lock {
        background: rgba(245, 158, 11, 0.14);
      }

      .hint {
        opacity: 0.8;
        margin: 8px 0 14px 0;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .form {
        margin-top: 14px;
        display: grid;
        gap: 10px;
      }
      .full {
        width: 100%;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      @media (max-width: 520px) {
        .row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AccountBlockedComponent {
  private auth = inject(Auth);
  private fs = inject(Firestore);
  private snack = inject(MatSnackBar);

  uid: string | null = null;
  ban: BanDoc | null = null;

  loaded = false;
  showForm = false;
  submitting = false;

  form = new FormGroup({
    message: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)],
    }),
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const u = await firstValueFrom(user(this.auth));
      this.uid = u?.uid ?? null;
      if (this.uid) {
        // best effort: Grund/Dauer laden
        const snap = await getDoc(doc(this.fs as any, 'banlist', this.uid));
        this.ban = snap.exists() ? (snap.data() as any as BanDoc) : null;
      }
    } catch {
      // ignore – Seite bleibt nutzbar
      this.ban = null;
    } finally {
      this.loaded = true;
    }
  }

  statusLabel(): string {
    if (!this.ban?.type) return 'Gesperrt';
    return this.ban.type === 'ban' ? 'Gebannt' : 'Gesperrt';
  }

  reasonLabel(): string {
    const r = (this.ban?.reason ?? '').toString().trim();
    return r || '—';
  }

  private asDate(x: any): Date | null {
    if (!x) return null;
    if (x instanceof Date) return x;
    if (x instanceof Timestamp) return x.toDate();
    if (typeof x?.toDate === 'function') return x.toDate();
    const d = new Date(String(x));
    return isNaN(d.getTime()) ? null : d;
  }

  untilLabel(): string {
    // ban/lock doc: until null => permanent
    const until = this.asDate(this.ban?.until);
    if (!this.ban) return '—';
    if (!this.ban.until) return 'Permanent';
    return until ? until.toLocaleString('de-DE') : '—';
  }

  async submit(): Promise<void> {
    if (!this.uid) return;
    if (this.form.invalid) return;

    this.submitting = true;
    try {
      const msg = this.form.controls.message.value.trim();
      const ban = this.ban;

      await addDoc(collection(this.fs as any, 'reports'), {
        createdAt: serverTimestamp(),
        status: 'new',
        scope: 'account',
        reporterId: this.uid,
        reportedId: this.uid,
        reasonCategory: 'appeal',
        reasonText: 'Account gesperrt/gebann - Ticket',
        messageText: msg,
        chatId: null,
        messageId: null,
        meta: {
          blockType: ban?.type ?? null,
          blockReason: (ban?.reason ?? '').toString().trim() || null,
          blockUntil: ban?.until ?? null,
        },
      });

      this.snack.open('Ticket erstellt. Ein Admin schaut sich das an.', 'OK', { duration: 4500 });
      this.form.reset({ message: '' });
      this.showForm = false;
    } catch {
      this.snack.open('Ticket konnte nicht erstellt werden (Rules/Permissions?)', 'OK', { duration: 4500 });
    } finally {
      this.submitting = false;
    }
  }
}
