// src/main.server.ts
import 'zone.js/node'; // <-- Zone.js für SSR laden (wichtig!)
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { config } from './app/app.config.server';

// SSR: BootstrapContext an Angular durchreichen (v20+)
export default function bootstrap(context: BootstrapContext) {
  return bootstrapApplication(AppComponent, config, context);
}
