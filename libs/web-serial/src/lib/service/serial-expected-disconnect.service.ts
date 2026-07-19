import { Injectable, signal } from '@angular/core';

/** アプリが意図して切断を待つ理由（再起動など）。 */
export type SerialExpectedDisconnectReason = 'reboot';

/**
 * 意図した切断と通信エラーを区別するための共有フラグ（#732）。
 *
 * 再起動コマンド送信前に {@link beginExpectedDisconnect} し、
 * 再接続完了後に {@link clearExpectedDisconnect} する。
 *
 * UI ブロック用の {@link rebootPending} はライフサイクルが異なる（#754）。
 * 再起動コマンド〜シリアル切断クリーンアップ完了までに限定し、
 * 再接続待ちでは立てない（Connect 操作を妨げないため）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialExpectedDisconnectService {
  private readonly reasonSignal =
    signal<SerialExpectedDisconnectReason | null>(null);
  private readonly rebootPendingSignal = signal(false);

  readonly reason = this.reasonSignal.asReadonly();

  /**
   * デバイス再起動コマンド送信後〜切断クリーンアップ完了までの UI ブロック用。
   * {@link reason}（トースト抑制・再接続待ち）とは独立したライフサイクル。
   */
  readonly rebootPending = this.rebootPendingSignal.asReadonly();

  beginExpectedDisconnect(reason: SerialExpectedDisconnectReason): void {
    this.reasonSignal.set(reason);
  }

  clearExpectedDisconnect(): void {
    this.reasonSignal.set(null);
  }

  beginRebootPending(): void {
    this.rebootPendingSignal.set(true);
  }

  clearRebootPending(): void {
    this.rebootPendingSignal.set(false);
  }

  isExpectedDisconnect(
    reason?: SerialExpectedDisconnectReason,
  ): boolean {
    const current = this.reasonSignal();
    if (current === null) {
      return false;
    }
    return reason === undefined ? true : current === reason;
  }
}
