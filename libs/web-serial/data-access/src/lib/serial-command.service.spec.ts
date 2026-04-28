import { describe, expect, it, vi } from 'vitest';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { SerialCommandService } from './serial-command.service';
import {
  PI_ZERO_PROMPT,
  PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
} from '@libs-web-serial-util';
import type { SerialTransportService } from './serial-transport.service';

/** チャンク入力の代わりに、改行区切りで 1 行ずつ emit（getReadStream＝lines$ 相当）。 */
function emitAsLines(subject: Subject<string>, raw: string): void {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const line of normalized.split('\n')) {
    subject.next(line);
  }
}

function createService() {
  const lines = new Subject<string>();
  const transport = {
    getReadStream: () => lines.asObservable(),
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
  return { service, lines, transport };
}

describe('SerialCommandService', () => {
  it('exec resolves when prompt matches', async () => {
    const { service, lines, transport } = createService();

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
    emitAsLines(lines, `ls\r\noutput\r\n${PI_ZERO_PROMPT}`);

    const result = await execPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
    expect(transport.write).toHaveBeenCalled();
  });

  it('readUntilPrompt resolves without writing', async () => {
    const { service, lines } = createService();

    const readPromise = firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_PROMPT,
        timeout: 1000,
        retry: 0,
      }),
    );

    queueMicrotask(() => {
      emitAsLines(lines, `welcome\r\n${PI_ZERO_PROMPT}`);
    });

    const result = await readPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });

  it('readUntilPrompt sees data already buffered before the wait starts', async () => {
    const { service, lines } = createService();
    emitAsLines(lines, 'Raspberry Pi OS\r\n\r\nraspberrypi login: ');
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
    const { service, lines } = createService();
    emitAsLines(lines, 'ホスト名 ログイン: ');
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/ログイン/);
  });

  it('readUntilPrompt matches login when line contains ANSI escape sequences', async () => {
    const { service, lines } = createService();
    emitAsLines(lines, '\u001b[2J\u001b[Hraspberrypi login: ');
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
    const { service, lines, transport } = createService();

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
    emitAsLines(lines, `echo hi\r\nhi\r\n${PI_ZERO_PROMPT}`);

    const result = await execPromise;
    expect(result.stdout).toContain('hi');
  });

  it('exec$ resolves via firstValueFrom like exec', async () => {
    const { service, lines, transport } = createService();

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
    emitAsLines(lines, `ls\r\noutput\r\n${PI_ZERO_PROMPT}`);

    const result = await resultPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });
});
