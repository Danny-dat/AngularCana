/* istanbul ignore file */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ThcCalculatorService,
  Gender,
  Frequency,
  ThcInput,
} from '../../services/thc-calculator.service';
import { AdSlotComponent } from '../../components/promo-slot/ad-slot.component';

@Component({
  selector: 'app-thc',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AdSlotComponent],
  templateUrl: './thc.component.html',
  styleUrls: ['./thc.component.css'],
})
export class ThcComponent {
  private fb = inject(NonNullableFormBuilder);
  private calc = inject(ThcCalculatorService);

  result = signal<{
    value?: number;
    status?: 'green' | 'orange' | 'red';
    waitTime?: string | null;
    error?: string;
  } | null>(null);

  form = this.fb.group({
    gender: this.fb.control<Gender>('male'),
    age: this.fb.control(25, [Validators.required, Validators.min(18), Validators.max(100)]),
    weight: this.fb.control(75, [Validators.required, Validators.min(40), Validators.max(300)]),
    bodyFat: this.fb.control(20, [Validators.required, Validators.min(5), Validators.max(50)]),
    frequency: this.fb.control<Frequency>('once'),
    amount: this.fb.control(0.25, [Validators.required, Validators.min(0.01), Validators.max(10)]),
    thcPercentage: this.fb.control(18, [
      Validators.required,
      Validators.min(1),
      Validators.max(100),
    ]),
    lastConsumption: this.fb.control(new Date().toISOString().slice(0, 16)), // yyyy-MM-ddTHH:mm
  });

  submit() {
    const v = this.form.value as Required<ThcInput>; // non-null dank NonNullableFormBuilder
    this.result.set(this.calc.calculate(v));
  }
}
