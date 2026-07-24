import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import type { ForeverProcess } from '@libs-shared';
import {
  ButtonComponent,
  ConsoleShellStore,
  NotificationService,
} from '@libs-shared';
import {
  PI_ZERO_PROMPT,
  sanitizeSerialStdout,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import {
  findRunningProcessByScript,
  parseForeverListPlain,
} from '../../functions';
import {
  RemoteRunService,
  RemoteStatusService,
  RemoteStopService,
} from '../../service';
import { RemoteRunButtonComponent } from '../remote-run-button/remote-run-button.component';
import { RemoteStatusListComponent } from '../remote-status-list/remote-status-list.component';
import { RemoteStopButtonComponent } from '../remote-stop-button/remote-stop-button.component';

const FOREVER_LIST_CMD = 'forever list --plain';

function isJsScriptPath(path: string | null | undefined): path is string {
  return !!path && /\.js$/i.test(path.trim());
}

@Component({
  selector: 'lib-remote-page',
  imports: [
    FormsModule,
    MatDividerModule,
    ButtonComponent,
    RemoteStatusListComponent,
    RemoteRunButtonComponent,
    RemoteStopButtonComponent,
  ],
  templateUrl: './remote-page.component.html',
})
export class RemotePageComponent implements OnInit {
  processes: ForeverProcess[] = [];
  selected: ForeverProcess | null = null;
  scriptPath = '';

  readonly listInProgress = signal(false);
  readonly actionInProgress = signal(false);

  private readonly dialogService = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly shellStore = inject(ConsoleShellStore);
  private readonly remoteStatus = inject(RemoteStatusService);
  private readonly remoteRun = inject(RemoteRunService);
  private readonly remoteStop = inject(RemoteStopService);

  readonly serialConnected = computed(() => this.serial.isConnected());

  /** File Manager で選択中の .js パス（なければ null）。 */
  readonly selectedJsPath = computed(() => {
    const path = this.shellStore.selectedFilePath();
    return isJsScriptPath(path) ? path.trim() : null;
  });

  ngOnInit(): void {
    const path = this.selectedJsPath();
    if (path) {
      this.scriptPath = path;
    }
  }

  useSelectedFile(): void {
    const path = this.selectedJsPath();
    if (path) {
      this.scriptPath = path;
    }
  }

  closeModal(): void {
    this.dialogService.close();
  }

  private async ensureSerial(): Promise<boolean> {
    const ok = this.serial.isConnected();
    if (!ok) {
      this.notify.warning('Remote', 'シリアル接続してください');
      return false;
    }
    return true;
  }

  onRowSelected(p: ForeverProcess): void {
    this.selected = p;
  }

  async refreshList(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    this.listInProgress.set(true);
    try {
      const stdout = await this.remoteStatus.listPlain();
      const cleaned = sanitizeSerialStdout(
        stdout,
        FOREVER_LIST_CMD,
        PI_ZERO_PROMPT,
      );
      this.processes = parseForeverListPlain(cleaned);
      const prev = this.selected;
      if (prev) {
        const still = this.processes.find(
          (p) => p.listIndex === prev.listIndex && p.uid === prev.uid,
        );
        this.selected = still ?? null;
      }
      this.notify.success(
        'Remote',
        `プロセス ${this.processes.length} 件を取得しました`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '一覧の取得に失敗しました';
      this.notify.error('Remote', msg);
    } finally {
      this.listInProgress.set(false);
    }
  }

  async startScript(): Promise<void> {
    const path = this.scriptPath.trim();
    if (!path || !(await this.ensureSerial())) {
      return;
    }

    const running = findRunningProcessByScript(this.processes, path);
    const confirmed = running
      ? await this.confirmRestart(path, running)
      : await this.confirmStart(path);
    if (!confirmed) {
      return;
    }

    this.actionInProgress.set(true);
    try {
      if (running) {
        await this.remoteStop.stopTarget(running.uid);
      }
      await this.remoteRun.start(path);
      this.notify.success(
        'Remote',
        running ? '再起動コマンドを送信しました' : '起動コマンドを送信しました',
      );
      await this.refreshList();
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : running
            ? '再起動に失敗しました'
            : '起動に失敗しました';
      this.notify.error('Remote', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  private async confirmStart(path: string): Promise<boolean> {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      data: {
        title: 'forever で起動',
        message: `次のスクリプトを forever start します。よろしいですか？\n\n${path}`,
        confirmLabel: '起動',
        cancelLabel: 'キャンセル',
      },
    });
    return !!(await firstValueFrom(ref.closed));
  }

  private async confirmRestart(
    path: string,
    running: ForeverProcess,
  ): Promise<boolean> {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      data: {
        title: '既に起動中のアプリを再起動',
        message: `「${running.uid}」(${running.script}) は既に実行中です。停止してから次のスクリプトを再起動しますか？\n\n${path}`,
        confirmLabel: '再起動',
        cancelLabel: 'キャンセル',
      },
    });
    return !!(await firstValueFrom(ref.closed));
  }

  async stopSelected(): Promise<void> {
    const target = this.selected;
    if (!target || !target.running || !(await this.ensureSerial())) {
      return;
    }
    const confirmed = await this.confirmStopSelected(target);
    if (!confirmed) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      await this.remoteStop.stopTarget(target.uid);
      this.notify.success('Remote', '停止コマンドを送信しました');
      this.selected = null;
      await this.refreshList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '停止に失敗しました';
      this.notify.error('Remote', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  private async confirmStopSelected(target: ForeverProcess): Promise<boolean> {
    const pidLine = target.pid ? `\npid: ${target.pid}` : '';
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      data: {
        title: 'forever プロセスを停止',
        message: `次の forever プロセスを停止します。よろしいですか？\n\nuid: ${target.uid}\nscript: ${target.script}${pidLine}`,
        confirmLabel: '停止',
        cancelLabel: 'キャンセル',
      },
    });
    return !!(await firstValueFrom(ref.closed));
  }

  async confirmStopAll(): Promise<void> {
    if (!(await this.ensureSerial())) {
      return;
    }
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      data: {
        title: 'すべての forever プロセスを停止',
        message: 'forever stopall を実行します。よろしいですか？',
        confirmLabel: 'すべて停止',
        cancelLabel: 'キャンセル',
      },
    });
    const confirmed = await firstValueFrom(ref.closed);
    if (!confirmed) {
      return;
    }
    this.actionInProgress.set(true);
    try {
      await this.remoteStop.stopAll();
      this.notify.success('Remote', 'stopall を送信しました');
      this.selected = null;
      await this.refreshList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'stopall に失敗しました';
      this.notify.error('Remote', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
