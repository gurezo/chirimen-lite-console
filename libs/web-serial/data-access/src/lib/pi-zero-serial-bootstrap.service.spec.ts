import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of, throwError } from 'rxjs';
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

  it('treats username phase timeout followed by login prompt as rejected login', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'stale' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
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

  it('treats trailing shell as success when scrollback still contains login prompt', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'stale' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({
        stdout:
          'raspberrypi login: \nLast login: Thu\npi@raspberrypi:~ $ \n',
      })
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

    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_PASSWORD}\r\n`);
    expect(exec).toHaveBeenCalled();
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

  it('throws explicit shell readiness timeout when auth wait times out twice', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('probe timeout'))
      .mockResolvedValueOnce({ stdout: 'stale' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockRejectedValueOnce(new Error('Command execution timeout'));
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    await expect(
      firstValueFrom(createBootstrap(serial).loginIfNeeded$()),
    ).rejects.toThrow('Shell readiness timeout while waiting for prompt');

    expect(send$).toHaveBeenCalledWith('\r\n');
    expect(send$).toHaveBeenCalledWith(`${PI_ZERO_LOGIN_USER}\r\n`);
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

  it('fails setupEnvironment$ when timezone command fails', async () => {
    const exec = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => new Error('sudo: a password is required')),
      );
    const serial = {
      exec$: (c: string, o: unknown) => exec(c, o),
    } as unknown as SerialFacadeService;

    const logs: string[] = [];
    await expect(
      firstValueFrom(createBootstrap(serial).setupEnvironment$((l) => logs.push(l))),
    ).rejects.toThrow('Timezone setup failed');

    expect(logs.some((l) => l.includes('タイムゾーン初期化コマンドに失敗'))).toBe(
      true,
    );
  });
});
