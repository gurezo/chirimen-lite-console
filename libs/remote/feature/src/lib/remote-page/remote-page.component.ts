import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { firstValueFrom, take } from 'rxjs';
import { ConfirmDialogComponent } from '@libs-dialogs-ui';
import { DialogService } from '@libs-dialogs-util';
import {
  RemoteRunService,
  RemoteStatusService,
  RemoteStopService,
} from '@libs-remote-data-access';
import {
  RemoteRunButtonComponent,
  RemoteStatusListComponent,
  RemoteStopButtonComponent,
} from '@libs-remote-ui';
import { parseForeverListPlain } from '@libs-remote-util';
import type { ForeverProcess } from '@libs-shared-types';
import { ButtonComponent, NotificationService } from '@libs-shared-ui';
import { sanitizeSerialStdout } from '@libs-terminal-util';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { PI_ZERO_PROMPT } from '@libs-web-serial-util';

const FOREVER_LIST_CMD = 'forever list --plain';

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
export class RemotePageComponent {
  processes: ForeverProcess[] = [];
  selected: ForeverProcess | null = null;
  scriptPath = '';

  readonly listInProgress = signal(false);
  readonly actionInProgress = signal(false);

  private readonly dialogService = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly serial = inject(SerialFacadeService);
  private readonly remoteStatus = inject(RemoteStatusService);
  private readonly remoteRun = inject(RemoteRunService);
  private readonly remoteStop = inject(RemoteStopService);

  closeModal(): void {
    this.dialogService.close();
  }

  private async ensureSerial(): Promise<boolean> {
    const ok = await firstValueFrom(
      this.serial.isConnected$.pipe(take(1)),
    );
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
      const cleaned = sanitizeSerialStdout(stdout, FOREVER_LIST_CMD, PI_ZERO_PROMPT);
      this.processes = parseForeverListPlain(cleaned);
      const prev = this.selected;
      if (prev) {
        const still = this.processes.find(
          (p) => p.listIndex === prev.listIndex && p.uid === prev.uid,
        );
        this.selected = still ?? null;
      }
      this.notify.success('Remote', `プロセス ${this.processes.length} 件を取得しました`);
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
    this.actionInProgress.set(true);
    try {
      await this.remoteRun.start(path);
      this.notify.success('Remote', '起動コマンドを送信しました');
      await this.refreshList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '起動に失敗しました';
      this.notify.error('Remote', msg);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async stopSelected(): Promise<void> {
    const target = this.selected;
    if (!target || !(await this.ensureSerial())) {
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
