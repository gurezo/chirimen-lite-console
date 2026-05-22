import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import {
  buildNodeInstallStepList,
  type NodeInstallOptions,
  type NodeInstallStep,
} from './node-install.steps';

export type { NodeInstallOptions, NodeInstallStep } from './node-install.steps';
export { buildNodeInstallStepList } from './node-install.steps';

@Injectable({ providedIn: 'root' })
export class NodeInstallService {
  private serial = inject(SerialFacadeService);
  private readonly prompt = PI_ZERO_PROMPT;

  buildInstallSteps(options: NodeInstallOptions): NodeInstallStep[] {
    return buildNodeInstallStepList(options);
  }

  /**
   * Node.js をインストールして、chirimen 用の依存まで導入します。
   */
  async install(
    options: NodeInstallOptions,
    onAfterStep?: (step: NodeInstallStep, stdout: string) => void,
  ): Promise<void> {
    const steps = this.buildInstallSteps(options);
    for (const step of steps) {
      const { stdout } = await firstValueFrom(this.serial.exec$(step.command, {
        prompt: this.prompt,
        timeout: SERIAL_TIMEOUT.NODE_INSTALL,
      }));
      onAfterStep?.(step, stdout);
    }
  }
}
