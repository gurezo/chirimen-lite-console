import {
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  DEFAULT_NODE_TAR_URL,
  DEFAULT_PROJECT_SUBDIR,
  isValidNodeTarUrl,
  sanitizeProjectSubdir,
} from '@libs-chirimen-setup-util';
import {
  SetupCommandService,
  type SetupStepProgress,
} from '@libs-chirimen-setup-data-access';
import {
  SetupExecuteButtonComponent,
  SetupProgressComponent,
} from '@libs-chirimen-setup-ui';
import { DialogService } from '@libs-dialogs-util';
import { NotificationService } from '@libs-shared-ui';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { MatDividerModule } from '@angular/material/divider';
import { firstValueFrom, take } from 'rxjs';

@Component({
  selector: 'lib-setup-page',
  imports: [
    MatDividerModule,
    SetupProgressComponent,
    SetupExecuteButtonComponent,
  ],
  templateUrl: './setup-page.component.html',
})
export class SetupPageComponent {
  private readonly dialogService = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly setup = inject(SetupCommandService);

  private readonly logArea = viewChild<ElementRef<HTMLTextAreaElement>>('logArea');

  readonly nodeTarUrl = signal(DEFAULT_NODE_TAR_URL);
  readonly useProjectSubdir = signal(true);
  readonly projectSubdir = signal(DEFAULT_PROJECT_SUBDIR);

  readonly inProgress = signal(false);
  readonly progressPercent = signal(0);
  readonly currentLabel = signal('');
  readonly logText = signal('');

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

  private appendLog(p: SetupStepProgress): void {
    const block = `\n--- [${p.phase}] ${p.label} ---\n$ ${p.command}\n${p.stdout}\n`;
    this.logText.update((t) => t + block);
    queueMicrotask(() => {
      const el = this.logArea()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  async runSetup(): Promise<void> {
    const connected = await firstValueFrom(
      this.serial.isConnected$.pipe(take(1)),
    );
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

    this.inProgress.set(true);
    this.logText.set('');
    this.progressPercent.set(0);
    this.currentLabel.set('開始…');

    try {
      await this.setup.run({
        nodeTarUrl: url,
        projectSubdir: this.useProjectSubdir()
          ? sanitizeProjectSubdir(this.projectSubdir())
          : undefined,
        onProgress: (p: SetupStepProgress) => {
          const pct = Math.round(((p.stepIndex + 1) / p.stepTotal) * 100);
          this.progressPercent.set(Math.min(100, pct));
          this.currentLabel.set(p.label);
          this.appendLog(p);
        },
      });
      this.notify.success('Setup', 'セットアップが完了しました');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'セットアップに失敗しました';
      this.notify.error('Setup', msg);
    } finally {
      this.inProgress.set(false);
      this.currentLabel.set('');
    }
  }
}
