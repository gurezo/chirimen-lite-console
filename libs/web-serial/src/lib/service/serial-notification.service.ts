/** Full rewrite (#606). Toasts only; I/O stays in {@link SerialFacadeService}. */
import { inject, Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { SerialExpectedDisconnectService } from './serial-expected-disconnect.service';

@Injectable({
  providedIn: 'root',
})
export class SerialNotificationService {
  private toastr = inject(ToastrService);
  private readonly expectedDisconnect = inject(
    SerialExpectedDisconnectService,
  );

  /**
   * Web Serial接続成功時の通知
   */
  notifyConnectionSuccess(): void {
    this.toastr.success('Web Serial接続が成功しました', '接続成功', {
      timeOut: 3000,
    });
  }

  /**
   * Web Serial接続エラー時の通知
   * @param errorMessage エラーメッセージ
   */
  notifyConnectionError(errorMessage: string): void {
    // 再起動など意図した切断中はエラー扱いしない（#732）
    if (this.expectedDisconnect.isExpectedDisconnect()) {
      return;
    }
    this.toastr.error(
      `Web Serial接続エラー: ${errorMessage}`,
      '接続エラー',
      {
        timeOut: 5000,
      }
    );
  }

  /**
   * Terminal の logout 完了を検出し、接続前状態へ戻すときの通知（#725）。
   */
  notifyLogoutDetected(): void {
    this.toastr.info(
      'ログアウトを検出しました。接続を切断します',
      'ログアウト',
      {
        timeOut: 4000,
      },
    );
  }

  /**
   * ヘッダーの Web Serial DisConnect で接続前状態へ戻すときの通知（#753）。
   */
  notifyManualDisconnect(): void {
    this.toastr.info('Web Serial 接続を切断しました', '切断', {
      timeOut: 4000,
    });
  }

  /**
   * logout / exit が完了せずシェルへ戻った、またはタイムアウトしたときの通知。
   */
  notifyLogoutCancelled(reason: 'failed' | 'timeout' = 'failed'): void {
    const message =
      reason === 'timeout'
        ? 'ログアウトの完了を確認できませんでした。操作を再開できます'
        : 'ログアウトに失敗したようです。操作を再開できます';
    this.toastr.warning(message, 'ログアウト', {
      timeOut: 5000,
    });
  }

  /**
   * 接続後オートログイン / bootstrap 失敗時の通知（#726）。
   */
  notifyAutoLoginFailed(errorMessage: string): void {
    this.toastr.error(
      `オートログインに失敗しました: ${errorMessage}`,
      'ログインエラー',
      {
        timeOut: 8000,
      },
    );
  }
}
