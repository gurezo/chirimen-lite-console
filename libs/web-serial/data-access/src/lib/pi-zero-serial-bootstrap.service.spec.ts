import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of } from 'rxjs';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_USER,
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
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

const TZ_SET_CMD =
  'sudo -n timedatectl set-timezone Asia/Tokyo 2>/dev/null || true';
const TZ_STATUS_CMD = 'timedatectl status';

describe('PiZeroSerialBootstrapService', () => {
  it('skips login when shell prompt is already visible', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `ready\r\n${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const service = createBootstrap(serial);
    await firstValueFrom(service.runPostConnectPipeline$());

    expect(send$).not.toHaveBeenCalled();

    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
    expect(readUntilPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      1,
      TZ_SET_CMD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      2,
      TZ_STATUS_CMD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
  });

  it('logs in when shell prompt is not ready', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'stale boot log' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({
        stdout: `Last login: Mon Jan 01 00:00:00 2024 from ttyS0\n${PI_ZERO_PROMPT} `,
      });
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: `Password: \r\n` })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValue({ stdout: '' });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const service = createBootstrap(serial);
    const lines: string[] = [];
    await firstValueFrom(
      service.runPostConnectPipeline$((line) => lines.push(line)),
    );

    expect(send$).toHaveBeenCalledTimes(2);
    expect(send$).toHaveBeenCalledWith('\r\n');

    expect(readUntilPrompt).toHaveBeenCalledTimes(4);
    expect(readUntilPrompt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
      }),
    );
    expect(readUntilPrompt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prompt: '',
        waitForPrompt: false,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(readUntilPrompt).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
      }),
    );
    expect(readUntilPrompt).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      1,
      PI_ZERO_LOGIN_USER,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.LONG,
        retry: 1,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      2,
      PI_ZERO_LOGIN_PASSWORD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        waitForPrompt: false,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(lines.some((l) => l.includes('ログインユーザー'))).toBe(true);
    expect(exec).toHaveBeenNthCalledWith(
      3,
      TZ_SET_CMD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      4,
      TZ_STATUS_CMD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
  });

  it('sends password only when Password is already the active prompt', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'stale boot log' })
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({
        stdout: `Login OK\n${PI_ZERO_PROMPT} `,
      });
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValue({ stdout: `${PI_ZERO_PROMPT} ` });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const lines: string[] = [];
    const service = createBootstrap(serial);
    await firstValueFrom(
      service.runPostConnectPipeline$((line) => lines.push(line)),
    );

    expect(send$).toHaveBeenCalledTimes(2);
    expect(send$).toHaveBeenCalledWith('\r\n');

    expect(exec).toHaveBeenNthCalledWith(
      1,
      PI_ZERO_LOGIN_PASSWORD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        waitForPrompt: false,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(
      lines.some((l) => l.includes('パスワード入力画面を検出')),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes('ログインユーザー')),
    ).toBe(false);
    expect(exec).toHaveBeenNthCalledWith(
      2,
      TZ_SET_CMD,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
  });

  it('does not treat stale Password in previous buffer as active password prompt', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: '...old Password: from stale buffer...' })
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' })
      .mockResolvedValueOnce({ stdout: `${PI_ZERO_PROMPT} ` });
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: 'Password: ' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValue({ stdout: `${PI_ZERO_PROMPT} ` });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const lines: string[] = [];
    const service = createBootstrap(serial);
    await firstValueFrom(
      service.runPostConnectPipeline$((line) => lines.push(line)),
    );

    expect(exec).toHaveBeenNthCalledWith(
      1,
      PI_ZERO_LOGIN_USER,
      expect.objectContaining({
        prompt: '',
        promptMatch: expect.any(Function),
      }),
    );
    expect(lines.some((l) => l.includes('ログインユーザー'))).toBe(true);
    expect(
      lines.some((l) => l.includes('パスワード入力画面を検出')),
    ).toBe(false);
  });

  it('logs timezone status stdout lines to the status handler', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `ready\r\n${PI_ZERO_PROMPT} `,
    });
    const exec = vi
      .fn()
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({
        stdout: `${TZ_STATUS_CMD}\r\n       Time zone: Asia/Tokyo (${PI_ZERO_PROMPT} `,
      });
    const send$ = vi.fn().mockReturnValue(of(undefined));
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
      send$,
    } as unknown as SerialFacadeService;

    const lines: string[] = [];
    const service = createBootstrap(serial);
    await firstValueFrom(
      service.runPostConnectPipeline$((line) => lines.push(line)),
    );

    expect(send$).not.toHaveBeenCalled();
    expect(
      lines.some((l) => l.includes('Time zone: Asia/Tokyo')),
    ).toBe(true);
  });
});
