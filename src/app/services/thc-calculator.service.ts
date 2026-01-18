/* istanbul ignore file */
import { Injectable } from '@angular/core';

export type Gender = 'male' | 'female';
export type Frequency = 'once' | 'often' | 'daily';

export interface ThcInput {
  gender: Gender;
  age: number;
  weight: number;        // kg
  bodyFat: number;       // %
  frequency: Frequency;
  amount: number;        // g
  thcPercentage: number; // %
  lastConsumption: string | Date; // ISO oder Date
}

export interface ThcResult {
  value?: number;        // ng/ml
  status?: 'green' | 'orange' | 'red';
  waitTime?: string | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ThcCalculatorService {
  calculate(input: Partial<ThcInput>): ThcResult {
    const { gender, age, weight, bodyFat, frequency, amount, thcPercentage, lastConsumption } = input;

    // Basic checks (wie im alten Projekt – „sinnvolle“ Werte)
    if (
      !lastConsumption ||
      gender !== 'male' && gender !== 'female' ||
      !isFinite(Number(age)) || Number(age) < 18 || Number(age) > 100 ||
      !isFinite(Number(weight)) || Number(weight) < 40 || Number(weight) > 300 ||
      !isFinite(Number(bodyFat)) || Number(bodyFat) < 5 || Number(bodyFat) > 50 ||
      !isFinite(Number(amount)) || Number(amount) <= 0 || Number(amount) > 10 ||
      !isFinite(Number(thcPercentage)) || Number(thcPercentage) <= 0 || Number(thcPercentage) > 100
    ) {
      return { error: 'Bitte alle Felder sinnvoll ausfüllen.' };
    }

    const t0 = new Date(lastConsumption as any);
    if (isNaN(+t0)) return { error: 'Ungültiges Datum/Zeitformat.' };
    const hours = (Date.now() - +t0) / (1000 * 60 * 60);
    if (hours < 0) return { error: 'Der Zeitpunkt des Konsums liegt in der Zukunft.' };

    // Grenzwerte/Parameter (wie vorher)
    const LIMIT_RED = 3.5;         // ng/ml (kritischer Grenzwert)
    const LIMIT_ORANGE = 2.0;      // ng/ml (Warnbereich)
    const BIOAVAILABILITY = 0.25;  // grober Mittelwert

    // mg aufgenommenes THC
    const totalThcMg = Number(amount) * 1000 * (Number(thcPercentage) / 100);
    const absorbedThcMg = totalThcMg * BIOAVAILABILITY;

    // Lean body mass – grobe Annahme: Einfluss von Geschlecht
    // (für „wie vorher“-Gefühl: female etwas niedrigere LBM)
    const bodyFatFrac = Number(bodyFat) / 100;
    const baseLbm = Number(weight) * (1 - bodyFatFrac);
    const genderAdj = gender === 'female' ? 0.92 : 1.0;
    const lbm = baseLbm * genderAdj;
    if (!isFinite(lbm) || lbm <= 0) return { error: 'Körperfett/Gewicht ergeben keine plausible LBM.' };

    // Peak ~ proportional zur Dosis/Verteilung
    const cPeak = (absorbedThcMg / lbm) * 3;

    // Halbwertszeit abhängig von Häufigkeit (wie im alten Modell)
    let baseHalfLife = 20; // h
    if (frequency === 'often') baseHalfLife = 40;
    if (frequency === 'daily') baseHalfLife = 70;

    // mehr Körperfett → längere HWZ
    const halfLife = Math.max(1, baseHalfLife * (1 + (Number(bodyFat) - 20) / 100));
    const k = 0.693 / halfLife;

    // aktuelle Konzentration
    const current = cPeak * Math.exp(-k * hours);
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
