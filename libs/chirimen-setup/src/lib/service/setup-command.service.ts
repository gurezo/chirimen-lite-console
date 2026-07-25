import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { EXTRA_SETUP_STEPS } from '../constants';
import { ExtraSetupService } from './extra-setup.service';
import { NodeInstallService } from './node-install.service';
import type {
  SetupProgressPhase,
  SetupStepListItem,
  SetupStepProgress,
  SetupStepStatus,
} from '../models';

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

const POST_STEP = {
  label: 'forever プロセスを停止（整地）',
  command: 'forever stopall',
  soft: true,
} as const;

@Injectable({ providedIn: 'root' })
export class SetupCommandService {
  private serial = inject(SerialFacadeService);
  private extraSetup = inject(ExtraSetupService);
  private nodeInstall = inject(NodeInstallService);

  private readonly prompt = PI_ZERO_PROMPT;

  /**
   * 実行予定のステップ一覧（UI の初期表示用）
   */
  buildStepList(options: SetupCommandOptions): SetupStepListItem[] {
    const nodeSteps = this.nodeInstall.buildInstallSteps(options);
    return [
      ...EXTRA_SETUP_STEPS.map((s) => ({
        label: s.label,
        phase: 'extra' as const,
        status: 'pending' as const,
      })),
      ...nodeSteps.map((s) => ({
        label: s.label,
        phase: 'node' as const,
        status: 'pending' as const,
      })),
      {
        label: POST_STEP.label,
        phase: 'post' as const,
        status: 'pending' as const,
      },
    ];
  }

  /**
   * CHIRIMEN 初期セットアップを実行します。
   *
   * issue #412 のコマンド分類に沿って「TZ/デバイス設定 + Node/依存導入」を実行します。
   */
  async run(options: SetupRunOptions): Promise<void> {
    const { onProgress, ...cmdOptions } = options;

    const extraSteps = EXTRA_SETUP_STEPS;
    const nodeSteps = this.nodeInstall.buildInstallSteps(cmdOptions);
    const total = extraSteps.length + nodeSteps.length + 1;

    let stepIndex = 0;

    const emit = (
      phase: SetupProgressPhase,
      label: string,
      command: string,
      stdout: string,
      status: SetupStepStatus,
      stderr?: string,
      errorMessage?: string,
    ) => {
      onProgress?.({
        stepIndex,
        stepTotal: total,
        phase,
        label,
        command,
        stdout,
        stderr,
        status,
        errorMessage,
      });
      stepIndex += 1;
    };

    await this.extraSetup.apply((step, result) => {
      emit(
        'extra',
        step.label,
        step.command,
        result.stdout,
        result.status,
        result.stderr,
        result.errorMessage,
      );
    });

    await this.nodeInstall.install(cmdOptions, (step, result) => {
      emit(
        'node',
        step.label,
        step.command,
        result.stdout,
        result.status,
        result.stderr,
        result.errorMessage,
      );
    });

    try {
      const { stdout, stderr } = await firstValueFrom(
        this.serial.exec$(POST_STEP.command, {
          prompt: this.prompt,
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }),
      );
      emit('post', POST_STEP.label, POST_STEP.command, stdout, 'ok', stderr);
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : 'forever stopall に失敗しました';
      emit(
        'post',
        POST_STEP.label,
        POST_STEP.command,
        '',
        'skipped',
        undefined,
        errorMessage,
      );
    }
  }
}
