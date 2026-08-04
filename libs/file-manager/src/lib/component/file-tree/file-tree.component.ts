import { Component, ElementRef, input, output, viewChildren } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { canMoveNode } from '../../functions';
import { FileTreeNode } from '../../models';

export interface FileTreeContextMenuEvent {
  node: FileTreeNode;
  event: MouseEvent;
}

export interface FileTreeNodeDropEvent {
  source: FileTreeNode;
  targetDirectory: FileTreeNode;
}

const DRAG_MIME = 'application/x-chirimen-file-tree-path';

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
  readonly nodeDropped = output<FileTreeNodeDropEvent>();

  private readonly nodeButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('nodeButton');

  private dragSource: FileTreeNode | null = null;
  private suppressClick = false;
  dropTargetPath: string | null = null;

  isSelected(node: FileTreeNode): boolean {
    const selected = this.selectedPath();
    return selected !== null && selected === node.path;
  }

  isDropTarget(node: FileTreeNode): boolean {
    return this.dropTargetPath === node.path;
  }

  onSelect(node: FileTreeNode): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
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

  onDragStart(event: DragEvent, node: FileTreeNode): void {
    this.dragSource = node;
    this.suppressClick = false;
    const transfer = event.dataTransfer;
    if (transfer) {
      transfer.effectAllowed = 'move';
      transfer.setData(DRAG_MIME, node.path);
      transfer.setData('text/plain', node.path);
    }
  }

  onDragEnd(): void {
    if (this.dragSource) {
      this.suppressClick = true;
    }
    this.dragSource = null;
    this.dropTargetPath = null;
  }

  onDragOver(event: DragEvent, node: FileTreeNode): void {
    if (!node.isDirectory || !this.canAcceptDrop(node)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropTargetPath = node.path;
  }

  onDragLeave(node: FileTreeNode): void {
    if (this.dropTargetPath === node.path) {
      this.dropTargetPath = null;
    }
  }

  onDrop(event: DragEvent, node: FileTreeNode): void {
    event.preventDefault();
    this.dropTargetPath = null;
    const source = this.resolveDragSource(event);
    if (!source || !node.isDirectory || !canMoveNode(source, node.path)) {
      return;
    }
    this.nodeDropped.emit({ source, targetDirectory: node });
    this.dragSource = null;
    this.suppressClick = true;
  }

  onNodeKeydown(event: KeyboardEvent, index: number): void {
    const buttons = this.nodeButtons();
    if (buttons.length === 0) {
      return;
    }

    let nextIndex: number;
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

  private canAcceptDrop(target: FileTreeNode): boolean {
    const source = this.dragSource;
    if (!source) {
      return true;
    }
    return canMoveNode(source, target.path);
  }

  private resolveDragSource(event: DragEvent): FileTreeNode | null {
    if (this.dragSource) {
      return this.dragSource;
    }
    const path =
      event.dataTransfer?.getData(DRAG_MIME) ||
      event.dataTransfer?.getData('text/plain');
    if (!path) {
      return null;
    }
    return this.nodes().find((node) => node.path === path) ?? null;
  }
}
