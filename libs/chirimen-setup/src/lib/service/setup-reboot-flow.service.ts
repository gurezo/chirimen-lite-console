import { Injectable, inject } from '@angular/core';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

/** デバイス再起動コマンドの結果 */
export type SetupRebootDeviceResult = 'ok' | 'failed';

/**
 * Setup 完了後のデバイス再起動コマンド送信。
 * wifi へ依存せず web-serial のみを利用する。
 */
@Injectable({
  providedIn: 'root',
})
export class SetupRebootFlowService {
  private readonly serial = inject(SerialFacadeService);

  /**
   * デバイスを再起動する。
   * 再起動でシリアルが切れるとタイムアウトや切断エラーになり得る。
   * 切断されていれば成功、接続が残っていればコマンド失敗とみなす。
   */
  async rebootDevice(): Promise<SetupRebootDeviceResult> {
    try {
      await firstValueFrom(
        this.serial.exec$('sudo reboot', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.REBOOT,
        }),
      );
    } catch {
      // 再起動でシリアルが切れるとタイムアウトや切断エラーになり得る
    }

    if (!this.serial.isConnected()) {
      return 'ok';
    }
    return 'failed';
  }
}
