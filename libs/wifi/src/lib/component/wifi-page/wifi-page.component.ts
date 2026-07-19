import { Dialog } from '@angular/cdk/dialog';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogComponent } from '@libs-dialogs';
import type { WiFiInfo } from '@libs-shared';
import { ButtonComponent, NotificationService } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { parseConnectedSsid } from '../../functions';
import type { WifiConnectDialogData } from '../../models';
import {
  WifiPostConnectRebootFlowService,
  WifiRebootFlowService,
  WifiScanService,
} from '../../service';
import { WifiConnectDialogComponent } from '../wifi-connect-dialog/wifi-connect-dialog.component';
import { WifiListComponent } from '../wifi-list/wifi-list.component';

/**
 * WiFi 設定画面（スマートコンポーネント）
 *
 * ui の list と data-access のサービスを組み合わせる
 */
@Component({
  selector: 'choh-wifi-page',
  imports: [ButtonComponent, WifiListComponent, MatDividerModule],
  templateUrl: './wifi-page.component.html',
  host: {
    class: 'flex min-h-0 h-full w-full flex-col',
  },
})
export class WifiPageComponent implements OnInit {
  readonly wifiInfoList = signal<WiFiInfo[]>([]);
  readonly scanInProgress = signal(false);
  readonly actionInProgress = signal(false);
  readonly scanError = signal<string | null>(null);
  readonly selectedAddress = signal<string | null>(null);
  readonly connectedSsid = signal<string | null>(null);

  private readonly dialog = inject(Dialog);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly wifiScan = inject(WifiScanService);
  private readonly wifiReboot = inject(WifiRebootFlowService);
  private readonly postConnectReboot = inject(WifiPostConnectRebootFlowService);

  /** 通常アクションまたは再起動フロー中は操作をロックする（#732）。 */
  readonly busy = computed(
    () => this.actionInProgress() || this.postConnectReboot.inProgress(),
  );

  ngOnInit(): void {
    void this.runWifiScan();
  }

  private async ensureSerial(): Promise<boolean> {
    const ok = this.serial.isConnected();
    if (!ok) {
      this.notify.warning('WiFi', 'シリアル接続してください');
      return false;
    }
    return true;
  }

  private async refreshConnectedSsid(): Promise<void> {
    try {
      const { wlInfo } = await this.wifiScan.getWifiStatus();
      this.connectedSsid.set(parseConnectedSsid(wlInfo));
    } catch {
      // 接続中 SSID は補助情報のため、失敗しても一覧表示は継続する
    }
  }

  async runWifiScan(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.scanInProgress.set(true);
    this.scanError.set(null);
    try {
      const { wifiInfos } = await this.wifiScan.scanNetworks();
      this.wifiInfoList.set(wifiInfos);
      this.selectedAddress.set(null);
      await this.refreshConnectedSsid();
      this.notify.success(
        'WiFi',
        `ネットワークを ${wifiInfos.length} 件取得しました`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'スキャンに失敗しました';
      this.scanError.set(msg);
      this.notify.error('WiFi', msg);
    } finally {
      this.scanInProgress.set(false);
    }
  }

  openConnectDialog(initialSsid?: string, ssidReadonly = false): void {
    void (async () => {
      if (!(await this.ensureSerial())) {
        return;
      }
      const ref = this.dialog.open(WifiConnectDialogComponent, {
        width: '400px',
        disableClose: false,
        data: { initialSsid, ssidReadonly } satisfies WifiConnectDialogData,
      });
      const ok = await firstValueFrom(ref.closed);
      if (ok) {
        await this.refreshAfterConnect();
        await this.postConnectReboot.run({
          afterReconnect: () => this.refreshAfterConnect(),
        });
      }
    })();
  }

  /**
   * 接続成功後に一覧と接続中 SSID を更新する（成功トーストはダイアログ側）。
   */
  private async refreshAfterConnect(): Promise<void> {
    this.scanInProgress.set(true);
    this.scanError.set(null);
    try {
      const { wifiInfos } = await this.wifiScan.scanNetworks();
      this.wifiInfoList.set(wifiInfos);
      await this.refreshConnectedSsid();
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : '接続後の一覧更新に失敗しました';
      this.scanError.set(msg);
      this.notify.error('WiFi', msg);
    } finally {
      this.scanInProgress.set(false);
    }
  }

  onNetworkSelected(info: WiFiInfo): void {
    this.selectedAddress.set(info.address);
  }

  onNetworkConnect(info: WiFiInfo): void {
    this.selectedAddress.set(info.address);
    const ssid = info.ssid?.trim();
    this.openConnectDialog(ssid || undefined, Boolean(ssid));
  }

  openManualConnectDialog(): void {
    const address = this.selectedAddress();
    if (address) {
      const selected = this.wifiInfoList().find((w) => w.address === address);
      const ssid = selected?.ssid?.trim();
      this.openConnectDialog(ssid || undefined, Boolean(ssid));
      return;
    }
    this.openConnectDialog();
  }

  async showWifiInfo(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      const { ipInfo, wlInfo, ipaddr } = await this.wifiScan.getWifiStatus();
      this.connectedSsid.set(parseConnectedSsid(wlInfo));
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
    await this.postConnectReboot.run({
      afterReconnect: () => this.refreshAfterConnect(),
    });
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
