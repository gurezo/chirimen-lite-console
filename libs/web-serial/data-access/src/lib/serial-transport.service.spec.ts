import {
  SerialError,
  SerialErrorCode,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  EMPTY,
  firstValueFrom,
  of,
  take,
} from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialTransportService } from './serial-transport.service';

const mockCreateSerialSession = vi.fn<[], SerialSession>();

vi.mock('@gurezo/web-serial-rxjs', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@gurezo/web-serial-rxjs')>();
  return {
    ...actual,
    createSerialSession: () => mockCreateSerialSession(),
  };
});

function buildMockSession(port: SerialPort | null): SerialSession {
  const state$ = new BehaviorSubject<SerialSessionState>(
    SerialSessionState.Connecting
  );
  const isConnected$ = new BehaviorSubject(false);
  const getCurrentPort = vi.fn<[], SerialPort | null>(() => port);

  return {
    isBrowserSupported: () => true,
    connect$: vi.fn(() => {
      state$.next(SerialSessionState.Connected);
      isConnected$.next(true);
      if (port) {
        getCurrentPort.mockReturnValue(port);
      }
      return of(undefined);
    }),
    disconnect$: vi.fn(() => {
      state$.next(SerialSessionState.Idle);
      isConnected$.next(false);
      getCurrentPort.mockReturnValue(null);
      return of(undefined);
    }),
    state$: state$.asObservable(),
    isConnected$: isConnected$.asObservable(),
    portInfo$: of(null),
    getPortInfo: vi.fn(() => null),
    getCurrentPort,
    errors$: EMPTY,
    receive$: EMPTY,
    receiveReplay$: of('chunk'),
    lines$: of('line1'),
    send$: vi.fn(() => of(undefined)),
  } as unknown as SerialSession;
}

describe('SerialTransportService', () => {
  let service: SerialTransportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SerialTransportService();
  });

  it('should expose idle / not connected before any session is created', async () => {
    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SerialSessionState.Idle);
    const connectedFlag = await firstValueFrom(service.isConnected$);
    expect(connectedFlag).toBe(false);
    expect(service.getPort()).toBeUndefined();
    expect(service.getPortInfo()).toBeNull();
  });

  it('should delegate state$ and isConnected$ to SerialSession after connect', async () => {
    const mockPort = {} as SerialPort;
    const session = buildMockSession(mockPort);
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());

    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SerialSessionState.Connected);
    const connectedFlag = await firstValueFrom(service.isConnected$);
    expect(connectedFlag).toBe(true);
    expect(service.getPort()).toBe(mockPort);
    expect(session.connect$).toHaveBeenCalledTimes(1);
  });

  it('should clear session and return to idle after disconnect', async () => {
    const mockPort = {} as SerialPort;
    mockCreateSerialSession.mockReturnValue(buildMockSession(mockPort));

    await firstValueFrom(service.connect$());
    expect(
      await firstValueFrom(service.isConnected$.pipe(take(1))),
    ).toBe(true);

    await firstValueFrom(service.disconnect$());

    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SerialSessionState.Idle);
    expect(
      await firstValueFrom(service.isConnected$.pipe(take(1))),
    ).toBe(false);
    expect(service.getPort()).toBeUndefined();
  });

  it('should expose errors$ from the active session when connected', async () => {
    const mockPort = {} as SerialPort;
    const err = new SerialError(SerialErrorCode.READ_FAILED, 'read');
    const errSubj = new BehaviorSubject(err);
    const session = buildMockSession(mockPort);
    (session as { errors$: typeof errSubj }).errors$ = errSubj.asObservable();
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());
    const emitted = await firstValueFrom(service.errors$);
    expect(emitted).toBe(err);
  });

  it('should emit from lines$ when session is active', async () => {
    const mockPort = {} as SerialPort;
    mockCreateSerialSession.mockReturnValue(buildMockSession(mockPort));

    await firstValueFrom(service.connect$());
    const line = await firstValueFrom(service.lines$.pipe(take(1)));
    expect(line).toBe('line1');
  });
});
