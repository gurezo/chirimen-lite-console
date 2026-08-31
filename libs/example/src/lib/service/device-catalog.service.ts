import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, take } from 'rxjs';
import { toDeviceExampleViewModels } from '../functions';
import {
  CERTIFIED_DEVICES_JSON_FALLBACK_URL,
  CERTIFIED_DEVICES_JSON_URL,
  type CertifiedDevicesDocument,
  type DeviceCatalogState,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DeviceCatalogService {
  private readonly http = inject(HttpClient);
  readonly state = signal<DeviceCatalogState>({ status: 'idle' });
  private inFlight = false;

  /**
   * Fetches devices.json once per session. Re-entering Example does not refetch.
   * Use {@link retry} after an error.
   */
  load(): void {
    if (this.state().status !== 'idle') {
      return;
    }
    this.fetch();
  }

  retry(): void {
    if (this.inFlight) {
      return;
    }
    this.fetch();
  }

  private fetch(): void {
    this.inFlight = true;
    this.state.set({ status: 'loading' });
    this.http
      .get<CertifiedDevicesDocument>(CERTIFIED_DEVICES_JSON_URL)
      .pipe(
        catchError(() =>
          this.http.get<CertifiedDevicesDocument>(
            CERTIFIED_DEVICES_JSON_FALLBACK_URL,
          ),
        ),
        map((document) => toDeviceExampleViewModels(document)),
        take(1),
      )
      .subscribe({
        next: (devices) => {
          this.inFlight = false;
          this.state.set({ status: 'success', devices });
        },
        error: () => {
          this.inFlight = false;
          this.state.set({
            status: 'error',
            message: 'Unable to load device examples.',
          });
        },
      });
  }
}
