import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of } from 'rxjs';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_USER,
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
      .mockResolvedValueOnce({ stdout: 'stale' })
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
      .mockResolvedValueOnce({ stdout: 'stale' })
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
      .mockResolvedValueOnce({ stdout: 'stale' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
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
    ).rejects.toThrow('Password authentication failed');
  });

  it('treats username phase timeout followed by login prompt as rejected login', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'stale' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
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
  });

  it('prefers latest auth marker when login and password coexist in buffer', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'stale' })
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
      .mockResolvedValueOnce({ stdout: 'stale' })
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
