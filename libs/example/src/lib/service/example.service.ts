import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExampleJson } from '../models';

@Injectable({
  providedIn: 'root',
})
export class ExampleService {
  http = inject(HttpClient);

  getJsonArray(path: string): Observable<Array<ExampleJson>> {
    return this.http.get<Array<ExampleJson>>(path);
  }
}
