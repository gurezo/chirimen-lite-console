import { Component, input } from '@angular/core';
import type { WifiStatusData } from '../../models/wifi-status.types';

/**
 * WiFi 接続状態（IP / iwconfig 等）の表示
 */
@Component({
  selector: 'choh-wifi-status',
  templateUrl: './wifi-status.component.html',
})
export class WifiStatusComponent {
  readonly status = input<WifiStatusData | null>(null);
}
