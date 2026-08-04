import { Component, ElementRef, input, output, viewChildren } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { FileTreeNode } from '../../models';

export interface FileTreeContextMenuEvent {
  node: FileTreeNode;
  event: MouseEvent;
}

@Component({
  selector: 'lib-file-tree',
  imports: [MatIcon],
  templateUrl: './file-tree.component.html',
  styleUrl: './file-tree.component.css',
})
export class FileTreeComponent {
  readonly nodes = input<FileTreeNode[]>([]);
  readonly selectedPath = input<string | null>(null);

  readonly directorySelected = output<FileTreeNode>();
  readonly fileSelected = output<FileTreeNode>();
  readonly nodeContextMenu = output<FileTreeContextMenuEvent>();

  private readonly nodeButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('nodeButton');

  isSelected(node: FileTreeNode): boolean {
    const selected = this.selectedPath();
    return selected !== null && selected === node.path;
  }

  onSelect(node: FileTreeNode): void {
    if (node.isDirectory) {
      this.directorySelected.emit(node);
      return;
    }
    this.fileSelected.emit(node);
  }

  onContextMenu(event: MouseEvent, node: FileTreeNode): void {
    event.preventDefault();
    this.nodeContextMenu.emit({ node, event });
  }

  onNodeKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.nodeButtons();
    if (buttons.length === 0) {
      return;
    }

    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowDown':
        nextIndex = Math.min(index + 1, buttons.length - 1);
        break;
      case 'ArrowUp':
        nextIndex = Math.max(index - 1, 0);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (nextIndex === index) {
      return;
    }
    buttons[nextIndex]?.nativeElement.focus();
  }
}
