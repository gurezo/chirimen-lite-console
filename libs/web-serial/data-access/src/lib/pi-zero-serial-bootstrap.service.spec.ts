import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of } from 'rxjs';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_USER,
  PI_ZERO_PROMPT,
  PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
  PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
  SERIAL_TIMEOUT,
} from '@libs-web-serial-util';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import type { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import type { SerialFacadeService } from './serial-facade.service';

function createShellReadinessMock(): PiZeroShellReadinessService {
  return {
    setReady: vi.fn(),
    reset: vi.fn(),
    isReady: vi.fn(() => false),
    ready$: vi.fn() as unknown as PiZeroShellReadinessService['ready$'],
  } as unknown as PiZeroShellReadinessService;
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
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = new PiZeroSerialBootstrapService(serial, shellReadiness);
    await firstValueFrom(service.runAfterConnect$());

    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
    expect(readUntilPrompt).toHaveBeenCalledWith({
      prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
      timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
    });
    expect(exec).toHaveBeenNthCalledWith(
      1,
      TZ_SET_CMD,
      expect.objectContaining({
        prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      2,
      TZ_STATUS_CMD,
      expect.objectContaining({
        prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
  });

  it('logs in when shell prompt is not ready', async () => {
    const readUntilPrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error('Command execution timeout'))
      .mockResolvedValueOnce({ stdout: 'raspberrypi login: ' });
    const exec = vi.fn().mockResolvedValue({ stdout: `Password: \r\n` });
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = new PiZeroSerialBootstrapService(serial, shellReadiness);
    const lines: string[] = [];
    await firstValueFrom(service.runAfterConnect$((line) => lines.push(line)));

    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(readUntilPrompt).toHaveBeenNthCalledWith(1, {
      prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
      timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
    });
    expect(readUntilPrompt).toHaveBeenNthCalledWith(2, {
      prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
      timeout: SERIAL_TIMEOUT.LONG,
    });
    expect(exec).toHaveBeenNthCalledWith(
      1,
      PI_ZERO_LOGIN_USER,
      expect.objectContaining({
        prompt: expect.any(RegExp),
        timeout: SERIAL_TIMEOUT.DEFAULT,
        retry: 1,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      2,
      PI_ZERO_LOGIN_PASSWORD,
      expect.objectContaining({
        prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
        timeout: SERIAL_TIMEOUT.LONG,
        retry: 1,
      }),
    );
    expect(lines.some((l) => l.includes('ログインユーザー'))).toBe(true);
    expect(exec).toHaveBeenNthCalledWith(
      3,
      TZ_SET_CMD,
      expect.objectContaining({
        prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
    expect(exec).toHaveBeenNthCalledWith(
      4,
      TZ_STATUS_CMD,
      expect.objectContaining({
        prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
        timeout: SERIAL_TIMEOUT.SHORT,
      }),
    );
  });

  it('runs at most once per connection epoch', async () => {
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
    const service = new PiZeroSerialBootstrapService(serial, shellReadiness);
    await firstValueFrom(service.runAfterConnect$());
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
  });

  it('re-runs bootstrap when connection epoch changes', async () => {
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
    const service = new PiZeroSerialBootstrapService(serial, shellReadiness);

    await firstValueFrom(service.runAfterConnect$());
    epoch = 2;
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(2);
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
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const lines: string[] = [];
    const shellReadiness = createShellReadinessMock();
    const service = new PiZeroSerialBootstrapService(serial, shellReadiness);
    await firstValueFrom(service.runAfterConnect$((line) => lines.push(line)));

    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
    expect(
      lines.some((l) => l.includes('Time zone: Asia/Tokyo')),
    ).toBe(true);
  });
});
