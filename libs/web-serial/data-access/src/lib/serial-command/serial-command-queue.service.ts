/** Full rewrite (#606). Serializes command jobs before runner hits the port. */
import { Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  Subscriber,
  catchError,
  concatMap,
  defer,
  finalize,
  mergeMap,
  throwError,
} from 'rxjs';

/** {@link SerialCommandQueueService#enqueueCommand$} のキュー制御オプション（issue #565） */
export interface SerialCommandEnqueueOptions {
  /**
   * `true` のとき、この enqueue の直前に **まだ実行が始まっていない** 先行ジョブを棄却する。
   * 実行中のジョブは止めない。{@link SerialCommandQueueService#cancelAllCommands} とは別。
   */
  cancelPrevious?: boolean;
}

/**
 * シリアルコマンド実行を直列化し、世代ベースで一括キャンセルする。
 *
 * **契約**
 * - `enqueueCommand$` 1 回につき、呼び出し元の Observable は **単一の next の後 complete**（または error）する。
 * - 内部の `concatMap` により、前のジョブが完了するまで次の `factory` は走らない（直列実行）。
 * - `factory` は `defer` 内で実行される。実行直前に `generation` を再チェックし、
 *   `cancelAllCommands` 済みなら `All commands cancelled` で打ち切る。
 * - `enqueuedGen` は enqueue 時点の世代。キャンセル後もキューに積まれた古いジョブは
 *   実行開始時に世代不一致で棄却される。
 * - **スロット**（`assignedSlotId`）は `cancelPrevious` 時に未実行ジョブだけを棄却するために使う。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandQueueService {
  private readonly executionQueue$ = new Subject<Observable<unknown>>();
  /** `cancelAllCommands` のたびに増加。enqueue 時点の世代と比較して実行可否を決める */
  private generation = 0;
  private pendingCount = 0;
  /** enqueue ごとに増える単調 ID（実行順と一致しない） */
  private nextSlotId = 0;
  /**
   * 実行開始時、`assignedSlotId` がこの値未満なら棄却（`cancelPrevious` で設定）。
   * `cancelAllCommands` ではリセットする。
   */
  private rejectPendingSlotsBelow: number | null = null;

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
   * キューに載っているがまだ `factory` が起動していないジョブを棄却するしきい値を更新する。
   * 直後に enqueue されるコマンドは新しいスロット ID を得る。
   */
  invalidatePendingEnqueues(): void {
    this.rejectPendingSlotsBelow = this.nextSlotId + 1;
  }

  /**
   * enqueue 時点の世代がまだ有効か（cancel されていなければ true）
   */
  isGenerationActive(enqueuedGen: number): boolean {
    return this.generation === enqueuedGen;
  }

  enqueueCommand$<T>(
    factory: (enqueuedGen: number) => Observable<T>,
    opts?: SerialCommandEnqueueOptions,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (opts?.cancelPrevious) {
        this.invalidatePendingEnqueues();
      }
      const assignedSlotId = ++this.nextSlotId;
      const enqueuedGen = this.generation;
      this.pendingCount++;
      this.executionQueue$.next(
        this.createQueuedWork$(
          enqueuedGen,
          assignedSlotId,
          factory,
          subscriber,
        ),
      );
    });
  }

  /**
   * concatMap 1 単位: 世代チェック → factory 実行 → 結果を呼び出し元 subscriber へ一度だけ配送
   */
  private createQueuedWork$<T>(
    enqueuedGen: number,
    assignedSlotId: number,
    factory: (enqueuedGen: number) => Observable<T>,
    subscriber: Subscriber<T>,
  ): Observable<unknown> {
    return defer(() => {
      if (this.generation !== enqueuedGen) {
        return throwError(() => new Error('All commands cancelled'));
      }
      if (
        this.rejectPendingSlotsBelow !== null &&
        assignedSlotId < this.rejectPendingSlotsBelow
      ) {
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
    );
  }

  cancelAllCommands(): void {
    this.generation++;
    this.rejectPendingSlotsBelow = null;
  }

  getPendingCommandCount(): number {
    return this.pendingCount;
  }
}
