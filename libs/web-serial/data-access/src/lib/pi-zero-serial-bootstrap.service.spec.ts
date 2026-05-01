import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of } from 'rxjs';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY,
  PI_ZERO_LOGIN_USER,
  PI_ZERO_LOGIN_USER_STORAGE_KEY,
  PI_ZERO_PROMPT,
} from '@libs-web-serial-util';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import type { SerialFacadeService } from './serial-facade.service';

function createBootstrap(serial: SerialFacadeService) {
  return new PiZeroSerialBootstrapService(
    serial,
    new PiZeroPromptDetectorService(),
  );
}

describe('PiZeroSerialBootstrapService', () => {
  it('uses send$-based auth flow on login prompt', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await firstValueFrom(createBootstrap(serial).runPostConnectPipeline$());

    expect(send$).toHaveBeenCalledWith('\r\n');
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_PASSWORD}\r\n`);
    expect(exec).toHaveBeenCalledTimes(2); // timezone only
  });

  it('skips login send when shell already visible after flush', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const logs: string[] = [];
    await firstValueFrom(
      createBootstrap(serial).runPostConnectPipeline$((l) => logs.push(l)),
    );

    expect(send$).toHaveBeenCalledWith('\r\n');
    expect(send$).not.toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(logs.some((l) => l.includes('ログイン済みのシェル'))).toBe(true);
  });

  it('throws when password authentication fails', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await expect(
      firstValueFrom(createBootstrap(serial).loginIfNeeded$()),
    ).rejects.toThrow('Password authentication failed');
  });

  it('fails fast when target returns Login incorrect', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({
        stdout: 'Login incorrect\nraspberrypi login: ',
      });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await expect(
      firstValueFrom(createBootstrap(serial).loginIfNeeded$()),
    ).rejects.toThrow('Login rejected by target device (Login incorrect)');
    expect(
      send$.mock.calls.filter(([arg]) => arg === `${PI_ZERO_LOGIN_PASSWORD}\r\n`)
        .length,
    ).toBe(1);
  });

  it('uses localStorage credentials when provided', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    store.set(PI_ZERO_LOGIN_USER_STORAGE_KEY, 'custom-user');
    store.set(PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY, 'custom-pass');
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await firstValueFrom(createBootstrap(serial).loginIfNeeded$());

    expect(send$).toHaveBeenCalledWith('custom-user\r\n');
    expect(send$).toHaveBeenCalledWith('custom-pass\r\n');
    vi.unstubAllGlobals();
  });

  it('treats repeated login prompt after username submission as rejected login', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockResolvedValue({ stdout: 'raspberrypi login: ' })
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await expect(
      firstValueFrom(createBootstrap(serial).loginIfNeeded$()),
    ).rejects.toThrow('Login rejected after username submission');
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(
      send$.mock.calls.filter(([arg]) => arg === `${PI_ZERO_LOGIN_USER}\r\n`)
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      send$.mock.calls.filter(([arg]) => arg === `${PI_ZERO_LOGIN_PASSWORD}\r\n`)
        .length,
    ).toBe(0);
    expect(send$.mock.calls.filter(([arg]) => arg === '\r\n').length).toBe(2);
  });

  it('prefers latest auth marker when login and password coexist in buffer', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({
        stdout:
          'raspberrypi login: \nPassword: \nLogin timed out after 60 seconds.\nPassword: ',
      })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const logs: string[] = [];
    await firstValueFrom(
      createBootstrap(serial).runPostConnectPipeline$((l) => logs.push(l)),
    );

    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_PASSWORD}\r\n`);
    expect(send$).not.toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(logs.some((l) => l.includes('パスワード入力画面を検出'))).toBe(true);
  });

  it('retries auth wait once by sending another newline on timeout', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await firstValueFrom(createBootstrap(serial).loginIfNeeded$());

    // initial flush + retry flush + user + password + password-phase extra newline
    expect(send$).toHaveBeenCalledWith('\r\n');
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_PASSWORD}\r\n`);
  });

  it('does not restart username immediately on first login re-observation after password', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const logs: string[] = [];
    await firstValueFrom(
      createBootstrap(serial).runPostConnectPipeline$((l) => logs.push(l)),
    );

    expect(
      send$.mock.calls.filter(([arg]) => arg === `${PI_ZERO_LOGIN_USER}\r\n`)
        .length,
    ).toBe(1);
    expect(
      send$.mock.calls.filter(([arg]) => arg === `${PI_ZERO_LOGIN_PASSWORD}\r\n`)
        .length,
    ).toBe(1);
    expect(logs.some((l) => l.includes('追加送信せず再観測'))).toBe(true);
  });

  it('keeps timezone status logging', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `ready\r\n${PI_ZERO_PROMPT} `,
    });
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({
        stdout: `timedatectl status\r\n       Time zone: Asia/Tokyo (${PI_ZERO_PROMPT} `,
      });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const logs: string[] = [];
    await firstValueFrom(
      createBootstrap(serial).runPostConnectPipeline$((l) => logs.push(l)),
    );
    expect(logs.some((l) => l.includes('Time zone: Asia/Tokyo'))).toBe(true);
  });
});
