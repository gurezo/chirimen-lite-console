import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { EXTRA_SETUP_STEPS } from '../constants';
import {
  ExtraSetupService,
  type ExtraSetupStep,
} from './extra-setup.service';
import { NodeInstallService, type NodeInstallStep } from './node-install.service';
import type { SetupStepProgress } from '../models';

export interface SetupCommandOptions {
  /**
   * Node.js tarball URL（unofficial-builds）
   */
  nodeTarUrl: string;
  /**
   * chirimenSetup 配下の作業ディレクトリ（任意）
   */
  projectSubdir?: string;
}

export interface SetupRunOptions extends SetupCommandOptions {
  onProgress?: (progress: SetupStepProgress) => void;
}

@Injectable({ providedIn: 'root' })
export class SetupCommandService {
  private serial = inject(SerialFacadeService);
  private extraSetup = inject(ExtraSetupService);
  private nodeInstall = inject(NodeInstallService);

  private readonly prompt = PI_ZERO_PROMPT;

  /**
   * CHIRIMEN 初期セットアップを実行します。
   *
   * issue #412 のコマンド分類に沿って「TZ/デバイス設定 + Node/依存導入」を実行します。
   */
  async run(options: SetupRunOptions): Promise<void> {
    const { onProgress, ...cmdOptions } = options;

    const postStep = {
      label: 'forever プロセスを停止（整地）',
      command: 'forever stopall',
    } as const;

    const extraSteps = EXTRA_SETUP_STEPS;
    const nodeSteps = this.nodeInstall.buildInstallSteps(cmdOptions);
    const total = extraSteps.length + nodeSteps.length + 1;

    let stepIndex = 0;

    const emit = (
      phase: SetupStepProgress['phase'],
      label: string,
      command: string,
      stdout: string,
    ) => {
      onProgress?.({
        stepIndex,
        stepTotal: total,
        phase,
        label,
        command,
        stdout,
      });
      stepIndex += 1;
    };

    await this.extraSetup.apply((step: ExtraSetupStep, stdout: string) => {
      emit('extra', step.label, step.command, stdout);
    });

    await this.nodeInstall.install(cmdOptions, (step: NodeInstallStep, stdout) => {
      emit('node', step.label, step.command, stdout);
    });

    try {
      const { stdout } = await firstValueFrom(this.serial.exec$(postStep.command, {
        prompt: this.prompt,
        timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
      }));
      emit('post', postStep.label, postStep.command, stdout);
    } catch {
      emit('post', postStep.label, postStep.command, '');
    }
  }
}
