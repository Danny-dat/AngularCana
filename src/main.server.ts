import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app'; // <-- Korrigiert von 'App' zu 'AppComponent'
import { config } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, config); // <-- Korrigiert

export default bootstrap;