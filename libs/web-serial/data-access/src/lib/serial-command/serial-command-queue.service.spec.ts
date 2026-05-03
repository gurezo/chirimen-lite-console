import { describe, expect, it } from 'vitest';
import {
  NEVER,
  Observable,
  Subject,
  delay,
  firstValueFrom,
  map,
  of,
  switchMap,
  take,
  timer,
} from 'rxjs';
import type { SerialTransportService } from '../serial-transport.service';
import { SerialPromptDetectorService } from './serial-prompt-detector.service';
import { SerialCommandPipelineService } from './serial-command-pipeline.service';

describe('SerialCommandPipelineService (queue)', () => {
  function createQueueOnlyPipeline(): SerialCommandPipelineService {
    return new SerialCommandPipelineService(
      { receive$: NEVER } as unknown as SerialTransportService,
      new SerialPromptDetectorService(),
    );
  }

  it('runs enqueued work serially', async () => {
    const queue = createQueueOnlyPipeline();
    const order: number[] = [];
    const p1 = firstValueFrom(
      queue.enqueueCommand$(() => {
        order.push(1);
        return new Observable<string>((sub) => {
          sub.next('a');
          sub.complete();
        });
      }),
    );
    const p2 = firstValueFrom(
      queue.enqueueCommand$(() => {
        order.push(2);
        return new Observable<string>((sub) => {
          sub.next('b');
          sub.complete();
        });
      }),
    );
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(order).toEqual([1, 2]);
  });

  it('runs first delayed job to completion before starting the second', async () => {
    const queue = createQueueOnlyPipeline();
    const order: number[] = [];
    const p1 = firstValueFrom(
      queue.enqueueCommand$(() =>
        timer(25).pipe(
          map(() => {
            order.push(1);
            return 'a';
          }),
        ),
      ),
    );
    const p2 = firstValueFrom(
      queue.enqueueCommand$(() => {
        order.push(2);
        return of('b').pipe(delay(0));
      }),
    );
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(order).toEqual([1, 2]);
  });

  it('increments pending count while work runs', async () => {
    const queue = createQueueOnlyPipeline();
    expect(queue.getPendingCommandCount()).toBe(0);
    const done = firstValueFrom(
      queue.enqueueCommand$(() => {
        expect(queue.getPendingCommandCount()).toBeGreaterThanOrEqual(1);
        return new Observable<number>((sub) => {
          sub.next(1);
          sub.complete();
        });
      }),
    );
    await done;
    expect(queue.getPendingCommandCount()).toBe(0);
  });

  it('rejects work when generation was cancelled before run', async () => {
    const queue = createQueueOnlyPipeline();
    const blocker = new Subject<void>();
    const p1 = firstValueFrom(
      queue.enqueueCommand$(() =>
        blocker.pipe(
          take(1),
          map(() => 'done'),
        ),
      ),
    );
    const p2 = firstValueFrom(
      queue.enqueueCommand$(() => of(2)),
    );
    queue.cancelAllCommands();
    blocker.next();
    blocker.complete();
    await expect(p1).resolves.toBe('done');
    await expect(p2).rejects.toThrow('All commands cancelled');
  });

  it('isGenerationActive is false after cancelAllCommands', () => {
    const queue = createQueueOnlyPipeline();
    const genAtEnqueue = 0;
    expect(queue.isGenerationActive(genAtEnqueue)).toBe(true);
    queue.cancelAllCommands();
    expect(queue.isGenerationActive(genAtEnqueue)).toBe(false);
  });

  it('cancelPrevious rejects pending work but not the one currently running', async () => {
    const queue = createQueueOnlyPipeline();
    const finishFirst = new Subject<void>();
    const p1 = firstValueFrom(
      queue.enqueueCommand$(() =>
        finishFirst.pipe(
          take(1),
          map(() => 'first'),
        ),
      ),
    );
    const p2 = firstValueFrom(queue.enqueueCommand$(() => of('second')));
    const p3 = firstValueFrom(
      queue.enqueueCommand$(() => of('third'), { cancelPrevious: true }),
    );
    finishFirst.next();
    finishFirst.complete();
    expect(await p1).toBe('first');
    await expect(p2).rejects.toThrow('All commands cancelled');
    expect(await p3).toBe('third');
  });

  it('cancelPrevious does not abort work already in defer (same slot bump)', async () => {
    const queue = createQueueOnlyPipeline();
    const blocker = new Subject<void>();
    const p1 = firstValueFrom(
      queue.enqueueCommand$(() =>
        blocker.pipe(
          take(1),
          switchMap(() => of('running')),
        ),
      ),
    );
    const p2 = firstValueFrom(
      queue.enqueueCommand$(() => of('x'), { cancelPrevious: true }),
    );
    blocker.next();
    blocker.complete();
    expect(await p1).toBe('running');
    expect(await p2).toBe('x');
  });
});
