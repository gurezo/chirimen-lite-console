import { Component, DestroyRef, inject, OnInit, output } from '@angular/core';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { joinPath } from '../../functions';
import { FileTreeNode } from '../../models';
import { FileService } from '../../service';
import { FileTreeComponent } from '../file-tree/file-tree.component';
import {
  PiZeroShellReadinessService,
  SerialConnectionViewModelFacade,
} from '@libs-web-serial';
import { filter, startWith, take } from 'rxjs/operators';

@Component({
  selector: 'lib-file-tree-feature',
  imports: [FileTreeComponent, MatProgressSpinner],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col',
  },
  templateUrl: './file-tree-feature.component.html',
})
export class FileTreeFeatureComponent implements OnInit {
  private file = inject(FileService);
  private shellReadiness = inject(PiZeroShellReadinessService);
  private connectionVm = inject(SerialConnectionViewModelFacade);
  private destroyRef = inject(DestroyRef);
  readonly fileSelected = output<string>();

  nodes: FileTreeNode[] = [];
  currentPath = '.';
  loading = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.loading = true;

    this.connectionVm.vm$
      .pipe(
        filter((vm) => vm.setupStatus === 'failed' && !vm.isLoggedIn),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.loading = false;
        this.errorMessage =
          'シェルの初期化に失敗しました。ターミナルを確認してください。';
      });

    if (this.shellReadiness.isReady()) {
      queueMicrotask(() => void this.loadCurrentPath());
      return;
    }
    this.shellReadiness.ready$
      .pipe(
        startWith(this.shellReadiness.isReady()),
        filter(Boolean),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => queueMicrotask(() => void this.loadCurrentPath()));
  }

  async reload(): Promise<void> {
    if (!this.shellReadiness.isReady()) {
      return;
    }
    await this.loadCurrentPath();
  }

  async onDirectorySelected(node: FileTreeNode): Promise<void> {
    if (!this.shellReadiness.isReady()) {
      return;
    }
    this.currentPath = node.path;
    await this.loadCurrentPath();
  }

  onFileSelected(node: FileTreeNode): void {
    this.fileSelected.emit(node.path);
  }

  async goParent(): Promise<void> {
    if (!this.shellReadiness.isReady()) {
      return;
    }
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
    try {
      this.nodes = await this.file.listTree(this.currentPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.errorMessage = message;
    } finally {
      this.loading = false;
    }
  }
}
