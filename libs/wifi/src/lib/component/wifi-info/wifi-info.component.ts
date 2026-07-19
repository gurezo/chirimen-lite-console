import { Component, computed, input, output } from '@angular/core';
import type { WiFiInfo } from '@libs-shared';
import { ButtonComponent } from '@libs-shared';
import {
  formatWifiSecurity,
  formatWifiSignal,
  formatWifiSsidLabel,
} from '../../functions';

/**
 * 1 件の WiFi ネットワークを列揃えの行として表示する
 */
@Component({
  selector: 'choh-wifi-info',
  imports: [ButtonComponent],
  templateUrl: './wifi-info.component.html',
  host: {
    role: 'listitem',
    tabindex: '0',
    class:
      'grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:outline-none sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]',
    '[class.bg-blue-50]': 'selected()',
    '[attr.aria-selected]': 'selected()',
    '(click)': 'onRowActivate()',
    '(keydown.enter)': 'onRowActivate()',
    '(keydown.space)': 'onRowSpace($event)',
  },
})
export class WifiInfoComponent {
  readonly wifiInfo = input.required<WiFiInfo>();
  readonly selected = input(false);
  readonly connected = input(false);
  readonly connectDisabled = input(false);

  /** 行選択 */
  readonly selectNetwork = output<WiFiInfo>();
  /** 接続ダイアログを開く */
  readonly connectNetwork = output<WiFiInfo>();

  readonly ssidLabel = computed(() => formatWifiSsidLabel(this.wifiInfo().ssid));
  readonly signalLabel = computed(() =>
    formatWifiSignal(this.wifiInfo().quality),
  );
  readonly securityLabel = computed(() =>
    formatWifiSecurity(this.wifiInfo().spec),
  );
  readonly fullSsidTitle = computed(() => {
    const ssid = this.wifiInfo().ssid?.trim();
    return ssid && ssid.length > 0 ? ssid : '（非公開）';
  });

  onRowActivate(): void {
    this.selectNetwork.emit(this.wifiInfo());
  }

  onRowSpace(event: Event): void {
    event.preventDefault();
    this.onRowActivate();
  }

  onConnectClick(): void {
    this.connectNetwork.emit(this.wifiInfo());
  }
}
