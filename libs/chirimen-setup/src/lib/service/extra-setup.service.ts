import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { EXTRA_SETUP_STEPS } from '../constants';
import type { ExtraSetupStep } from '../models';
import type { SetupStepStatus } from '../models';

export type { ExtraSetupStep } from '../models';
export { EXTRA_SETUP_STEP_COUNT } from '../constants';

export type ExtraSetupAfterStep = (
  step: ExtraSetupStep,
  result: {
    stdout: string;
    stderr?: string;
    status: SetupStepStatus;
    errorMessage?: string;
  },
) => void;

@Injectable({ providedIn: 'root' })
export class ExtraSetupService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  /**
   * @param onAfterStep 各コマンド完了時（soft ステップは失敗しても継続）
   */
  async apply(onAfterStep?: ExtraSetupAfterStep): Promise<void> {
    for (const step of EXTRA_SETUP_STEPS) {
      try {
        const { stdout, stderr } = await firstValueFrom(
          this.serial.exec$(step.command, {
            prompt: this.prompt,
            timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
          }),
        );
        onAfterStep?.(step, { stdout, stderr, status: 'ok' });
      } catch (e: unknown) {
        const errorMessage =
          e instanceof Error ? e.message : 'コマンドの実行に失敗しました';
        onAfterStep?.(step, {
          stdout: '',
          status: step.soft ? 'skipped' : 'failed',
          errorMessage,
        });
        if (!step.soft) {
          throw e instanceof Error
            ? e
            : new Error(errorMessage);
        }
      }
    }
  }
}
