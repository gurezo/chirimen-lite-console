import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { buildNodeInstallStepList } from '../functions';
import type { NodeInstallOptions, NodeInstallStep } from '../models';
import type { SetupStepStatus } from '../models';

export type { NodeInstallOptions, NodeInstallStep } from '../models';
export { buildNodeInstallStepList } from '../functions';

export type NodeInstallAfterStep = (
  step: NodeInstallStep,
  result: {
    stdout: string;
    stderr?: string;
    status: SetupStepStatus;
    errorMessage?: string;
  },
) => void;

@Injectable({ providedIn: 'root' })
export class NodeInstallService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  buildInstallSteps(options: NodeInstallOptions): NodeInstallStep[] {
    return buildNodeInstallStepList(options);
  }

  /**
   * Node.js をインストールして、chirimen 用の依存まで導入します。
   * soft でないステップの失敗時は fail-fast します。
   */
  async install(
    options: NodeInstallOptions,
    onAfterStep?: NodeInstallAfterStep,
  ): Promise<void> {
    const steps = this.buildInstallSteps(options);
    for (const step of steps) {
      try {
        const { stdout, stderr } = await firstValueFrom(
          this.serial.exec$(step.command, {
            prompt: this.prompt,
            timeout: SERIAL_TIMEOUT.NODE_INSTALL,
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
