import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RemoteRunService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  /**
   * forever でプロセスを起動します。
   *
   * @param scriptPath Remote 上の JS ファイルパス（例: RelayServer.js）
   */
  async start(scriptPath: string, args: string[] = []): Promise<void> {
    const quotedPath = JSON.stringify(scriptPath);
    const argsPart = args.length
      ? ` ${args.map((a) => JSON.stringify(a)).join(' ')}`
      : '';
    // -w は start の待ち合わせ（環境依存のため長めの timeout）
    await firstValueFrom(
      this.serial.exec$(`forever start -w ${quotedPath}${argsPart}`, {
        prompt: this.prompt,
        timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
      }),
    );
  }
}
