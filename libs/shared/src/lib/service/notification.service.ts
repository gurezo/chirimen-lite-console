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

  /** Suppress identical consecutive toasts within this window (#812). */
  private static readonly DEDUPE_WINDOW_MS = 2500;

  private lastKey: string | null = null;
  private lastAt = 0;

  /**
   * 成功メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  success(title: string, message: string): void {
    if (this.shouldSkip(title, message, 'success')) {
      return;
    }
    this.toastr.success(message, title);
  }

  /**
   * エラーメッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  error(title: string, message: string): void {
    if (this.shouldSkip(title, message, 'error')) {
      return;
    }
    this.toastr.error(message, title);
  }

  /**
   * 情報メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  info(title: string, message: string): void {
    if (this.shouldSkip(title, message, 'info')) {
      return;
    }
    this.toastr.info(message, title);
  }

  /**
   * 警告メッセージを表示
   * @param title タイトル
   * @param message メッセージ
   */
  warning(title: string, message: string): void {
    if (this.shouldSkip(title, message, 'warning')) {
      return;
    }
    this.toastr.warning(message, title);
  }

  private shouldSkip(
    title: string,
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning',
  ): boolean {
    const key = `${severity}|${title}|${message}`;
    const now = Date.now();
    if (this.lastKey === key && now - this.lastAt < NotificationService.DEDUPE_WINDOW_MS) {
      return true;
    }
    this.lastKey = key;
    this.lastAt = now;
    return false;
  }
}
