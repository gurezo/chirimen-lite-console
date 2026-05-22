import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RemoteStatusService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  async listPlain(): Promise<string> {
    return (
      await firstValueFrom(this.serial.exec$('forever list --plain', {
        prompt: this.prompt,
        timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
      }))
    ).stdout;
  }
}
