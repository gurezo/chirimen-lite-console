import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, NEVER, of, Subject, throwError } from 'rxjs';
import { PI_ZERO_LOGIN_USER, PI_ZERO_PROMPT } from '../constants';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import type { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { PiZeroSessionService } from './pi-zero-session.service';
import type { SerialConnectionOrchestrationService } from './serial-connection-orchestration.service';
import type { SerialFacadeService } from './serial-facade.service';

function stubConnection(
  getEpoch: () => number,
): SerialConnectionOrchestrationService {
  return { getConnectionEpoch: getEpoch } as unknown as SerialConnectionOrchestrationService;
}

function createShellReadinessMock(): PiZeroShellReadinessService {
  return {
    setReady: vi.fn(),
    reset: vi.fn(),
    isReady: vi.fn(() => false),
    startWatching: vi.fn(),
    ready$: vi.fn() as unknown as PiZeroShellReadinessService['ready$'],
  } as unknown as PiZeroShellReadinessService;
}

function createSession(
  serial: SerialFacadeService,
  shellReadiness: PiZeroShellReadinessService,
  connection: SerialConnectionOrchestrationService = stubConnection(() => 1),
): PiZeroSessionService {
  const bootstrap = new PiZeroSerialBootstrapService(
    serial,
    new PiZeroPromptDetectorService(),
  );
  return new PiZeroSessionService(serial, bootstrap, shellReadiness, connection);
}

function serialWithConnectionEstablished(
  overrides: Partial<SerialFacadeService> & {
    connectionEstablished$?: Subject<void>['asObservable'] extends () => infer T
      ? T
      : never;
  } = {},
): SerialFacadeService {
  return {
    isConnected$: of(true),
    connectionEstablished$: NEVER,
    readUntilPrompt$: () => from(Promise.resolve({ stdout: `${PI_ZERO_PROMPT} ` })),
    exec$: () => from(Promise.resolve({ stdout: '' })),
    send$: () => of(undefined),
    ...overrides,
  } as unknown as SerialFacadeService;
}

describe('PiZeroSessionService', () => {
  it('skips login bootstrap when shell is already ready from serial watch', async () => {
    const readUntilPrompt = vi.fn();
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    vi.mocked(shellReadiness.isReady).mockReturnValue(true);
    const service = createSession(serial, shellReadiness, stubConnection(() => 1));
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).not.toHaveBeenCalled();
    expect(vi.mocked(shellReadiness.setReady)).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(exec).toHaveBeenCalled();
    });
  });

  it('runs bootstrap when isConnected$ is still false but epoch advanced', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(false),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness, stubConnection(() => 1));
    await firstValueFrom(service.runAfterConnect$());

    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
  });

  it('marks shell ready after login before environment setup exec', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const events: string[] = [];
    const exec = vi.fn().mockImplementation(async (cmd: string) => {
      events.push(`exec:${cmd.slice(0, 12)}`);
      return { stdout: '' };
    });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    vi.mocked(shellReadiness.setReady).mockImplementation((value: boolean) => {
      if (value) {
        events.push('ready');
      }
    });
    const service = createSession(serial, shellReadiness, stubConnection(() => 1));
    await firstValueFrom(service.runAfterConnect$());

    expect(events[0]).toBe('ready');
    await vi.waitFor(() => {
      expect(events.some((event) => event.startsWith('exec:'))).toBe(true);
    });
  });

  it('runs at most one post-connect pipeline per connection epoch', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness, stubConnection(() => 1));
    await firstValueFrom(service.runAfterConnect$());
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
  });

  it('re-runs pipeline when connection epoch changes', async () => {
    let epoch = 1;
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(
      serial,
      shellReadiness,
      stubConnection(() => epoch),
    );

    await firstValueFrom(service.runAfterConnect$());
    epoch = 2;
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(2);
  });

  it('does not set shell ready when connection epoch advances mid-pipeline; next run succeeds', async () => {
    let connEpoch = 1;
    let readCalls = 0;
    const readUntilPrompt = vi.fn().mockImplementation(async () => {
      readCalls += 1;
      if (readCalls === 1) {
        connEpoch = 2;
      }
      return { stdout: `${PI_ZERO_PROMPT} ` };
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(
      serial,
      shellReadiness,
      stubConnection(() => connEpoch),
    );

    await firstValueFrom(service.runAfterConnect$());
    expect(vi.mocked(shellReadiness.setReady)).not.toHaveBeenCalledWith(true);

    await firstValueFrom(service.runAfterConnect$());
    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
  });

  it('emits initializing$ true during post-connect bootstrap then false', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);
    const seen: boolean[] = [];
    const sub = service.initializing$.subscribe((v) => seen.push(v));
    await firstValueFrom(service.runAfterConnect$());
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe(false);
    });
    sub.unsubscribe();

    expect(seen).toContain(true);
  });

  it('emits setupStatus$ transitions and ends in ready on success', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      connectionEstablished$: NEVER,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);
    const seen: string[] = [];
    const sub = service.setupStatus$.subscribe((v) => seen.push(v));
    await firstValueFrom(service.runAfterConnect$());
    await vi.waitFor(() => {
      expect(seen.at(-1)).toBe('ready');
    });
    sub.unsubscribe();

    expect(seen).toContain('waiting-login');
    expect(seen).toContain('setting-timezone');
  });

  describe('login flow (loginIfNeeded$)', () => {
    it('completes without exec when shell prompt is already present', async () => {
      const readUntilPrompt = vi.fn().mockReturnValue(
        of({ stdout: `${PI_ZERO_PROMPT} ` }),
      );
      const exec = vi.fn();
      const serial = {
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => from(exec(c, o)),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await firstValueFrom(service.loginIfNeeded$());

      expect(readUntilPrompt).toHaveBeenCalledTimes(1);
      expect(exec).not.toHaveBeenCalled();
    });

    it('runs user and password exec after login prompts when shell probe fails', async () => {
      const readUntilPrompt = vi
        .fn()
        .mockImplementationOnce(() =>
          throwError(() => new Error('shell prompt timeout')),
        )
        .mockImplementationOnce(() => of({ stdout: 'stale buffer' }))
        .mockImplementationOnce(() =>
          of({ stdout: 'raspberrypi login: ' }),
        )
        .mockImplementationOnce(() =>
          of({ stdout: 'Password: ' }),
        )
        .mockImplementationOnce(() =>
          of({ stdout: `ready\n${PI_ZERO_PROMPT} ` }),
        );
      const exec = vi.fn();
      const send$ = vi.fn().mockReturnValue(of(undefined));

      const serial = {
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => exec(c, o),
        send$,
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await firstValueFrom(service.loginIfNeeded$());

      expect(readUntilPrompt).toHaveBeenCalledTimes(5);
      expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('setup flow (setupEnvironment$)', () => {
    it('runs each environment init command over serial exec$', async () => {
      const exec = vi.fn().mockReturnValue(of({ stdout: `${PI_ZERO_PROMPT} ` }));
      const serial = {
        connectionEstablished$: NEVER,
        exec$: (c: string, o: unknown) => exec(c, o),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await firstValueFrom(service.setupEnvironment$());

      expect(exec).toHaveBeenCalledTimes(6);
      expect(exec.mock.calls[0]?.[0]).toContain('export LANG=');
      expect(exec.mock.calls[2]?.[0]).toContain('timedatectl set-timezone');
      expect(exec.mock.calls[3]?.[0]).toBe('timedatectl status');
      expect(exec.mock.calls[4]?.[0]).toContain('export TZ=');
    });
  });

  describe('error flow (runAfterConnect$)', () => {
    it('propagates errors, skips setReady(true), and ends initializing$', async () => {
      const readUntilPrompt = vi
        .fn()
        .mockImplementationOnce(() =>
          throwError(() => new Error('shell probe timeout')),
        )
        .mockImplementationOnce(() =>
          of({ stdout: 'stale buffer' }),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        );
      const exec = vi.fn();
      const serial = {
        isConnected$: of(true),
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => from(exec(c, o)),
        send$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const shellReadiness = createShellReadinessMock();
      const service = createSession(serial, shellReadiness);
      const seen: boolean[] = [];
      const sub = service.initializing$.subscribe((v) => seen.push(v));

      await expect(firstValueFrom(service.runAfterConnect$())).rejects.toThrow(
        'Shell readiness timeout while waiting for prompt',
      );
      sub.unsubscribe();

      expect(vi.mocked(shellReadiness.setReady)).not.toHaveBeenCalledWith(true);
      expect(seen.at(-1)).toBe(false);
    });

    it('sets setupStatus$ to failed on pipeline failure', async () => {
      const readUntilPrompt = vi
        .fn()
        .mockImplementationOnce(() =>
          throwError(() => new Error('shell probe timeout')),
        )
        .mockImplementationOnce(() => of({ stdout: 'stale buffer' }))
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        );
      const serial = {
        isConnected$: of(true),
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: () => from(Promise.resolve({ stdout: '' })),
        send$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      const seen: string[] = [];
      const sub = service.setupStatus$.subscribe((v) => seen.push(v));
      await expect(firstValueFrom(service.runAfterConnect$())).rejects.toThrow();
      sub.unsubscribe();

      expect(seen.at(-1)).toBe('failed');
    });

    it('notifies status handler on pipeline failure', async () => {
      const readUntilPrompt = vi
        .fn()
        .mockImplementationOnce(() =>
          throwError(() => new Error('shell probe timeout')),
        )
        .mockImplementationOnce(() =>
          of({ stdout: 'stale buffer' }),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        );
      const onStatus = vi.fn();
      const serial = {
        isConnected$: of(true),
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: () => from(Promise.resolve({ stdout: '' })),
        send$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await expect(
        firstValueFrom(service.runAfterConnect$(onStatus)),
      ).rejects.toThrow();

      expect(onStatus).toHaveBeenCalledWith(
        expect.stringContaining('接続後の初期化に失敗'),
      );
    });

    it('keeps shell ready when background environment setup fails', async () => {
      const readUntilPrompt = vi.fn().mockImplementation(() =>
        of({
          stdout: `${PI_ZERO_PROMPT} `,
        }),
      );
      const exec = vi
        .fn()
        .mockReturnValueOnce(
          throwError(() => new Error('sudo: a password is required')),
        );
      const serial = {
        isConnected$: of(true),
        connectionEstablished$: NEVER,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => exec(c, o),
      } as unknown as SerialFacadeService;

      const shellReadiness = createShellReadinessMock();
      const service = createSession(serial, shellReadiness);
      const seen: string[] = [];
      const sub = service.setupStatus$.subscribe((v) => seen.push(v));

      await firstValueFrom(service.runAfterConnect$());
      expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
      await vi.waitFor(() => {
        expect(seen.at(-1)).toBe('failed');
      });
      sub.unsubscribe();
    });
  });
});
