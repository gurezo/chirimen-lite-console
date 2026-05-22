import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';

export interface ExtraSetupStep {
  label: string;
  command: string;
}

/** デバイス側の追加設定（タイムゾーン）。raspi-config は NodeInstall に集約。 */
export const EXTRA_SETUP_STEPS: readonly ExtraSetupStep[] = [
  {
    label: 'タイムゾーンを Asia/Tokyo に設定',
    command: 'sudo timedatectl set-timezone Asia/Tokyo || true',
  },
];

export { EXTRA_SETUP_STEP_COUNT } from './extra-setup.constants';

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
