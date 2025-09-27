import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app'; // <-- Korrigiert von 'App' zu 'AppComponent'
import 'zone.js'; // <-- Zone.js laden (wichtig!)

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));