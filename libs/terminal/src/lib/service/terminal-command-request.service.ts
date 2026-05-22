import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Lets other features (e.g. toolbar) ask the terminal to run a shell command
 * using the same serial path as interactive input (SerialFacadeService `send$`, issue #615).
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalCommandRequestService {
  private readonly requestsSubject = new Subject<string>();

  readonly commandRequests$: Observable<string> =
    this.requestsSubject.asObservable();

  requestCommand(command: string): void {
    this.requestsSubject.next(command);
  }
}
