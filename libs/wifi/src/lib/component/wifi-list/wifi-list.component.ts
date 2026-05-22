import { Component, input, output } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import type { WiFiInfo } from '@libs-shared';
import { WifiInfoComponent } from '../wifi-info/wifi-info.component';

/**
 * WiFi スキャン結果の一覧表示
 */
@Component({
  selector: 'choh-wifi-list',
  imports: [WifiInfoComponent, MatDividerModule],
  templateUrl: './wifi-list.component.html',
})
export class WifiListComponent {
  readonly wifiInfoList = input<WiFiInfo[]>([]);

  readonly networkSelected = output<WiFiInfo>();
}
