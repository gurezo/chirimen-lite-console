import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  wrapSerialError,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

/**
 * WiFi 再起動・有効/無効のフローを担当
 */
@Injectable({
  providedIn: 'root',
})
export class WifiRebootFlowService {
  private serial = inject(SerialFacadeService);

  /**
   * WiFi サービスを再起動（wpa_supplicant + networking）
   */
  async restartWifiService(): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$('sudo systemctl restart wpa_supplicant', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));

      await firstValueFrom(this.serial.exec$('sudo systemctl restart networking', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to restart WiFi service', error);
    }
  }

  /**
   * WiFi を有効化
   */
  async enableWifi(): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$('sudo ifconfig wlan0 up', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to enable WiFi', error);
    }
  }

  /**
   * WiFi を無効化
   */
  async disableWifi(): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$('sudo ifconfig wlan0 down', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to disable WiFi', error);
    }
  }

  /**
   * デバイスを再起動（プロンプトが返らない場合があるため短めのタイムアウト）
   */
  async rebootDevice(): Promise<void> {
    try {
      await firstValueFrom(this.serial.exec$('sudo reboot', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.REBOOT,
      }));
    } catch {
      // 再起動でシリアルが切れるとタイムアウトや切断エラーになり得る
    }
  }
}
