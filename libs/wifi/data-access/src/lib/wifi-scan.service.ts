import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import {
  parseWifiIfconfigOutput,
  parseWifiIwconfigOutput,
  parseWifiIwlistOutput,
} from '@libs-wifi-util';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  wrapSerialError,
} from '@libs-web-serial';
import type { WiFiInfo } from '@libs-shared-types';
import { firstValueFrom } from 'rxjs';

/**
 * WiFi スキャン・状態取得を担当
 */
@Injectable({
  providedIn: 'root',
})
export class WifiScanService {
  private serial = inject(SerialFacadeService);

  async getWifiStatus(): Promise<{
    ipInfo: string;
    wlInfo: string;
    ipaddr?: string;
  }> {
    try {
      const ifconfigOutput = (
        await firstValueFrom(this.serial.exec$('ifconfig', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }))
      ).stdout;
      const iwconfigOutput = (
        await firstValueFrom(this.serial.exec$('iwconfig', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }))
      ).stdout;

      const { ipInfo, ipaddr } = parseWifiIfconfigOutput(ifconfigOutput);
      const wlInfo = parseWifiIwconfigOutput(iwconfigOutput);

      return { ipInfo, wlInfo, ipaddr };
    } catch (error: unknown) {
      throw wrapSerialError('Failed to get WiFi status', error);
    }
  }

  async scanNetworks(): Promise<{ rawData: string[]; wifiInfos: WiFiInfo[] }> {
    try {
      const output = (
        await firstValueFrom(this.serial.exec$('sudo iwlist wlan0 scan', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.LONG,
        }))
      ).stdout;

      const lines = output.split('\n');
      const wifiInfos = parseWifiIwlistOutput(output);

      return { rawData: lines, wifiInfos };
    } catch (error: unknown) {
      throw wrapSerialError('Failed to scan networks', error);
    }
  }

  async getDetailedWifiStatus(): Promise<string> {
    try {
      return (
        await firstValueFrom(this.serial.exec$('iwconfig wlan0', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }))
      ).stdout;
    } catch (error: unknown) {
      throw wrapSerialError('Failed to get WiFi status', error);
    }
  }

  async getIpAddress(): Promise<string> {
    try {
      const stdout = (
        await firstValueFrom(this.serial.exec$('hostname -I', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }))
      ).stdout;

      const lines = stdout.split('\n');
      const firstLine = lines[0]?.trim() || '';
      const ipAddresses = firstLine.split(/\s+/);
      return ipAddresses[0] || '';
    } catch (error: unknown) {
      throw wrapSerialError('Failed to get IP address', error);
    }
  }

  async showNetworkConfig(): Promise<string> {
    try {
      return (
        await firstValueFrom(this.serial.exec$('cat /etc/network/interfaces', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }))
      ).stdout;
    } catch (error: unknown) {
      throw wrapSerialError('Failed to show network config', error);
    }
  }

  /**
   * tutorial.chirimen.org への疎通確認（#412 診断コマンドに準拠）
   */
  async checkChirimenTutorialReachability(): Promise<string> {
    try {
      const { stdout } = await firstValueFrom(this.serial.exec$(
        'wget --spider -nv https://tutorial.chirimen.org/',
        {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }
      ));
      return stdout;
    } catch (error: unknown) {
      throw wrapSerialError('Connectivity check failed', error);
    }
  }

  /**
   * @deprecated Use getWifiStatus() instead
   */
  async wifiStat(): Promise<{
    ipInfo: string;
    wlInfo: string;
    ipaddr?: string;
  }> {
    return this.getWifiStatus();
  }

  /**
   * @deprecated Use scanNetworks() instead
   */
  async wifiScan(): Promise<{ rawData: string[]; wifiInfos: WiFiInfo[] }> {
    return this.scanNetworks();
  }
}
