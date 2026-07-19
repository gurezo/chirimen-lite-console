import {
  Component,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import type { FileContextMenuAction } from '../../models/file-context-menu.types';
import type { FileTreeNode } from '../../models/file-tree.model';

@Component({
  selector: 'lib-file-context-menu',
  imports: [MatMenu, MatMenuItem, MatMenuTrigger],
  templateUrl: './file-context-menu.component.html',
})
export class FileContextMenuComponent {
  readonly target = input<FileTreeNode | null>(null);
  readonly disabled = input(false);
  readonly menuAction = output<FileContextMenuAction>();

  private readonly menuTrigger = viewChild(MatMenuTrigger);

  menuLeft = 0;
  menuTop = 0;

  openAt(clientX: number, clientY: number): void {
    this.menuLeft = clientX;
    this.menuTop = clientY;
    queueMicrotask(() => this.menuTrigger()?.openMenu());
  }

  onSelect(action: FileContextMenuAction): void {
    if (this.disabled()) {
      return;
    }
    this.menuAction.emit(action);
  }
}
