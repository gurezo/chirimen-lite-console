import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, map, Observable, of } from 'rxjs';
import { convertExampleJsonToList, splitDeviceExamplesByInterface } from '../functions';
import { DeviceCatalogState, ExampleItem } from '../models';
import { DeviceCatalogService } from './device-catalog.service';
import { ExampleService } from './example.service';

@Injectable({
  providedIn: 'root',
})
export class ExampleDataService {
  jsonService = inject(ExampleService);
  private catalog = inject(DeviceCatalogService);

  private readonly catalogLists$ = toObservable(this.catalog.state).pipe(
    filter(
      (
        state,
      ): state is Extract<
        DeviceCatalogState,
        { status: 'success' | 'error' }
      > => state.status === 'success' || state.status === 'error',
    ),
    map((state) => {
      if (state.status === 'error') {
        throw new Error(state.message);
      }
      return splitDeviceExamplesByInterface(state.devices);
    }),
  );

  getGPIOExampleList(): Observable<ExampleItem[]> {
    this.catalog.load();
    return this.catalogLists$.pipe(map((lists) => lists.gpio));
  }

  getI2CExampleList(): Observable<ExampleItem[]> {
    this.catalog.load();
    return this.catalogLists$.pipe(map((lists) => lists.i2c));
  }

  /**
   * Remote examples stay on `remote.json` for now.
   * certified-devices `remote-connection` is not the Pi Zero wget path,
   * and current ids such as `remote_gpio_led` are not in devices.json.
   * Cleanup is Issue #852.
   */
  getRemoteExampleList(): Observable<ExampleItem[]> {
    return this.jsonService.getJsonArray('./assets/json/remote.json').pipe(
      map((json) => convertExampleJsonToList(json)),
      catchError(() => of([])),
    );
  }
}
