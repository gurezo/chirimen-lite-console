import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogComponent } from '@libs-dialogs-ui';
import type { WiFiInfo } from '@libs-shared-types';
import { ButtonComponent, NotificationService } from '@libs-shared-ui';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { WifiRebootFlowService, WifiScanService } from '@libs-wifi-data-access';
import {
  WifiConnectDialogComponent,
  type WifiConnectDialogData,
  WifiListComponent,
} from '@libs-wifi-ui';
import { firstValueFrom, take } from 'rxjs';

/**
 * WiFi 設定画面（スマートコンポーネント）
 *
 * ui の list と data-access のサービスを組み合わせる
 */
@Component({
  selector: 'choh-wifi-page',
  imports: [ButtonComponent, WifiListComponent, MatDividerModule],
  templateUrl: './wifi-page.component.html',
})
export class WifiPageComponent {
  wifiInfoList: WiFiInfo[] = [];
  readonly scanInProgress = signal(false);
  readonly actionInProgress = signal(false);

  private readonly dialog = inject(Dialog);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly wifiScan = inject(WifiScanService);
  private readonly wifiReboot = inject(WifiRebootFlowService);

  private async ensureSerial(): Promise<boolean> {
    const ok = await firstValueFrom(
      this.serial.isConnected$.pipe(take(1)),
    );
    if (!ok) {
      this.notify.warning('WiFi', 'シリアル接続してください');
      return false;
    }
    return true;
  }

  async runWifiScan(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.scanInProgress.set(true);
    try {
      const { wifiInfos } = await this.wifiScan.scanNetworks();
      this.wifiInfoList = wifiInfos;
      this.notify.success(
        'WiFi',
        `ネットワークを ${wifiInfos.length} 件取得しました`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'スキャンに失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.scanInProgress.set(false);
    }
  }

  openConnectDialog(initialSsid?: string): void {
    void (async () => {
      if (!(await this.ensureSerial())) {
        return;
      }
      this.dialog.open(WifiConnectDialogComponent, {
        width: '400px',
        data: { initialSsid } satisfies WifiConnectDialogData,
      });
    })();
  }

  onNetworkSelected(info: WiFiInfo): void {
    const ssid = info.ssid?.trim();
    this.openConnectDialog(ssid || undefined);
  }

  async showWifiInfo(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      const { ipInfo, wlInfo, ipaddr } = await this.wifiScan.getWifiStatus();
      const body = [ipInfo, wlInfo, ipaddr ? `IP: ${ipaddr}` : '']
        .filter(Boolean)
        .join('\n\n');
      this.dialog.open(ConfirmDialogComponent, {
        width: '520px',
        data: {
          title: 'WiFi / ネットワーク情報',
          message: body || '情報を取得できませんでした',
          confirmLabel: '閉じる',
          hideCancel: true,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '取得に失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async resetWifi(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      await this.wifiReboot.restartWifiService();
      this.notify.success('WiFi', 'WiFi サービスを再起動しました');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '再起動に失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async rebootDevice(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'デバイスを再起動',
        message: 'シリアル接続が切れる場合があります。続行しますか？',
        confirmLabel: '再起動',
        cancelLabel: 'キャンセル',
      },
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      await this.wifiReboot.rebootDevice();
      this.notify.info('WiFi', '再起動を送信しました');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '再起動に失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async checkConnectivity(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      const out = await this.wifiScan.checkChirimenTutorialReachability();
      this.dialog.open(ConfirmDialogComponent, {
        width: '480px',
        data: {
          title: '疎通確認（tutorial.chirimen.org）',
          message: out.trim() || '完了（出力なし）',
          confirmLabel: '閉じる',
          hideCancel: true,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '疎通確認に失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
