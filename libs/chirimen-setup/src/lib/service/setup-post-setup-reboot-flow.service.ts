import { Injectable, inject, signal } from '@angular/core';
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import { NotificationService } from '@libs-shared';
import {
  SerialExpectedDisconnectService,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { SetupRebootFlowService } from './setup-reboot-flow.service';

const RECONNECT_POLL_MS = 500;
/** 再接続待ちの上限（ブラウザ操作が必要なため長め）。 */
const RECONNECT_WAIT_MS = 10 * 60 * 1000;

/**
 * セットアップ成功後の確認付き再起動〜再接続案内フロー（#734）。
 */
@Injectable({
  providedIn: 'root',
})
export class SetupPostSetupRebootFlowService {
  private readonly dialogService = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly setupReboot = inject(SetupRebootFlowService);
  private readonly expectedDisconnect = inject(
    SerialExpectedDisconnectService,
  );

  private readonly inProgressSignal = signal(false);
  readonly inProgress = this.inProgressSignal.asReadonly();

  /**
   * 再起動確認 → コマンド送信 → 切断クリーンアップ → 再接続案内。
   * 二重実行時は何もしない。ユーザーがキャンセルした場合も正常終了。
   */
  async run(): Promise<void> {
    if (this.inProgressSignal()) {
      return;
    }

    this.inProgressSignal.set(true);
    try {
      const confirmed = await this.confirmReboot();
      if (!confirmed) {
        this.notify.info(
          'Setup',
          '再起動をスキップしました。カメラ設定などを反映する場合は後から再起動してください',
        );
        return;
      }

      // 親のセットアップダイアログを閉じる（確認ダイアログは既に閉じ済み）
      this.dialogService.close();

      this.expectedDisconnect.beginExpectedDisconnect('reboot');
      this.expectedDisconnect.beginRebootPending();
      try {
        const result = await this.setupReboot.rebootDevice();
        if (result === 'failed') {
          this.expectedDisconnect.clearExpectedDisconnect();
          this.notify.error(
            'Setup',
            '再起動コマンドの実行に失敗しました。シリアル接続を確認してください',
          );
          return;
        }

        await this.cleanupSerialAfterReboot();
        this.notify.info('Setup', '再起動を送信しました');
      } finally {
        this.expectedDisconnect.clearRebootPending();
      }

      await this.showInfoDialog(
        'デバイス再起動中',
        'Raspberry Pi が再起動しています。電源ランプなどが安定するまでしばらくお待ちください。',
      );

      await this.showInfoDialog(
        'Web Serial の再接続',
        '再起動が完了したら、ツールバーの Connect からシリアルポートを選び直してください。ブラウザの権限制約により、再接続にはユーザー操作が必要です。再接続後はオートログインが実行されます。その後 Terminal や他機能を利用できます。',
      );

      const reconnected = await this.waitForReconnect();
      this.expectedDisconnect.clearExpectedDisconnect();

      if (!reconnected) {
        this.notify.warning(
          'Setup',
          '再接続が確認できませんでした。Connect 後に Terminal 等を利用してください',
        );
        return;
      }

      this.notify.success('Setup', '再接続を確認しました');
    } finally {
      this.inProgressSignal.set(false);
    }
  }

  private async confirmReboot(): Promise<boolean> {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title: 'デバイスを再起動',
        message:
          'raspi-config の変更などを反映するためデバイスの再起動を推奨します。シリアル接続が切れます。Editor の未保存内容は同一タブの下書きとして保持されます（タブを閉じると消える場合があります）。再起動しますか？',
        confirmLabel: '再起動',
        cancelLabel: '後で',
      },
    });
    const confirmed = await firstValueFrom(ref.closed);
    return confirmed === true;
  }

  private async showInfoDialog(title: string, message: string): Promise<void> {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title,
        message,
        confirmLabel: '次へ',
        hideCancel: true,
      },
    });
    await firstValueFrom(ref.closed);
  }

  private async cleanupSerialAfterReboot(): Promise<void> {
    try {
      await firstValueFrom(this.serial.disconnect$());
    } catch {
      // 既に切断済みでもセッション掃除を試みるだけなので無視
    }
  }

  private async waitForReconnect(): Promise<boolean> {
    if (this.serial.isConnected()) {
      return true;
    }

    const deadline = Date.now() + RECONNECT_WAIT_MS;
    while (Date.now() < deadline) {
      await delay(RECONNECT_POLL_MS);
      if (this.serial.isConnected()) {
        return true;
      }
    }
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
