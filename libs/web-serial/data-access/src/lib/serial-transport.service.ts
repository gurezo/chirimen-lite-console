/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import {
  createTerminalBuffer,
  createSerialSession,
  SerialError,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  catchError,
  concat,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  EMPTY,
  NEVER,
  Observable,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  getConnectionErrorMessage,
  getReadErrorMessage,
  getWriteErrorMessage,
  RASPBERRY_PI_ZERO_INFO,
} from '@libs-web-serial-util';

/**
 * Serial 接続・読取・書込を一元化するサービス
 * v2 @gurezo/web-serial-rxjs の {@link SerialSession} を直接利用し、
 * `state$` / `isConnected$` / `errors$` 等をアプリ層に橋渡しする。
 *
 * 接続状態の Source of truth は常に `SerialSession` 側。
 * 本サービスは `activeSession$` のみで「どのセッションを流すか」を切り替え、
 * ライブラリの Observable を重ねて二重管理しない。
 *
 * ### 受信ストリームの使い分け（issue #559, #566）
 *
 * | 用途 | stream |
 * | --- | --- |
 * | ターミナル表示（terminal helper で整形済み文字列） | {@link #terminalText$} |
 * | 通常の行単位ログ | {@link #lines$} |
 * | prompt / login / password 判定（SerialCommandRunner の exec バッファ） | {@link #receive$} のチャンク累積（`lines$` は lone `\\r` で断片が分離するためプロンプト照合に使わない） |
 * | `lines$` でのログ・行入力（表示・他コンシューマ） | {@link #commandResultLines$} / {@link #getReadStream} |
 * | 生チャンク | {@link #receive$} |
 *
 * `receiveReplay$` はチャンク単位のため、プロンプト検出をそこに寄せると行境界・ANSI 処理と齟齬が出やすい。
 * {@link #lines$} は {@link SerialSession.lines$} への素の橋渡し。{@link #commandResultLines$} は同一源を **multicast** し、
 * 表示側など別購読が増えても {@link #getReadStream} を複数購読しても行が消費され合わない（issue #566）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private session: SerialSession | undefined;

  /**
   * 現在アクティブな {@link SerialSession}（接続試行前の失敗時は undefined）。
   * state のミラーではなく、ストリームの `switchMap` 元のみ。
   */
  private readonly activeSession$ = new BehaviorSubject<
    SerialSession | undefined
  >(undefined);

  /** ライブラリ {@link SerialSession.state$}。未接続時は `idle` を継続発火。 */
  readonly state$ = this.activeSession$.pipe(
    switchMap((s) =>
      s
        ? s.state$
        : concat(of(SerialSessionState.Idle), NEVER)
    ),
    distinctUntilChanged()
  );

  /** ライブラリ {@link SerialSession.isConnected$}。未接続時は `false` を継続。 */
  readonly isConnected$ = this.activeSession$.pipe(
    switchMap((s) =>
      s ? s.isConnected$ : concat(of(false), NEVER)
    ),
    distinctUntilChanged()
  );

  /**
   * ライブラリ {@link SerialSession.lines$}。未接続時は無限に完了しない空ストリーム。
   */
  readonly lines$ = this.activeSession$.pipe(
    switchMap((s) => (s ? s.lines$ : NEVER))
  );

  /**
   * terminal helper で整形済みの表示向けテキスト。
   * `createTerminalBuffer(session.receive$).text$` をそのまま公開する。
   */
  readonly terminalText$ = this.activeSession$.pipe(
    switchMap((s) =>
      s ? createTerminalBuffer(s.receive$).text$ : NEVER
    )
  );

  /**
   * コマンド実行・プロンプト判定用の **行** ストリーム（`SerialSession.lines$` と同根、issue #566）。
   * `shareReplay` により複数購読者が同一行シーケンスを共有し、ターミナル表示など別経路の購読が
   * コマンド側の行消費と競合しない。
   */
  readonly commandResultLines$ = this.activeSession$.pipe(
    switchMap((s) =>
      s
        ? s.lines$.pipe(shareReplay({ bufferSize: 1, refCount: true }))
        : NEVER
    )
  );

  /**
   * ライブラリ {@link SerialSession.receive$}。未接続時は空ストリーム。
   */
  get receive$(): Observable<string> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.receive$ ?? EMPTY)
    );
  }

  /**
   * ライブラリ {@link SerialSession.receiveReplay$}。未接続時は空ストリーム。
   * 後方互換用途のみ（terminal 表示は {@link #terminalText$} を優先）。
   */
  get receiveReplay$(): Observable<string> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.receiveReplay$ ?? EMPTY)
    );
  }

  /**
   * I/O エラー（`SerialError`）のライブラリ本流。未接続時は空ストリーム。
   */
  get errors$(): Observable<SerialError> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.errors$ ?? EMPTY)
    );
  }

  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.portInfo$ ?? of(null))
    );
  }

  getPortInfo(): SerialPortInfo | null {
    return this.session?.getPortInfo() ?? null;
  }

  /**
   * Serial ポートに接続（Observable）
   * @param baudRate ボーレート (デフォルト: 115200)
   */
  connect$(
    baudRate = 115200
  ): Observable<{ port: SerialPort } | { error: string }> {
    return defer(() => {
      this.tearDownSession();
      const session = createSerialSession({
        baudRate,
        filters: [
          {
            usbVendorId: RASPBERRY_PI_ZERO_INFO.usbVendorId,
            usbProductId: RASPBERRY_PI_ZERO_INFO.usbProductId,
          },
        ],
      });
      this.session = session;
      this.activeSession$.next(session);
      return session.connect$().pipe(
        switchMap(() => {
          const port = session.getCurrentPort();
          if (!port) {
            this.tearDownSession();
            return of({
              error: getConnectionErrorMessage(
                new Error('Port is not available after connection')
              ),
            });
          }
          return of({ port });
        }),
        catchError((error) => {
          this.tearDownSession();
          return of({ error: getConnectionErrorMessage(error) });
        })
      );
    });
  }

  /**
   * Serial ポートから切断（Observable）
   */
  disconnect$(): Observable<void> {
    return defer(() => {
      if (!this.session) {
        return of(undefined);
      }
      const session = this.session;
      return session.disconnect$().pipe(
        defaultIfEmpty(undefined),
        tap(() => {
          if (this.session === session) {
            this.tearDownSession();
          }
        }),
        catchError((error) => {
          console.error('Error closing port:', error);
          return throwError(() => error);
        })
      );
    });
  }

  getPort(): SerialPort | undefined {
    return this.session?.getCurrentPort() ?? undefined;
  }

  /**
   * 読み取りストリーム（**1 改行区切りごとに 1 エミット**する行文字列）。
   * {@link #commandResultLines$} を購読する（= `lines$` と同根・multicast）。接続済みチェックのため
   * セッション欠如時は throwError（{@link #lines$} は未接続時 `NEVER`）。
   */
  getReadStream(): Observable<string> {
    return defer(() => {
      if (!this.session) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return this.commandResultLines$.pipe(
        catchError((err: unknown) =>
          throwError(() => new Error(getReadErrorMessage(err)))
        )
      );
    });
  }

  /**
   * データを書き込む。{@link SerialSession.send$} へ委譲（未接続時はライブラリが fail fast）。
   * セッションが無い場合のみ throwError（`Serial port not connected`）。
   */
  write(data: string): Observable<void> {
    return defer(() => {
      const s = this.session;
      if (!s) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return s.send$(data).pipe(
        catchError((error) =>
          throwError(() => new Error(getWriteErrorMessage(error)))
        )
      );
    });
  }

  private tearDownSession(): void {
    this.session = undefined;
    this.activeSession$.next(undefined);
  }
}
