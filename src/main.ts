import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import 'zone.js';
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));