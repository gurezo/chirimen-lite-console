import { inject, Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

/**
 * 汎用的な通知サービス
 * 全てのドメインで使用可能
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private toastr = inject(ToastrService);

  /**
   * 成功メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  success(title: string, message: string): void {
    this.toastr.success(message, title);
  }

  /**
   * エラーメッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  error(title: string, message: string): void {
    this.toastr.error(message, title);
  }

  /**
   * 情報メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  info(title: string, message: string): void {
    this.toastr.info(message, title);
  }

  /**
   * 警告メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  warning(title: string, message: string): void {
    this.toastr.warning(message, title);
  }
}
