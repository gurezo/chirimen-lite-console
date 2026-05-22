import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RemoteStopService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  async stopAll(): Promise<void> {
    await firstValueFrom(this.serial.exec$('forever stopall', {
      prompt: this.prompt,
      timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
    }));
  }

  /**
   * Stops one forever-managed process (uid, index, script name, etc.).
   * @see https://github.com/foreversd/forever — `forever stop` accepts Id|Uid|Pid|Index|Script
   */
  async stopTarget(target: string): Promise<void> {
    const arg = JSON.stringify(target);
    await firstValueFrom(this.serial.exec$(`forever stop ${arg}`, {
      prompt: this.prompt,
      timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
    }));
  }
}
