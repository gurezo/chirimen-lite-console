import { inject, Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Injectable({
  providedIn: 'root',
})
export class SerialNotificationService {
  private toastr = inject(ToastrService);

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
    this.toastr.error(
      `Web Serial接続エラー: ${errorMessage}`,
      '接続エラー',
      {
        timeOut: 5000,
      }
    );
  }
}
