import { Injectable, signal } from '@angular/core';

/** アプリが意図して切断を待つ理由（再起動など）。 */
export type SerialExpectedDisconnectReason = 'reboot';

/**
 * 意図した切断と通信エラーを区別するための共有フラグ（#732）。
 *
 * 再起動コマンド送信前に {@link beginExpectedDisconnect} し、
 * クリーンアップ完了後に {@link clearExpectedDisconnect} する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialExpectedDisconnectService {
  private readonly reasonSignal =
    signal<SerialExpectedDisconnectReason | null>(null);

  readonly reason = this.reasonSignal.asReadonly();

  beginExpectedDisconnect(reason: SerialExpectedDisconnectReason): void {
    this.reasonSignal.set(reason);
  }

  clearExpectedDisconnect(): void {
    this.reasonSignal.set(null);
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
