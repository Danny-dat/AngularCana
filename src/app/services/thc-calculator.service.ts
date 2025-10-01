import { Injectable } from '@angular/core';

export type Frequency = 'rare' | 'often' | 'daily';

export interface ThcInput {
  age: number;
  weight: number;        // kg
  bodyFat: number;       // %
  frequency: Frequency;
  amount: number;        // g (Konsum-Menge)
  thcPercentage: number; // %
  lastConsumption: string | Date;
}

export interface ThcResult {
  value?: number;        // ng/ml
  status?: 'green' | 'orange' | 'red';
  waitTime?: string | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ThcCalculatorService {
  calculate(thc: Partial<ThcInput>): ThcResult {
    const {
      age, weight, bodyFat, frequency,
      amount, thcPercentage, lastConsumption
    } = thc || {};

    if (
      !lastConsumption ||
      !isFinite(Number(age)) || Number(age) < 18 || Number(age) > 100 ||
      !isFinite(Number(weight)) || Number(weight) < 40 || Number(weight) > 300 ||
      !isFinite(Number(bodyFat)) || Number(bodyFat) < 3 || Number(bodyFat) > 60 ||
      !isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 10 ||
      !isFinite(Number(thcPercentage)) || Number(thcPercentage) <= 0 || Number(thcPercentage) > 100
    ) {
      return { error: 'Bitte alle Felder sinnvoll ausfüllen.' };
    }

    const t0 = new Date(lastConsumption as any);
    if (isNaN(+t0)) return { error: 'Ungültiges Datum/Zeitformat.' };

    const now = new Date();
    const hours = (Number(now) - Number(t0)) / (1000 * 60 * 60);
    if (hours < 0) return { error: 'Der Zeitpunkt des Konsums liegt in der Zukunft.' };

    const LIMIT_RED = 3.5;         // ng/ml
    const LIMIT_ORANGE = 2.0;      // ng/ml
    const BIOAVAILABILITY = 0.25;  // grober Mittelwert

    const totalThcMg = Number(amount) * 1000 * (Number(thcPercentage) / 100); // g -> mg
    const absorbedThcMg = totalThcMg * BIOAVAILABILITY;

    const lbm = Number(weight) * (1 - (Number(bodyFat) / 100));
    if (!isFinite(lbm) || lbm <= 0) return { error: 'Körperfett/Gewicht ergeben keine plausible LBM.' };

    const cPeakEffective = (absorbedThcMg / lbm) * 3;

    let baseHalfLife = 20; // h
    if (frequency === 'often') baseHalfLife = 40;
    if (frequency === 'daily') baseHalfLife = 70;

    const halfLife = Math.max(1, baseHalfLife * (1 + (Number(bodyFat) - 20) / 100));
    const k = 0.693 / halfLife;

    const current = cPeakEffective * Math.exp(-k * hours);
    const value = Number(current.toFixed(2));

    let status: ThcResult['status'] = 'green';
    let waitTime: string | null = null;

    if (value > LIMIT_RED) {
      status = 'red';
      const hoursToWait = Math.log(current / LIMIT_RED) / k;
      const h = Math.max(0, Math.floor(hoursToWait));
      const m = Math.max(0, Math.round((hoursToWait - h) * 60));
      waitTime = `${h} Stunden und ${m} Minuten`;
    } else if (value >= LIMIT_ORANGE) {
      status = 'orange';
    }

    return { value, status, waitTime };
  }
}
