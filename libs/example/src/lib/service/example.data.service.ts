import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { convertExampleJsonToList } from '../functions';
import { ExampleItem } from '../models';
import { ExampleService } from './example.service';

@Injectable({
  providedIn: 'root',
})
export class ExampleDataService {
  jsonService = inject(ExampleService);

  getGPIOExampleList(): Observable<ExampleItem[]> {
    return this.jsonService.getJsonArray('./assets/json/gpio.json').pipe(
      map((json) => convertExampleJsonToList(json)),
      catchError(() => []),
    );
  }

  getI2CExampleList(): Observable<ExampleItem[]> {
    return this.jsonService.getJsonArray('./assets/json/i2c.json').pipe(
      map((json) => convertExampleJsonToList(json)),
      catchError(() => []),
    );
  }

  getRemoteExampleList(): Observable<ExampleItem[]> {
    return this.jsonService.getJsonArray('./assets/json/remote.json').pipe(
      map((json) => convertExampleJsonToList(json)),
      catchError(() => []),
    );
  }
}
