import {
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { joinPath } from '../../functions';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { FileTreeComponent } from '../file-tree/file-tree.component';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';

@Component({
  selector: 'lib-file-tree-feature',
  imports: [FileTreeComponent, MatProgressSpinner],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col',
  },
  templateUrl: './file-tree-feature.component.html',
})
export class FileTreeFeatureComponent {
  private file = inject(FileService);
  private connectionVm = inject(SerialConnectionViewModelFacade);
  private cdr = inject(ChangeDetectorRef);

  /** Bound from ConsoleShellStore via LeftSidebar (issue #727). */
  readonly currentPath = input<string>('.');
  readonly currentPathChange = output<string>();
  readonly fileSelected = output<string>();

  nodes: FileTreeNode[] = [];
  loading = false;
  errorMessage: string | null = null;

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
      const vm = this.connectionVm.vm();
      if (!vm.isConnected || !this.canLoadTree(vm) || !this.loadedForLogin) {
        return;
      }
      if (path === this.lastLoadedPath) {
        return;
      }
      untracked(() => {
        queueMicrotask(() => void this.loadAt(path));
      });
    });
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

  async goParent(): Promise<void> {
    const path = this.currentPath();
    if (path === '.') {
      return;
    }
    const normalized = path.startsWith('./') ? path.slice(2) : path;
    const segments = normalized.split('/').filter(Boolean);
    segments.pop();
    const parentPath =
      segments.length === 0 ? '.' : joinPath('.', segments.join('/'));
    await this.navigateTo(parentPath);
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
