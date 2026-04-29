import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of, throwError } from 'rxjs';
import {
  PI_ZERO_LOGIN_USER,
  PI_ZERO_PROMPT,
} from '@libs-web-serial-util';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import type { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { PiZeroSessionService } from './pi-zero-session.service';
import type { SerialFacadeService } from './serial-facade.service';
import { SerialPromptDetectorService } from './serial-command/serial-prompt-detector.service';

function createShellReadinessMock(): PiZeroShellReadinessService {
  return {
    setReady: vi.fn(),
    reset: vi.fn(),
    isReady: vi.fn(() => false),
    ready$: vi.fn() as unknown as PiZeroShellReadinessService['ready$'],
  } as unknown as PiZeroShellReadinessService;
}

function createSession(
  serial: SerialFacadeService,
  shellReadiness: PiZeroShellReadinessService,
): PiZeroSessionService {
  const bootstrap = new PiZeroSerialBootstrapService(
    serial,
    new SerialPromptDetectorService(),
  );
  return new PiZeroSessionService(serial, bootstrap, shellReadiness);
}

describe('PiZeroSessionService', () => {
  it('runs at most one post-connect pipeline per connection epoch', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);
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
      getConnectionEpoch: () => epoch,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);

    await firstValueFrom(service.runAfterConnect$());
    epoch = 2;
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(2);
  });

  it('emits initializing$ true during post-connect bootstrap then false', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);
    const seen: boolean[] = [];
    const sub = service.initializing$.subscribe((v) => seen.push(v));
    await firstValueFrom(service.runAfterConnect$());
    sub.unsubscribe();

    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
  });

  describe('login flow (loginIfNeeded$)', () => {
    it('completes without exec when shell prompt is already present', async () => {
      const readUntilPrompt = vi.fn().mockReturnValue(
        of({ stdout: `${PI_ZERO_PROMPT} ` }),
      );
      const exec = vi.fn();
      const serial = {
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
        .mockImplementationOnce(() =>
          of({ stdout: 'raspberrypi login: ' }),
        )
        .mockImplementationOnce(() =>
          of({ stdout: `ready\n${PI_ZERO_PROMPT} ` }),
        );
      const exec = vi.fn()
        .mockReturnValueOnce(of({ stdout: 'Password: ' }))
        .mockReturnValueOnce(of({ stdout: '' }));

      const serial = {
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => exec(c, o),
        write$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await firstValueFrom(service.loginIfNeeded$());

      expect(readUntilPrompt).toHaveBeenCalledTimes(3);
      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec.mock.calls[0]?.[0]).toBe(PI_ZERO_LOGIN_USER);
    });
  });

  describe('setup flow (setupEnvironment$)', () => {
    it('runs each timezone init command over serial exec$', async () => {
      const exec = vi.fn().mockReturnValue(of({ stdout: `${PI_ZERO_PROMPT} ` }));
      const serial = {
        exec$: (c: string, o: unknown) => exec(c, o),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await firstValueFrom(service.setupEnvironment$());

      expect(exec).toHaveBeenCalledTimes(2);
      expect(exec.mock.calls[0]?.[0]).toContain('timedatectl set-timezone');
      expect(exec.mock.calls[1]?.[0]).toBe('timedatectl status');
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
          throwError(() => new Error('login prompt timeout')),
        );
      const exec = vi.fn();
      const serial = {
        isConnected$: of(true),
        getConnectionEpoch: () => 1,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => from(exec(c, o)),
        write$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const shellReadiness = createShellReadinessMock();
      const service = createSession(serial, shellReadiness);
      const seen: boolean[] = [];
      const sub = service.initializing$.subscribe((v) => seen.push(v));

      await expect(firstValueFrom(service.runAfterConnect$())).rejects.toThrow(
        'login prompt timeout',
      );
      sub.unsubscribe();

      expect(vi.mocked(shellReadiness.setReady)).not.toHaveBeenCalledWith(true);
      expect(seen.at(-1)).toBe(false);
    });

    it('notifies status handler on pipeline failure', async () => {
      const readUntilPrompt = vi
        .fn()
        .mockImplementationOnce(() =>
          throwError(() => new Error('shell probe timeout')),
        )
        .mockImplementationOnce(() =>
          throwError(() => new Error('login prompt timeout')),
        );
      const onStatus = vi.fn();
      const serial = {
        isConnected$: of(true),
        getConnectionEpoch: () => 1,
        readUntilPrompt$: (o: unknown) => readUntilPrompt(o),
        exec$: (c: string, o: unknown) => from(Promise.resolve({ stdout: '' })),
        write$: () => of(undefined),
      } as unknown as SerialFacadeService;

      const service = createSession(serial, createShellReadinessMock());
      await expect(
        firstValueFrom(service.runAfterConnect$(onStatus)),
      ).rejects.toThrow();

      expect(onStatus).toHaveBeenCalledWith(
        expect.stringContaining('接続後の初期化に失敗'),
      );
    });
  });
});
