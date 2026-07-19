import {
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Injector } from '@angular/core';
import {
  BehaviorSubject,
  EMPTY,
  type Observable,
  firstValueFrom,
  of,
  Subject,
  take,
} from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialTransportService } from './serial-transport.service';

/** Vitest 4 の `vi.fn<Args, R>()` は非推奨のため、実装から型を載せる */
const mockCreateSerialSession = vi.fn((): SerialSession => {
  throw new Error('mockCreateSerialSession: call mockReturnValue in the test');
});

vi.mock('@gurezo/web-serial-rxjs', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gurezo/web-serial-rxjs')>();
  return {
    ...actual,
    createSerialSession: () => mockCreateSerialSession(),
  };
});

function buildMockSession(
  portInfo: SerialPortInfo | null,
  lines$?: Observable<string>,
  terminalText$?: Observable<string>,
  receive$?: Observable<string>,
): SerialSession {
  const state$ = new BehaviorSubject<SerialSessionState>({
    status: SerialSessionStatus.Connecting,
  });
  const isConnected$ = new BehaviorSubject(false);
  const getPortInfo = vi.fn((): SerialPortInfo | null => portInfo);
  return {
    isBrowserSupported: () => true,
    connect$: vi.fn(() => {
      state$.next({
        status: SerialSessionStatus.Connected,
        portInfo: portInfo ?? ({} as SerialPortInfo),
      });
      isConnected$.next(true);
      if (portInfo) {
        getPortInfo.mockReturnValue(portInfo);
      }
      return of(undefined);
    }),
    disconnect$: vi.fn(() => {
      state$.next({ status: SerialSessionStatus.Idle });
      isConnected$.next(false);
      getPortInfo.mockReturnValue(null);
      return of(undefined);
    }),
    state$: state$.asObservable(),
    isConnected$: isConnected$.asObservable(),
    portInfo$: of(null),
    getPortInfo,
    errors$: EMPTY,
    receive$: receive$ ?? EMPTY,
    receiveReplay$: EMPTY,
    lines$: lines$ ?? of('line1'),
    terminalText$: terminalText$ ?? of('terminal-line'),
    send$: vi.fn(() => of(undefined)),
  } as unknown as SerialSession;
}

describe('SerialTransportService', () => {
  let service: SerialTransportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = Injector.create({
      providers: [SerialTransportService],
    }).get(SerialTransportService);
  });

  it('should expose idle / not connected before any session is created', () => {
    expect(service.state().status).toBe(SerialSessionStatus.Idle);
    expect(service.isConnected()).toBe(false);
    expect(service.getPortInfo()).toBeNull();
  });

  it('should delegate state and isConnected to SerialSession after connect', async () => {
    const portInfo: SerialPortInfo = {
      usbVendorId: 0x0525,
      usbProductId: 0xa4a7,
    };
    const session = buildMockSession(portInfo);
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());

    expect(service.state().status).toBe(SerialSessionStatus.Connected);
    expect(service.isConnected()).toBe(true);
    expect(service.getPortInfo()).toEqual(portInfo);
    expect(session.connect$).toHaveBeenCalledTimes(1);
  });

  it('should clear session and return to idle after disconnect', async () => {
    const portInfo: SerialPortInfo = {
      usbVendorId: 0x0525,
      usbProductId: 0xa4a7,
    };
    mockCreateSerialSession.mockReturnValue(buildMockSession(portInfo));

    await firstValueFrom(service.connect$());
    expect(service.isConnected()).toBe(true);

    await firstValueFrom(service.disconnect$());

    expect(service.state().status).toBe(SerialSessionStatus.Idle);
    expect(service.isConnected()).toBe(false);
    expect(service.getPortInfo()).toBeNull();
  });

  it('should expose errors from the active session when connected', async () => {
    const err = new SerialError(SerialErrorCode.READ_FAILED, 'read');
    const errSubj = new BehaviorSubject(err);
    const session = buildMockSession({} as SerialPortInfo);
    (
      session as unknown as { errors$: Observable<SerialError> }
    ).errors$ = errSubj.asObservable();
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());
    expect(service.errors()).toBe(err);
  });

  it('should update lines when session is active', async () => {
    mockCreateSerialSession.mockReturnValue(buildMockSession({} as SerialPortInfo));

    await firstValueFrom(service.connect$());
    await vi.waitFor(() => {
      expect(service.lines()).toBe('line1');
    });
  });

  it('lines should reflect session lines$ emissions', async () => {
    const lineSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession({} as SerialPortInfo, lineSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());
    queueMicrotask(() => lineSubject.next('expected-line'));
    await vi.waitFor(() => {
      expect(service.lines()).toBe('expected-line');
    });
  });

  it('should emit receive$ from session receive$', async () => {
    const chunkSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(
        {} as SerialPortInfo,
        undefined,
        undefined,
        chunkSubject.asObservable(),
      ),
    );

    await firstValueFrom(service.connect$());
    const textPromise = firstValueFrom(service.receive$.pipe(take(1)));
    queueMicrotask(() => chunkSubject.next('raw-chunk'));
    expect(await textPromise).toBe('raw-chunk');
  });

  it('should update terminalText from session terminalText$', async () => {
    const chunkSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession({} as SerialPortInfo, undefined, chunkSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());
    queueMicrotask(() => chunkSubject.next('terminal-text'));
    await vi.waitFor(() => {
      expect(service.terminalText()).toBe('terminal-text');
    });
  });

  it('should clear terminalText and lines after disconnect', async () => {
    const terminalText$ = new BehaviorSubject('previous-session-output');
    const lines$ = new BehaviorSubject('previous-line');
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(
        {} as SerialPortInfo,
        lines$.asObservable(),
        terminalText$.asObservable(),
      ),
    );

    await firstValueFrom(service.connect$());
    await vi.waitFor(() => {
      expect(service.terminalText()).toBe('previous-session-output');
      expect(service.lines()).toBe('previous-line');
    });

    await firstValueFrom(service.disconnect$());

    await vi.waitFor(() => {
      expect(service.terminalText()).toBe('');
      expect(service.lines()).toBe('');
    });
  });

  it('send$ should delegate to session send$', async () => {
    const session = buildMockSession({} as SerialPortInfo);
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());
    await firstValueFrom(service.send$('hello'));

    expect(session.send$).toHaveBeenCalledWith('hello');
  });

  describe('isRaspberryPiZero', () => {
    const PI_ZERO_INFO: SerialPortInfo = {
      usbVendorId: 0x0525,
      usbProductId: 0xa4a7,
    };

    it('returns true when the current port info matches Pi Zero', async () => {
      const session = buildMockSession(PI_ZERO_INFO);
      mockCreateSerialSession.mockReturnValue(session);

      await firstValueFrom(service.connect$());
      expect(await service.isRaspberryPiZero()).toBe(true);
    });

    it('returns false when VID/PID do not match Pi Zero', async () => {
      const session = buildMockSession({
        usbVendorId: 0x1234,
        usbProductId: 0x5678,
      });
      mockCreateSerialSession.mockReturnValue(session);

      await firstValueFrom(service.connect$());
      expect(await service.isRaspberryPiZero()).toBe(false);
    });

    it('returns false when no session is active', async () => {
      expect(await service.isRaspberryPiZero()).toBe(false);
    });
  });
});
