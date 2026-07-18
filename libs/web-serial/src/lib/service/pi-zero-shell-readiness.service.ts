/** Full rewrite (#606). Shell readiness flag for post-bootstrap consumers. */
import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { stripSerialAnsiForPrompt } from '../functions';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { SerialCommandPipelineService } from './serial-command/serial-command-pipeline.service';
import { SerialTransportService } from './serial-transport.service';

/**
 * Pi Zero シリアル接続後のシェル到達（対話シェルプロンプト）を共有する。
 *
 * bootstrap のコマンドキュー完了を待たず、`receive$` の受信バッファから
 * シェルプロンプトを検出して `ready` を立てる（issue #717）。
 * ファイルツリーなど exec 向け Feature は本サービスを購読する。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroShellReadinessService {
  private static readonly PROMPT_BUFFER_CAP = 96_000;

  private readonly transport = inject(SerialTransportService);
  private readonly command = inject(SerialCommandPipelineService);
  private readonly detector = inject(PiZeroPromptDetectorService);

  private readonly readySignal = signal(false);
  private readonly logoutCompletedEpochSignal = signal(0);
  private readonly logoutPendingSignal = signal(false);
  private watchSubscription: Subscription | null = null;
  private promptBuffer = '';
  /** `beginLogoutPending` 時点のバッファ長。失敗時のシェル復帰判定に使う。 */
  private logoutPendingBufferMark = 0;

  readonly ready = this.readySignal.asReadonly();
  /** ログイン済みシェルから getty の login 待ちへ戻るたびに増加する。 */
  readonly logoutCompletedEpoch =
    this.logoutCompletedEpochSignal.asReadonly();
  /**
   * Terminal で `logout` / `exit` 送信後、切断完了までの UI ブロック用。
   * 成功時は disconnect の `reset()` まで、失敗時はシェル復帰で解除する。
   */
  readonly logoutPending = this.logoutPendingSignal.asReadonly();

  setReady(value: boolean): void {
    this.readySignal.set(value);
  }

  /**
   * 対話シェルから logout / exit を送った直後に呼び、ローダー表示を開始する。
   */
  beginLogoutPending(): void {
    if (!this.isReady()) {
      return;
    }
    this.logoutPendingSignal.set(true);
    this.logoutPendingBufferMark = this.promptBuffer.length;
  }

  clearLogoutPending(): void {
    this.logoutPendingSignal.set(false);
    this.logoutPendingBufferMark = 0;
  }

  reset(): void {
    this.stopWatching();
    this.promptBuffer = '';
    this.readySignal.set(false);
    this.clearLogoutPending();
  }

  isReady(): boolean {
    return this.readySignal();
  }

  /**
   * read loop 開始後に呼び出し、受信チャンクからシェルプロンプト到達を検出する。
   */
  startWatching(): void {
    this.stopWatching();
    this.promptBuffer = '';
    this.evaluatePromptBuffer(this.command.inspectReadBuffer());
    this.watchSubscription = this.transport.receive$.subscribe({
      next: (chunk) => {
        this.appendPromptChunk(chunk ?? '');
        this.evaluatePromptBuffer(this.promptBuffer);
      },
      error: (error: unknown) => {
        console.error('PiZeroShellReadiness receive error:', error);
      },
    });
  }

  private stopWatching(): void {
    this.watchSubscription?.unsubscribe();
    this.watchSubscription = null;
  }

  private appendPromptChunk(chunk: string): void {
    const piece = stripSerialAnsiForPrompt(chunk);
    this.promptBuffer += piece;
    if (this.promptBuffer.length > PiZeroShellReadinessService.PROMPT_BUFFER_CAP) {
      this.promptBuffer = this.promptBuffer.slice(
        -PiZeroShellReadinessService.PROMPT_BUFFER_CAP,
      );
    }
  }

  private evaluatePromptBuffer(buffer: string): void {
    if (!buffer.length) {
      return;
    }

    if (this.isReady()) {
      if (this.detector.isAwaitingLoginName(buffer)) {
        this.readySignal.set(false);
        this.logoutCompletedEpochSignal.update((epoch) => epoch + 1);
        this.stopWatching();
        return;
      }
      if (
        this.logoutPendingSignal() &&
        buffer.length > this.logoutPendingBufferMark &&
        this.detector.isCommandCompleted(buffer)
      ) {
        // logout / exit が失敗し対話シェルへ戻った場合はローダーを解除する。
        this.clearLogoutPending();
      }
      return;
    }

    if (this.detector.isLikelyLoggedInShellPrompt(buffer)) {
      this.setReady(true);
    }
  }
}
