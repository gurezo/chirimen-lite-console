import { Component, input, output } from '@angular/core';
import type { WiFiInfo } from '@libs-shared';
import { WifiInfoComponent } from '../wifi-info/wifi-info.component';

/**
 * WiFi スキャン結果の一覧表示（列ヘッダ付き）
 */
@Component({
  selector: 'choh-wifi-list',
  imports: [WifiInfoComponent],
  templateUrl: './wifi-list.component.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class WifiListComponent {
  readonly wifiInfoList = input<WiFiInfo[]>([]);
  readonly scanInProgress = input(false);
  readonly scanError = input<string | null>(null);
  readonly selectedAddress = input<string | null>(null);
  readonly connectedSsid = input<string | null>(null);
  readonly connectDisabled = input(false);

  readonly networkSelected = output<WiFiInfo>();
  readonly networkConnect = output<WiFiInfo>();

  trackKey(info: WiFiInfo, index: number): string {
    return `${info.address}\0${info.ssid}\0${index}`;
  }

  isSelected(info: WiFiInfo): boolean {
    const address = this.selectedAddress();
    return address !== null && address === info.address;
  }

  isConnected(info: WiFiInfo): boolean {
    const connected = this.connectedSsid()?.trim();
    if (!connected) {
      return false;
    }
    return (info.ssid?.trim() ?? '') === connected;
  }
}
