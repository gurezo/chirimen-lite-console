import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  catchError,
  concatMap,
  defer,
  EMPTY,
  finalize,
  mergeMap,
  throwError,
} from 'rxjs';

/**
 * シリアルコマンド実行を直列化し、世代ベースで一括キャンセルする
 */
@Injectable({
  providedIn: 'root',
})
export class CommandQueueService {
  private readonly executionQueue$ = new Subject<Observable<unknown>>();
  /** cancelAllCommands 用。enqueue 時点の世代と異なれば実行を打ち切る */
  private generation = 0;
  private pendingCount = 0;

  constructor() {
    this.executionQueue$
      .pipe(
        concatMap((work) =>
          work.pipe(
            catchError((err: unknown) => {
              console.error('Serial command queue work error:', err);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  /**
   * enqueue 時点の世代がまだ有効か（cancel されていなければ true）
   */
  isGenerationActive(enqueuedGen: number): boolean {
    return this.generation === enqueuedGen;
  }

  enqueueCommand$<T>(
    factory: (enqueuedGen: number) => Observable<T>,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      const enqueuedGen = this.generation;
      this.pendingCount++;
      this.executionQueue$.next(
        defer(() => {
          if (this.generation !== enqueuedGen) {
            return throwError(() => new Error('All commands cancelled'));
          }
          return factory(enqueuedGen);
        }).pipe(
          finalize(() => {
            this.pendingCount--;
          }),
          mergeMap((value) => {
            subscriber.next(value as T);
            subscriber.complete();
            return EMPTY;
          }),
          catchError((err: unknown) => {
            subscriber.error(err);
            return EMPTY;
          }),
        ),
      );
    });
  }

  cancelAllCommands(): void {
    this.generation++;
  }

  getPendingCommandCount(): number {
    return this.pendingCount;
  }
}
