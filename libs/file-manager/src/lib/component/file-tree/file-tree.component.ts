import { Component, input, output } from '@angular/core';
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
})
export class FileTreeComponent {
  readonly nodes = input<FileTreeNode[]>([]);
  readonly selectedPath = input<string | null>(null);

  readonly directorySelected = output<FileTreeNode>();
  readonly fileSelected = output<FileTreeNode>();
  readonly nodeContextMenu = output<FileTreeContextMenuEvent>();

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
}
