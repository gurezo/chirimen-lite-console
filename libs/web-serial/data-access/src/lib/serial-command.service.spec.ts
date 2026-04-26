import { describe, expect, it, vi } from 'vitest';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { SerialCommandService } from './serial-command.service';
import {
  PI_ZERO_PROMPT,
  PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
} from '@libs-web-serial-util';
import type { SerialTransportService } from './serial-transport.service';

function createService() {
  const chunks = new Subject<string>();
  const transport = {
    getReadStream: () => chunks.asObservable(),
    write: vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        })
    ),
  };
  const service = new SerialCommandService(
    transport as unknown as SerialTransportService
  );
  service.startReadLoop();
  return { service, chunks, transport };
}

describe('SerialCommandService', () => {
  it('exec resolves when prompt matches', async () => {
    const { service, chunks, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        })
    );

    const execPromise = firstValueFrom(
      service.exec$('ls', { prompt: PI_ZERO_PROMPT, timeout: 1000, retry: 0 }),
    );

    releaseWrite?.();
    chunks.next(`ls\r\noutput\r\n${PI_ZERO_PROMPT}`);

    const result = await execPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
    expect(transport.write).toHaveBeenCalled();
  });

  it('readUntilPrompt resolves without writing', async () => {
    const { service, chunks } = createService();

    const readPromise = firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_PROMPT,
        timeout: 1000,
        retry: 0,
      }),
    );

    queueMicrotask(() => {
      chunks.next(`welcome\r\n${PI_ZERO_PROMPT}`);
    });

    const result = await readPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });

  it('readUntilPrompt sees data already buffered before the wait starts', async () => {
    const { service, chunks } = createService();
    chunks.next('Raspberry Pi OS\r\n\r\nraspberrypi login: ');
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/login:\s*/i);
  });

  it('readUntilPrompt matches Japanese login prompt in buffer', async () => {
    const { service, chunks } = createService();
    chunks.next('ホスト名 ログイン: ');
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/ログイン/);
  });

  it('readUntilPrompt matches login when chunk contains ANSI escape sequences', async () => {
    const { service, chunks } = createService();
    chunks.next('\u001b[2J\u001b[Hraspberrypi login: ');
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/login:\s*/i);
  });

  it('supports RegExp prompt', async () => {
    const { service, chunks, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        })
    );

    const escaped = PI_ZERO_PROMPT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const execPromise = firstValueFrom(
      service.exec$('echo hi', {
        prompt: new RegExp(escaped),
        timeout: 1000,
        retry: 0,
      }),
    );

    releaseWrite?.();
    chunks.next(`echo hi\r\nhi\r\n${PI_ZERO_PROMPT}`);

    const result = await execPromise;
    expect(result.stdout).toContain('hi');
  });

  it('exec$ resolves via firstValueFrom like exec', async () => {
    const { service, chunks, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        })
    );

    const resultPromise = firstValueFrom(
      service.exec$('ls', { prompt: PI_ZERO_PROMPT, timeout: 1000, retry: 0 }),
    );

    releaseWrite?.();
    chunks.next(`ls\r\noutput\r\n${PI_ZERO_PROMPT}`);

    const result = await resultPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });
});
