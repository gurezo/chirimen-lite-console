import { describe, expect, it, vi } from 'vitest';
import { Observable, Subject, firstValueFrom, take } from 'rxjs';
import {
  PI_ZERO_PROMPT,
} from '@libs-web-serial-util';
import type { SerialTransportService } from '../serial-transport.service';
import { SerialCommandQueueService } from './serial-command-queue.service';
import { SerialCommandRunnerService } from './serial-command-runner.service';
import { SerialPromptDetectorService } from './serial-prompt-detector.service';
import { SerialCommandService } from './serial-command-facade.service';

/** モックの入力待ち行（実機 PS1 で `matchesPrompt` が厳格になる）。単独の `pi@…:` だけでは終了しない。 */
const MOCK_PS1_TAIL = `${PI_ZERO_PROMPT}~$`;

/** `SerialSession.lines$` と同様に、論理行ごとに emit する。 */
function emitIncomingLines(subject: Subject<string>, lines: string[]): void {
  for (const line of lines) {
    subject.next(line);
  }
}

function createService() {
  const linesSubject = new Subject<string>();
  const transport = {
    lines$: linesSubject.asObservable(),
    write: vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        }),
    ),
  };
  const queue = new SerialCommandQueueService();
  const promptDetector = new SerialPromptDetectorService();
  const runner = new SerialCommandRunnerService(
    transport as unknown as SerialTransportService,
    promptDetector,
    queue,
  );
  const service = new SerialCommandService(runner, queue);
  service.startReadLoop();
  return { service, linesSubject, transport, promptDetector };
}

describe('SerialCommandService', () => {
  it('exec resolves when prompt matches', async () => {
    const { service, linesSubject, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        }),
    );

    const execPromise = firstValueFrom(
      service.exec$('ls', { prompt: PI_ZERO_PROMPT, timeout: 1000, retry: 0 }),
    );

    releaseWrite?.();
    emitIncomingLines(linesSubject, ['ls', 'output', MOCK_PS1_TAIL]);

    const result = await execPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
    expect(transport.write).toHaveBeenCalled();
  });

  it('readUntilPrompt resolves without writing', async () => {
    const { service, linesSubject } = createService();

    const readPromise = firstValueFrom(
      service.readUntilPrompt$({
        prompt: PI_ZERO_PROMPT,
        timeout: 1000,
        retry: 0,
      }),
    );

    queueMicrotask(() => {
      emitIncomingLines(linesSubject, ['welcome', MOCK_PS1_TAIL]);
    });

    const result = await readPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });

  it('readUntilPrompt matches shell prompt split across sequential lines$ emissions', async () => {
    const { service, linesSubject } = createService();

    const readPromise = firstValueFrom(
      service.readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) =>
          buf.includes(`${PI_ZERO_PROMPT}~`) && /\$\s*$/.test(buf.trimEnd()),
        timeout: 1000,
        retry: 0,
      }),
    );

    queueMicrotask(() => {
      emitIncomingLines(linesSubject, [`${PI_ZERO_PROMPT}~`, '$ ']);
    });

    const result = await readPromise;
    expect(result.stdout).toContain(`${PI_ZERO_PROMPT}~`);
    expect(result.stdout).toMatch(/\$\s*/);
  });

  it('readUntilPrompt sees data already buffered before the wait starts', async () => {
    const { service, linesSubject, promptDetector } = createService();
    emitIncomingLines(linesSubject, [
      'Raspberry Pi OS',
      '',
      'raspberrypi login: ',
    ]);
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) => promptDetector.isLoginPrompt(buf),
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/login:\s*/i);
  });

  it('readUntilPrompt matches Japanese login prompt in buffer', async () => {
    const { service, linesSubject, promptDetector } = createService();
    emitIncomingLines(linesSubject, ['ホスト名 ログイン: ']);
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) => promptDetector.isLoginPrompt(buf),
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/ログイン/);
  });

  it('readUntilPrompt matches login when line contains ANSI escape sequences', async () => {
    const { service, linesSubject, promptDetector } = createService();
    emitIncomingLines(linesSubject, [
      '\u001b[2J\u001b[Hraspberrypi login: ',
    ]);
    const result = await firstValueFrom(
      service.readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) => promptDetector.isLoginPrompt(buf),
        timeout: 1000,
        retry: 0,
      }),
    );
    expect(result.stdout).toMatch(/login:\s*/i);
  });

  it('supports RegExp prompt', async () => {
    const { service, linesSubject, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        }),
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
    emitIncomingLines(linesSubject, ['echo hi', 'hi', MOCK_PS1_TAIL]);

    const result = await execPromise;
    expect(result.stdout).toContain('hi');
  });

  it('exec$ resolves via firstValueFrom like exec', async () => {
    const { service, linesSubject, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        }),
    );

    const resultPromise = firstValueFrom(
      service.exec$('ls', { prompt: PI_ZERO_PROMPT, timeout: 1000, retry: 0 }),
    );

    releaseWrite?.();
    emitIncomingLines(linesSubject, ['ls', 'output', MOCK_PS1_TAIL]);

    const result = await resultPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });

  it('exec rejects when prompt never appears before timeout', async () => {
    const { service, transport } = createService();
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        }),
    );
    const p = firstValueFrom(
      service.exec$('ls', {
        prompt: PI_ZERO_PROMPT,
        timeout: 40,
        retry: 0,
      }),
    );
    await expect(p).rejects.toThrow('Command execution timeout');
  });

  it('exec retries after timeout and succeeds on second attempt', async () => {
    const { service, linesSubject, transport } = createService();
    let writeCount = 0;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          writeCount++;
          subscriber.next();
          subscriber.complete();
        }),
    );
    const execPromise = firstValueFrom(
      service.exec$('ls', {
        prompt: PI_ZERO_PROMPT,
        timeout: 50,
        retry: 1,
      }),
    );
    await new Promise((r) => setTimeout(r, 70));
    emitIncomingLines(linesSubject, ['out', MOCK_PS1_TAIL]);
    const result = await execPromise;
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
    expect(writeCount).toBe(2);
  });

  it('exec rejects after retries are exhausted', async () => {
    const { service, transport } = createService();
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        }),
    );
    const outcome = await new Promise<unknown>((resolve) => {
      service
        .exec$('ls', {
          prompt: PI_ZERO_PROMPT,
          timeout: 35,
          retry: 1,
        })
        .subscribe({
          next: (v) =>
            resolve(new Error(`unexpected next: ${JSON.stringify(v)}`)),
          error: (e) => resolve(e),
          complete: () => resolve(new Error('unexpected complete')),
        });
    });
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toContain('Command execution timeout');
  });

  it('respects timeoutMs as alias for timeout', async () => {
    const { service, transport } = createService();
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          subscriber.next();
          subscriber.complete();
        }),
    );
    const p = firstValueFrom(
      service.execWithSerialOptions$('ls', {
        prompt: PI_ZERO_PROMPT,
        timeoutMs: 40,
        retryCount: 0,
      }),
    );
    await expect(p).rejects.toThrow('Command execution timeout');
  });

  it('exec with waitForPrompt false completes without prompt in output', async () => {
    const { service, transport } = createService();

    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        }),
    );

    const execPromise = firstValueFrom(
      service.execWithSerialOptions$('ls', {
        prompt: PI_ZERO_PROMPT,
        timeout: 5000,
        waitForPrompt: false,
      }),
    );

    releaseWrite?.();
    const result = await execPromise;
    expect(result.stdout).toBe('');
    expect(transport.write).toHaveBeenCalled();
  });

  it('cancelPrevious drops pending exec but not running', async () => {
    const { service, linesSubject, transport } = createService();
    const finishFirst = new Subject<void>();
    let writeCall = 0;
    transport.write = vi.fn(
      () =>
        new Observable<void>((s) => {
          writeCall++;
          if (writeCall === 1) {
            finishFirst.pipe(take(1)).subscribe(() => {
              s.next();
              s.complete();
            });
            return;
          }
          s.next();
          s.complete();
        }),
    );

    const p1 = firstValueFrom(
      service.execWithSerialOptions$('a', {
        prompt: PI_ZERO_PROMPT,
        timeout: 5000,
      }),
    );
    const p2 = firstValueFrom(
      service.execWithSerialOptions$('b', {
        prompt: PI_ZERO_PROMPT,
        timeout: 5000,
      }),
    );
    const p3 = firstValueFrom(
      service.execWithSerialOptions$('c', {
        prompt: PI_ZERO_PROMPT,
        timeout: 5000,
        cancelPrevious: true,
      }),
    );

    finishFirst.next();
    finishFirst.complete();
    emitIncomingLines(linesSubject, [MOCK_PS1_TAIL]);

    await expect(p2).rejects.toThrow('All commands cancelled');

    emitIncomingLines(linesSubject, [MOCK_PS1_TAIL]);

    const [r1, r3] = await Promise.all([p1, p3]);
    expect(r1.stdout).toContain(PI_ZERO_PROMPT);
    expect(r3.stdout).toContain(PI_ZERO_PROMPT);
  });

  it('exec stdout aggregates successive lines$ emissions through prompt', async () => {
    const { service, linesSubject, transport } = createService();
    let releaseWrite: (() => void) | undefined;
    transport.write = vi.fn(
      () =>
        new Observable<void>((subscriber) => {
          releaseWrite = () => {
            subscriber.next();
            subscriber.complete();
          };
        }),
    );
    const execPromise = firstValueFrom(
      service.exec$('ls', { prompt: PI_ZERO_PROMPT, timeout: 1000, retry: 0 }),
    );
    releaseWrite?.();
    emitIncomingLines(linesSubject, [
      'total 36',
      '        xxx',
      'yyy zzz',
      MOCK_PS1_TAIL,
    ]);
    const result = await execPromise;
    expect(result.stdout).toContain('yyy zzz');
    expect(result.stdout).toContain(PI_ZERO_PROMPT);
  });
});
