import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_NODE_TAR_URL,
  DEFAULT_PROJECT_SUBDIR,
} from '../../constants';
import {
  buildSetupRetryMessage,
  isValidNodeTarUrl,
  sanitizeProjectSubdir,
} from '../../functions';
import {
  SetupCommandService,
  SetupPostSetupRebootFlowService,
  SetupReadyCheckService,
} from '../../service';
import type { SetupStepListItem, SetupStepProgress } from '../../models';
import { SetupExecuteButtonComponent } from '../setup-execute-button/setup-execute-button.component';
import { SetupProgressComponent } from '../setup-progress/setup-progress.component';
import { SetupStepListComponent } from '../setup-step-list/setup-step-list.component';
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import { NotificationService } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'lib-setup-page',
  imports: [
    MatDividerModule,
    SetupProgressComponent,
    SetupExecuteButtonComponent,
    SetupStepListComponent,
  ],
  templateUrl: './setup-page.component.html',
})
export class SetupPageComponent {
  private readonly dialogService = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly setup = inject(SetupCommandService);
  private readonly readyCheck = inject(SetupReadyCheckService);
  private readonly postSetupReboot = inject(SetupPostSetupRebootFlowService);

  private readonly logArea = viewChild<ElementRef<HTMLTextAreaElement>>('logArea');

  readonly nodeTarUrl = signal(DEFAULT_NODE_TAR_URL);
  readonly useProjectSubdir = signal(true);
  readonly projectSubdir = signal(DEFAULT_PROJECT_SUBDIR);

  readonly setupRunning = signal(false);
  readonly progressPercent = signal(0);
  readonly currentLabel = signal('');
  readonly logText = signal('');
  readonly stepItems = signal<SetupStepListItem[]>([]);
  readonly retryGuidance = signal('');

  /** セットアップ実行中、または再起動案内フロー中 */
  readonly inProgress = computed(
    () => this.setupRunning() || this.postSetupReboot.inProgress(),
  );

  closeModal(): void {
    this.dialogService.close();
  }

  onTarUrlInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.nodeTarUrl.set(v);
  }

  onSubdirInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.projectSubdir.set(v);
  }

  onUseSubdirChange(ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.useProjectSubdir.set(checked);
  }

  private resolveOptions() {
    return {
      nodeTarUrl: this.nodeTarUrl().trim(),
      projectSubdir: this.useProjectSubdir()
        ? sanitizeProjectSubdir(this.projectSubdir())
        : undefined,
    };
  }

  private appendLog(p: SetupStepProgress): void {
    const errLine = p.stderr?.trim() ? `\n[stderr]\n${p.stderr}` : '';
    const statusLine = p.errorMessage
      ? `\n[status=${p.status}] ${p.errorMessage}`
      : `\n[status=${p.status}]`;
    const block = `\n--- [${p.phase}] ${p.label} ---${statusLine}\n$ ${p.command}\n${p.stdout}${errLine}\n`;
    this.logText.update((t) => t + block);
    queueMicrotask(() => {
      const el = this.logArea()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private updateStepStatus(p: SetupStepProgress): void {
    this.stepItems.update((items) => {
      if (items.length === 0) {
        return items;
      }
      const next = items.map((item) => ({ ...item }));
      if (p.stepIndex >= 0 && p.stepIndex < next.length) {
        next[p.stepIndex] = {
          ...next[p.stepIndex],
          status: p.status,
        };
      }
      return next;
    });
  }

  private async confirmRun(): Promise<boolean> {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title: 'CHIRIMEN セットアップを実行',
        message: [
          '次の処理を Web Serial 経由で実行します。',
          '',
          '・Node.js（linux-armv6l）の取得・展開と PATH 設定',
          '・raspi-config によるカメラ関連設定の変更',
          '・CHIRIMEN 用 package.json / RelayServer.js の取得と npm install',
          '・forever の導入と既存プロセスの停止',
          '',
          '所要時間は数十分かかる場合があります。',
          'インターネット接続と十分なディスク容量が必要です。',
          'システム設定が変更され、再起動が必要になることがあります。',
          '',
          '実行しますか？',
        ].join('\n'),
        confirmLabel: '実行',
        cancelLabel: 'キャンセル',
      },
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  async runSetup(): Promise<void> {
    const connected = this.serial.isConnected();
    if (!connected) {
      this.notify.warning('Setup', 'シリアル接続してください');
      return;
    }
    const url = this.nodeTarUrl().trim();
    if (!isValidNodeTarUrl(url)) {
      this.notify.error(
        'Setup',
        'Node の tarball URL は https://unofficial-builds.nodejs.org/ 配下の有効な URL を指定してください',
      );
      return;
    }

    if (!(await this.confirmRun())) {
      return;
    }

    const options = this.resolveOptions();
    this.setupRunning.set(true);
    this.logText.set('');
    this.retryGuidance.set('');
    this.progressPercent.set(0);
    this.currentLabel.set('開始…');
    this.stepItems.set(this.setup.buildStepList(options));

    let lastFailed: SetupStepProgress | undefined;

    try {
      await this.setup.run({
        ...options,
        onProgress: (p: SetupStepProgress) => {
          const pct = Math.round(((p.stepIndex + 1) / p.stepTotal) * 100);
          this.progressPercent.set(Math.min(100, pct));
          this.currentLabel.set(p.label);
          this.appendLog(p);
          this.updateStepStatus(p);
          if (p.status === 'failed') {
            lastFailed = p;
          }
        },
      });

      this.currentLabel.set('完了確認中…');
      const ready = await this.readyCheck.check();
      this.logText.update(
        (t) =>
          t +
          `\n--- [verify] node/npm ---\nnode: ${ready.nodeStdout.trim()}\nnpm: ${ready.npmStdout.trim()}\nready: ${ready.ready}\n`,
      );

      if (ready.ready) {
        this.notify.success(
          'Setup',
          'セットアップが完了しました。Terminal 等を利用できます',
        );
      } else {
        this.notify.warning(
          'Setup',
          'コマンドは完了しましたが node/npm の確認に失敗しました。ログを確認してください',
        );
      }

      // raspi-config 変更反映のため再起動を案内
      await this.postSetupReboot.run();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'セットアップに失敗しました';
      this.notify.error('Setup', msg);
      if (lastFailed) {
        this.retryGuidance.set(buildSetupRetryMessage(lastFailed));
      } else {
        this.retryGuidance.set(
          [
            `セットアップに失敗しました: ${msg}`,
            '',
            '再試行手順:',
            '1. ログとシリアル接続を確認してください',
            '2. 問題を解消したら、もう一度「セットアップ実行」を押してください',
          ].join('\n'),
        );
      }
    } finally {
      this.setupRunning.set(false);
      this.currentLabel.set('');
    }
  }
}
