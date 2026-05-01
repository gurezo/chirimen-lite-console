import { Injectable, inject } from '@angular/core';
import { FileContentService } from './file-content.service';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { FileUtils, shellSingleQuote } from '@libs-wifi-util';
import { WifiRebootFlowService } from './wifi-reboot-flow.service';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  wrapSerialError,
} from '@libs-web-serial-util';
import { firstValueFrom } from 'rxjs';

/**
 * WiFi 設定（setWiFi / configureWifi）を担当
 */
@Injectable({
  providedIn: 'root',
})
export class WifiConfigService {
  private serial = inject(SerialFacadeService);
  private fileContent = inject(FileContentService);
  private rebootFlow = inject(WifiRebootFlowService);

  /**
   * WiFi を設定（スクリプト方式）
   */
  async setWiFi(ssid: string, password: string): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$('cd', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
      await firstValueFrom(this.serial.exec$('sudo touch /boot/ssh', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));

      const wifiSetupScript = this.generateWifiSetupScript();

      await this.fileContent.writeTextFile('wifi_setup.sh', wifiSetupScript);

      const qSsid = shellSingleQuote(ssid);
      const qPass = shellSingleQuote(password);
      await firstValueFrom(this.serial.exec$(
        `chmod +x wifi_setup.sh && ./wifi_setup.sh ${qSsid} ${qPass}`,
        {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.LONG,
        }
      ));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to set WiFi', error);
    }
  }

  /**
   * WiFi を設定（wpa_supplicant 方式）
   */
  async configureWifi(ssid: string, password: string): Promise<void> {
    try {
      const configContent = this.generateWpaSupplicantConfig(ssid, password);

      await this.saveWifiConfig(configContent);

      await this.rebootFlow.restartWifiService();
    } catch (error: unknown) {
      throw wrapSerialError('WiFi configuration failed', error);
    }
  }

  private generateWifiSetupScript(): string {
    return `#!/bin/sh
set -eu

SSID=$1
PASSWORD=$2
DEBIAN_VERSION=$(cut -d . -f 1 /etc/debian_version)

if [ "$DEBIAN_VERSION" -le 11 ]; then
  WPA_CONF_PATH=/etc/wpa_supplicant/wpa_supplicant.conf
  sudo sh -c "cat > $WPA_CONF_PATH" <<EOL
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=JP
network={
  ssid="$SSID"
  psk="$PASSWORD"
}
EOL
  sudo wpa_cli -i wlan0 reconfigure
else
  sudo nmcli dev wifi connect "$SSID" password "$PASSWORD"
fi
`;
  }

  private generateWpaSupplicantConfig(ssid: string, password: string): string {
    return `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=JP

network={
  ssid="${ssid}"
  psk="${password}"
}
`;
  }

  private async saveWifiConfig(configContent: string): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$(
        'sudo cp /etc/wpa_supplicant/wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf.backup',
        {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }
      ));

      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(configContent);
      const base64 = FileUtils.arrayBufferToBase64(uint8Array.buffer);

      await firstValueFrom(this.serial.send$('\x03'));
      await this.sleep(100);

      await firstValueFrom(this.serial.exec$(
        'sudo tee /etc/wpa_supplicant/wpa_supplicant.conf > /dev/null',
        {
          prompt: '\n',
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }
      ));
      await firstValueFrom(this.serial.exec$(base64, {
        prompt: '\n',
        timeout: SERIAL_TIMEOUT.LINE,
      }));

      await firstValueFrom(this.serial.send$('\x04'));
      await this.sleep(10);
    } catch (error: unknown) {
      throw wrapSerialError('Failed to save WiFi config', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
