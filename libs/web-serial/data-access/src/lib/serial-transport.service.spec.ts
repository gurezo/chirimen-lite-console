import {
  SerialError,
  SerialErrorCode,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
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
    createTerminalBuffer: (source$: Observable<string>) => ({
      text$: source$,
    }),
  };
});

function buildMockSession(
  port: SerialPort | null,
  lines$?: Observable<string>,
  receive$?: Observable<string>,
): SerialSession {
  const state$ = new BehaviorSubject<SerialSessionState>(
    SerialSessionState.Connecting
  );
  const isConnected$ = new BehaviorSubject(false);
  const getCurrentPort = vi.fn((): SerialPort | null => port);
  const receiveStream = receive$ ?? EMPTY;

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
    receive$: receiveStream,
    receiveReplay$: receiveStream,
    lines$: lines$ ?? of('line1'),
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
    (
      session as unknown as { errors$: Observable<SerialError> }
    ).errors$ = errSubj.asObservable();
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

  it('getReadStream should emit line strings from lines$', async () => {
    const mockPort = {} as SerialPort;
    const lineSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(mockPort, lineSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());
    const readPromise = firstValueFrom(service.getReadStream().pipe(take(1)));
    queueMicrotask(() => lineSubject.next('expected-line'));
    expect(await readPromise).toBe('expected-line');
  });

  it('getReadStream should multicast commandResultLines$ for multiple subscribers', async () => {
    const mockPort = {} as SerialPort;
    const lineSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(mockPort, lineSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());
    const p1 = firstValueFrom(service.getReadStream().pipe(take(1)));
    const p2 = firstValueFrom(service.getReadStream().pipe(take(1)));
    queueMicrotask(() => lineSubject.next('shared-line'));
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('shared-line');
    expect(b).toBe('shared-line');
  });

  it('should emit from receive$ and receiveReplay$ when session is active', async () => {
    const mockPort = {} as SerialPort;
    const chunkSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(mockPort, undefined, chunkSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());

    const receivePromise = firstValueFrom(service.receive$.pipe(take(1)));
    const replayPromise = firstValueFrom(service.receiveReplay$.pipe(take(1)));
    queueMicrotask(() => chunkSubject.next('raw-chunk'));
    expect(await receivePromise).toBe('raw-chunk');
    expect(await replayPromise).toBe('raw-chunk');
  });

  it('should emit terminalText$ created from session.receive$', async () => {
    const mockPort = {} as SerialPort;
    const chunkSubject = new Subject<string>();
    mockCreateSerialSession.mockReturnValue(
      buildMockSession(mockPort, undefined, chunkSubject.asObservable()),
    );

    await firstValueFrom(service.connect$());
    const textPromise = firstValueFrom(service.terminalText$.pipe(take(1)));
    queueMicrotask(() => chunkSubject.next('terminal-text'));
    expect(await textPromise).toBe('terminal-text');
  });

  it('write should delegate to session send$', async () => {
    const mockPort = {} as SerialPort;
    const session = buildMockSession(mockPort);
    mockCreateSerialSession.mockReturnValue(session);

    await firstValueFrom(service.connect$());
    await firstValueFrom(service.write('hello'));

    expect(session.send$).toHaveBeenCalledWith('hello');
  });
});
