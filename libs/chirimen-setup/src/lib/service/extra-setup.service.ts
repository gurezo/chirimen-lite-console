import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { EXTRA_SETUP_STEPS } from '../constants/setup.constants';
import type { ExtraSetupStep } from '../models/extra-setup.types';

export type { ExtraSetupStep } from '../models/extra-setup.types';
export { EXTRA_SETUP_STEP_COUNT } from '../constants/setup.constants';

@Injectable({ providedIn: 'root' })
export class ExtraSetupService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  /**
   * @param onAfterStep 各コマンド完了時（失敗時も best-effort で通知）
   */
  async apply(
    onAfterStep?: (step: ExtraSetupStep, stdout: string) => void,
  ): Promise<void> {
    for (const step of EXTRA_SETUP_STEPS) {
      try {
        const { stdout } = await firstValueFrom(this.serial.exec$(step.command, {
          prompt: this.prompt,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }));
        onAfterStep?.(step, stdout);
      } catch {
        onAfterStep?.(step, '');
      }
    }
  }
}
