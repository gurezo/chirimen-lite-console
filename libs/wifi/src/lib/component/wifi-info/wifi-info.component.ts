import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { WiFiInfo } from '@libs-shared';

/**
 * 1 件の WiFi ネットワーク情報を表示するカード
 */
@Component({
  selector: 'choh-wifi-info',
  imports: [MatCardModule],
  templateUrl: './wifi-info.component.html',
})
export class WifiInfoComponent {
  readonly wifiInfo = input.required<WiFiInfo>();

  /** カードクリックで接続ダイアログ用に選択 */
  readonly selectNetwork = output<WiFiInfo>();

  onCardActivate(): void {
    this.selectNetwork.emit(this.wifiInfo());
  }
}
