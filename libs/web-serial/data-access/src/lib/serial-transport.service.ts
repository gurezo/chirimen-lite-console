/// <reference types="@types/w3c-web-serial" />

/**
 * Full rewrite (#606). Pi Zero 向け Web Serial の唯一のセッション境界。
 * `@gurezo/web-serial-rxjs` **v2.3.1** の {@link createSerialSession} / `SerialSession` のみを使用する。
 */
import { Injectable } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  catchError,
  concat,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  EMPTY,
  NEVER,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  getConnectionErrorMessage,
  getWriteErrorMessage,
  RASPBERRY_PI_ZERO_INFO,
} from '@libs-web-serial-util';

@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private active: SerialSession | undefined;

  private readonly sessionSubject = new BehaviorSubject<
    SerialSession | undefined
  >(undefined);

  private whenSession<T>(
    use: (session: SerialSession) => Observable<T>,
    ifNone: Observable<T>,
  ): Observable<T> {
    return this.sessionSubject.pipe(
      switchMap((session) => (session ? use(session) : ifNone)),
    );
  }

  readonly state$ = this.whenSession(
    (s) => s.state$,
    concat(of(SerialSessionState.Idle), NEVER),
  ).pipe(distinctUntilChanged());

  readonly isConnected$ = this.whenSession(
    (s) => s.isConnected$,
    concat(of(false), NEVER),
  ).pipe(distinctUntilChanged());

  readonly lines$ = this.whenSession((s) => s.lines$, NEVER);

  readonly terminalText$ = this.whenSession((s) => s.terminalText$, NEVER);

  get errors$(): Observable<SerialError> {
    return this.whenSession((s) => s.errors$ ?? EMPTY, EMPTY);
  }

  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.whenSession((s) => s.portInfo$ ?? of(null), of(null));
  }

  getPortInfo(): SerialPortInfo | null {
    return this.active?.getPortInfo() ?? null;
  }

  connect$(
    baudRate = 115200,
  ): Observable<{ port: SerialPort } | { error: string }> {
    return defer(() => {
      this.resetSession();
      const created = createSerialSession({
        baudRate,
        filters: [
          {
            usbVendorId: RASPBERRY_PI_ZERO_INFO.usbVendorId,
            usbProductId: RASPBERRY_PI_ZERO_INFO.usbProductId,
          },
        ],
      });
      this.active = created;
      this.sessionSubject.next(created);
      return created.connect$().pipe(
        switchMap(() => {
          const port = created.getCurrentPort();
          if (!port) {
            this.resetSession();
            return of({
              error: getConnectionErrorMessage(
                new Error('Port is not available after connection'),
              ),
            });
          }
          return of({ port });
        }),
        catchError((error) => {
          this.resetSession();
          return of({ error: getConnectionErrorMessage(error) });
        }),
      );
    });
  }

  disconnect$(): Observable<void> {
    return defer(() => {
      if (!this.active) {
        return of(undefined);
      }
      const snapshot = this.active;
      return snapshot.disconnect$().pipe(
        defaultIfEmpty(undefined),
        tap(() => {
          if (this.active === snapshot) {
            this.resetSession();
          }
        }),
        catchError((error) => {
          console.error('Error closing port:', error);
          return throwError(() => error);
        }),
      );
    });
  }

  getPort(): SerialPort | undefined {
    return this.active?.getCurrentPort() ?? undefined;
  }

  send$(data: string): Observable<void> {
    return defer(() => {
      const s = this.active;
      if (!s) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return s.send$(data).pipe(
        catchError((error) =>
          throwError(() => new Error(getWriteErrorMessage(error))),
        ),
      );
    });
  }

  private resetSession(): void {
    this.active = undefined;
    this.sessionSubject.next(undefined);
  }
}
