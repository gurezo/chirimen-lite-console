import { Injectable, inject } from '@angular/core';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { isSetupReady } from '../functions';

export interface SetupReadyCheckResult {
  ready: boolean;
  nodeStdout: string;
  npmStdout: string;
}

/**
 * セットアップ完了後に node / npm が使えるかを検証する。
 */
@Injectable({
  providedIn: 'root',
})
export class SetupReadyCheckService {
  private readonly serial = inject(SerialFacadeService);

  async check(): Promise<SetupReadyCheckResult> {
    // 新規シェルでも PATH が効くようプロファイルを読む
    try {
      await firstValueFrom(
        this.serial.exec$('. ~/.profile', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }),
      );
    } catch {
      // profile 読込失敗でもバージョン確認は試す
    }

    let nodeStdout: string;
    try {
      const node = await firstValueFrom(
        this.serial.exec$('node -v', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }),
      );
      nodeStdout = node.stdout;
    } catch (e: unknown) {
      nodeStdout = e instanceof Error ? e.message : '';
    }

    let npmStdout: string;
    try {
      const npm = await firstValueFrom(
        this.serial.exec$('npm -v', {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }),
      );
      npmStdout = npm.stdout;
    } catch (e: unknown) {
      npmStdout = e instanceof Error ? e.message : '';
    }

    return {
      ready: isSetupReady(nodeStdout, npmStdout),
      nodeStdout,
      npmStdout,
    };
  }
}
