import { Dialog } from '@angular/cdk/dialog';
import { Injectable, inject, signal } from '@angular/core';
import { ConfirmDialogComponent } from '@libs-dialogs';
import { NotificationService } from '@libs-shared';
import {
  SerialExpectedDisconnectService,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { WifiRebootFlowService } from './wifi-reboot-flow.service';

const RECONNECT_POLL_MS = 500;
/** 再接続待ちの上限（ブラウザ操作が必要なため長め）。 */
const RECONNECT_WAIT_MS = 10 * 60 * 1000;

export interface WifiPostConnectRebootFlowOptions {
  /** 再接続成功後に Wi-Fi 状態を再取得するコールバック */
  afterReconnect?: () => Promise<void>;
}

/**
 * Wi-Fi 設定成功後（および手動 Reboot）の確認付き再起動〜再接続案内フロー（#732）。
 */
@Injectable({
  providedIn: 'root',
})
export class WifiPostConnectRebootFlowService {
  private readonly dialog = inject(Dialog);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly wifiReboot = inject(WifiRebootFlowService);
  private readonly expectedDisconnect = inject(
    SerialExpectedDisconnectService,
  );

  private readonly inProgressSignal = signal(false);
  readonly inProgress = this.inProgressSignal.asReadonly();

  /**
   * 再起動確認 → コマンド送信 → 切断クリーンアップ → 再接続案内 → 再取得。
   * 二重実行時は何もしない。ユーザーがキャンセルした場合も正常終了。
   */
  async run(options: WifiPostConnectRebootFlowOptions = {}): Promise<void> {
    if (this.inProgressSignal()) {
      return;
    }

    this.inProgressSignal.set(true);
    try {
      const confirmed = await this.confirmReboot();
      if (!confirmed) {
        return;
      }

      this.expectedDisconnect.beginExpectedDisconnect('reboot');
      this.expectedDisconnect.beginRebootPending();
      try {
        const result = await this.wifiReboot.rebootDevice();
        if (result === 'failed') {
          this.expectedDisconnect.clearExpectedDisconnect();
          this.notify.error(
            'WiFi',
            '再起動コマンドの実行に失敗しました。シリアル接続を確認してください',
          );
          return;
        }

        await this.cleanupSerialAfterReboot();
        this.notify.info('WiFi', '再起動を送信しました');
      } finally {
        // 再接続案内中は Connect 操作を妨げないよう、切断完了時点で UI ブロックを解除する（#754）
        this.expectedDisconnect.clearRebootPending();
      }

      await this.showInfoDialog(
        'デバイス再起動中',
        'Raspberry Pi が再起動しています。電源ランプなどが安定するまでしばらくお待ちください。',
      );

      await this.showInfoDialog(
        'Web Serial の再接続',
        '再起動が完了したら、ツールバーの Connect からシリアルポートを選び直してください。ブラウザの権限制約により、再接続にはユーザー操作が必要です。再接続後はオートログインが実行されます。',
      );

      const reconnected = await this.waitForReconnect();
      this.expectedDisconnect.clearExpectedDisconnect();

      if (!reconnected) {
        this.notify.warning(
          'WiFi',
          '再接続が確認できませんでした。Connect 後に Wi-Fi 画面で再スキャンしてください',
        );
        return;
      }

      if (options.afterReconnect) {
        try {
          await options.afterReconnect();
        } catch (e: unknown) {
          const msg =
            e instanceof Error ? e.message : '再接続後の状態取得に失敗しました';
          this.notify.error('WiFi', msg);
        }
      }
    } finally {
      this.inProgressSignal.set(false);
    }
  }

  private async confirmReboot(): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'デバイスを再起動',
        message:
          'Wi-Fi 設定を反映するためデバイスを再起動します。シリアル接続が切れます。Editor の未保存内容は同一タブの下書きとして保持されます（タブを閉じると消える場合があります）。続行しますか？',
        confirmLabel: '再起動',
        cancelLabel: 'キャンセル',
      },
    });
    const confirmed = await firstValueFrom(ref.closed);
    return confirmed === true;
  }

  private async showInfoDialog(title: string, message: string): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
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
