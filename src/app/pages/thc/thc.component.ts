import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ThcCalculatorService, Frequency, ThcInput } from '../../services/thc-calculator.service';

@Component({
  selector: 'app-thc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './thc.component.html',
  styleUrls: ['./thc.component.css'],
})
export class ThcComponent {
  private fb = inject(FormBuilder);
  private calc = inject(ThcCalculatorService);

  result = signal<{ value?: number; status?: string; waitTime?: string | null; error?: string } | null>(null);

  form = this.fb.group({
    age: [25, [Validators.required, Validators.min(18), Validators.max(100)]],
    weight: [75, [Validators.required, Validators.min(40), Validators.max(300)]],
    bodyFat: [20, [Validators.required, Validators.min(3), Validators.max(60)]],
    frequency: ['rare' as Frequency, Validators.required],
    amount: [0.25, [Validators.required, Validators.min(0.01), Validators.max(10)]], // g
    thcPercentage: [18, [Validators.required, Validators.min(1), Validators.max(100)]],
    lastConsumption: [new Date().toISOString().slice(0,16), Validators.required], // lokal ISO yyyy-MM-ddTHH:mm
  });

  submit() {
    const v = this.form.value; // enthält number | null
    const input: Partial<ThcInput> = {
      age:            v.age ?? undefined,
      weight:         v.weight ?? undefined,
      bodyFat:        v.bodyFat ?? undefined,
      frequency:      (v.frequency ?? undefined) as ThcInput['frequency'],
      amount:         v.amount ?? undefined,
      thcPercentage:  v.thcPercentage ?? undefined,
      lastConsumption:v.lastConsumption ?? undefined,
    };
    this.result.set(this.calc.calculate(input));
  }
}
