import {
  ChangeDetectorRef,
  Component,
  effect,
  inject,
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
  readonly fileSelected = output<string>();

  nodes: FileTreeNode[] = [];
  currentPath = '.';
  loading = false;
  errorMessage: string | null = null;

  private loadedForLogin = false;
  private lastVmKey = '';

  constructor() {
    effect(() => {
      const vm = this.connectionVm.vm();
      const vmKey = `${vm.isConnected}:${vm.isLoggedIn}:${vm.setupStatus}`;
      if (vmKey === this.lastVmKey) {
        return;
      }
      this.lastVmKey = vmKey;

      untracked(() => {
        const setupFailed = vm.setupStatus === 'failed' && !vm.isLoggedIn;

        if (!vm.isConnected) {
          this.loading = false;
          this.errorMessage = null;
          this.nodes = [];
          this.loadedForLogin = false;
          this.cdr.markForCheck();
          return;
        }

        if (setupFailed) {
          this.loading = false;
          this.errorMessage =
            'シェルの初期化に失敗しました。ターミナルを確認してください。';
          this.cdr.markForCheck();
          return;
        }

        if (!vm.isLoggedIn) {
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
        void this.loadCurrentPath();
      });
    });
  }

  async reload(): Promise<void> {
    this.loadedForLogin = false;
    await this.loadCurrentPath();
  }

  async onDirectorySelected(node: FileTreeNode): Promise<void> {
    this.currentPath = node.path;
    await this.loadCurrentPath();
  }

  onFileSelected(node: FileTreeNode): void {
    this.fileSelected.emit(node.path);
  }

  async goParent(): Promise<void> {
    if (this.currentPath === '.') {
      return;
    }
    const normalized = this.currentPath.startsWith('./')
      ? this.currentPath.slice(2)
      : this.currentPath;
    const segments = normalized.split('/').filter(Boolean);
    segments.pop();
    this.currentPath =
      segments.length === 0 ? '.' : joinPath('.', segments.join('/'));
    await this.loadCurrentPath();
  }

  private async loadCurrentPath(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    this.cdr.markForCheck();
    try {
      this.nodes = await this.file.listTree(this.currentPath);
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
