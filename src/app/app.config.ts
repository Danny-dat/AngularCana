import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms'; // <-- Wichtig für Formulare

import { routes } from './app.routes'; // <-- Importiere unsere Routen

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), // <-- Stellt den Router mit unseren Routen bereit
    importProvidersFrom(FormsModule) // <-- Macht [(ngModel)] etc. verfügbar
  ]
};