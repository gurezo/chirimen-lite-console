import {
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import { joinPath, parentPathOf } from '../../functions';
import type { FileContextMenuAction } from '../../models/file-context-menu.types';
import type { FileNameDialogData } from '../../models/file-name-dialog.types';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { FileContextMenuComponent } from '../file-context-menu/file-context-menu.component';
import { FileNameDialogComponent } from '../file-name-dialog/file-name-dialog.component';
import {
  FileTreeComponent,
  FileTreeContextMenuEvent,
} from '../file-tree/file-tree.component';

@Component({
  selector: 'lib-file-tree-feature',
  imports: [FileTreeComponent, FileContextMenuComponent, MatProgressSpinner],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col',
  },
  templateUrl: './file-tree-feature.component.html',
})
export class FileTreeFeatureComponent {
  private file = inject(FileService);
  private connectionVm = inject(SerialConnectionViewModelFacade);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);

  private readonly contextMenu = viewChild(FileContextMenuComponent);

  /** Bound from ConsoleShellStore via LeftSidebar (issue #727). */
  readonly currentPath = input<string>('.');
  readonly currentPathChange = output<string>();
  readonly fileSelected = output<string>();

  nodes: FileTreeNode[] = [];
  loading = false;
  errorMessage: string | null = null;
  contextTarget: FileTreeNode | null = null;
  operationBusy = false;

  private loadedForLogin = false;
  private lastVmKey = '';
  private lastLoadedPath: string | null = null;

  /** ログイン完了後・環境設定前の窓で初回 ls を走らせる（issue #717）。 */
  private canLoadTree(vm: {
    isLoggedIn: boolean;
    setupStatus: string;
  }): boolean {
    return (
      vm.isLoggedIn &&
      (vm.setupStatus === 'setting-timezone' || vm.setupStatus === 'ready')
    );
  }

  constructor() {
    effect(() => {
      const vm = this.connectionVm.vm();
      const setupFailed = vm.setupStatus === 'failed' && !vm.isLoggedIn;
      const treeReady = this.canLoadTree(vm);
      const vmKey = `${vm.isConnected}:${treeReady}:${setupFailed}`;
      if (vmKey === this.lastVmKey) {
        return;
      }
      this.lastVmKey = vmKey;

      untracked(() => {
        if (!vm.isConnected) {
          this.loading = false;
          this.errorMessage = null;
          this.nodes = [];
          this.loadedForLogin = false;
          this.lastLoadedPath = null;
          this.contextTarget = null;
          this.cdr.markForCheck();
          if (this.currentPath() !== '.') {
            this.currentPathChange.emit('.');
          }
          return;
        }

        if (setupFailed) {
          this.loading = false;
          this.errorMessage =
            'シェルの初期化に失敗しました。ターミナルを確認してください。';
          this.cdr.markForCheck();
          return;
        }

        if (!treeReady) {
          this.loading = true;
          this.errorMessage = null;
          this.loadedForLogin = false;
          this.cdr.markForCheck();
          return;
        }

        if (this.loadedForLogin) {
          return;
        }
        this.loadedForLogin = true;
        queueMicrotask(() => void this.loadAt(this.currentPath()));
      });
    });

    effect(() => {
      const path = this.currentPath();
      untracked(() => {
        const vm = this.connectionVm.vm();
        if (!vm.isConnected || !this.canLoadTree(vm) || !this.loadedForLogin) {
          return;
        }
        if (path === this.lastLoadedPath) {
          return;
        }
        queueMicrotask(() => void this.loadAt(path));
      });
    });
  }

  get contextMenuDisabled(): boolean {
    return this.operationBusy || !this.connectionVm.vm().isConnected;
  }

  async reload(): Promise<void> {
    this.loadedForLogin = false;
    await this.loadAt(this.currentPath());
    this.loadedForLogin = true;
  }

  async onDirectorySelected(node: FileTreeNode): Promise<void> {
    await this.navigateTo(node.path);
  }

  onFileSelected(node: FileTreeNode): void {
    this.fileSelected.emit(node.path);
  }

  onNodeContextMenu({ node, event }: FileTreeContextMenuEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.contextMenuDisabled) {
      return;
    }
    this.contextTarget = node;
    this.cdr.markForCheck();
    this.contextMenu()?.openAt(event.clientX, event.clientY);
  }

  onBackgroundContextMenu(event: MouseEvent): void {
    event.preventDefault();
    if (this.contextMenuDisabled) {
      return;
    }
    this.contextTarget = {
      name: this.currentPath(),
      path: this.currentPath(),
      isDirectory: true,
      virtual: true,
    };
    this.cdr.markForCheck();
    this.contextMenu()?.openAt(event.clientX, event.clientY);
  }

  onMenuAction(action: FileContextMenuAction): void {
    if (this.contextMenuDisabled) {
      return;
    }
    void this.runMenuAction(action);
  }

  async goParent(): Promise<void> {
    const path = this.currentPath();
    if (path === '.') {
      return;
    }
    await this.navigateTo(parentPathOf(path));
  }

  private async runMenuAction(action: FileContextMenuAction): Promise<void> {
    if (action === 'reload') {
      await this.withBusy(() => this.reload());
      return;
    }

    const target = this.contextTarget;
    if (!target) {
      return;
    }

    switch (action) {
      case 'new-file':
        await this.withBusy(() => this.createFile(target));
        break;
      case 'new-directory':
        await this.withBusy(() => this.createDirectory(target));
        break;
      case 'rename':
        await this.withBusy(() => this.renameNode(target));
        break;
      case 'delete':
        await this.withBusy(() => this.deleteNode(target));
        break;
    }
  }

  private async createFile(target: FileTreeNode): Promise<void> {
    const name = await this.promptName({
      title: '新規ファイル',
      confirmLabel: '作成',
      label: 'ファイル名',
    });
    if (!name) {
      return;
    }
    const parent = this.createParentPath(target);
    await this.file.touch(joinPath(parent, name));
    await this.refreshAfterCreate(parent);
  }

  private async createDirectory(target: FileTreeNode): Promise<void> {
    const name = await this.promptName({
      title: '新規ディレクトリ',
      confirmLabel: '作成',
      label: 'ディレクトリ名',
    });
    if (!name) {
      return;
    }
    const parent = this.createParentPath(target);
    await this.file.mkdir(joinPath(parent, name));
    await this.refreshAfterCreate(parent);
  }

  /**
   * Directory node → create inside it.
   * File / current-directory virtual target → create in the listing path.
   */
  private createParentPath(target: FileTreeNode): string {
    if (target.virtual || !target.isDirectory) {
      return this.currentPath();
    }
    return target.path;
  }

  private async refreshAfterCreate(parentPath: string): Promise<void> {
    if (parentPath === this.currentPath()) {
      await this.reload();
      return;
    }
    await this.navigateTo(parentPath);
  }

  private async renameNode(target: FileTreeNode): Promise<void> {
    const name = await this.promptName({
      title: '名前変更',
      initialValue: target.name,
      confirmLabel: '変更',
      label: '新しい名前',
    });
    if (!name || name === target.name) {
      return;
    }
    const destination = joinPath(parentPathOf(target.path), name);
    await this.file.move(target.path, destination);
    await this.reload();
  }

  private async deleteNode(target: FileTreeNode): Promise<void> {
    const confirmed = await this.confirmDelete(target.name);
    if (!confirmed) {
      return;
    }
    await this.file.remove(target.path, {
      recursive: target.isDirectory,
    });
    await this.reload();
  }

  private async promptName(
    data: FileNameDialogData,
  ): Promise<string | null> {
    const ref = this.dialog.open(FileNameDialogComponent, {
      width: '360px',
      data,
    });
    const result = await firstValueFrom(ref.closed);
    return typeof result === 'string' ? result : null;
  }

  private async confirmDelete(name: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: '削除の確認',
        message: `「${name}」を削除しますか？`,
        confirmLabel: '削除',
        cancelLabel: 'キャンセル',
      },
    });
    return (await firstValueFrom(ref.closed)) === true;
  }

  private async withBusy(fn: () => Promise<void>): Promise<void> {
    if (this.operationBusy) {
      return;
    }
    this.operationBusy = true;
    this.errorMessage = null;
    this.cdr.markForCheck();
    try {
      await fn();
    } catch (error: unknown) {
      this.errorMessage =
        error instanceof Error ? error.message : String(error);
    } finally {
      this.operationBusy = false;
      this.cdr.markForCheck();
    }
  }

  private async navigateTo(path: string): Promise<void> {
    if (path !== this.currentPath()) {
      this.currentPathChange.emit(path);
    }
    await this.loadAt(path);
  }

  private async loadAt(path: string): Promise<void> {
    this.lastLoadedPath = path;
    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();
    try {
      this.nodes = await this.file.listTree(path);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.errorMessage = message;
      this.loadedForLogin = false;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
