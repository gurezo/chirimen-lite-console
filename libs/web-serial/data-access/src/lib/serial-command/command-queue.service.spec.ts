import { describe, expect, it } from 'vitest';
import {
  Observable,
  Subject,
  delay,
  firstValueFrom,
  map,
  of,
  take,
  timer,
} from 'rxjs';
import { CommandQueueService } from './command-queue.service';

describe('CommandQueueService', () => {
  it('runs enqueued work serially', async () => {
    const queue = new CommandQueueService();
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
    const queue = new CommandQueueService();
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
    const queue = new CommandQueueService();
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
    const queue = new CommandQueueService();
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
    const queue = new CommandQueueService();
    const genAtEnqueue = 0;
    expect(queue.isGenerationActive(genAtEnqueue)).toBe(true);
    queue.cancelAllCommands();
    expect(queue.isGenerationActive(genAtEnqueue)).toBe(false);
  });
});
