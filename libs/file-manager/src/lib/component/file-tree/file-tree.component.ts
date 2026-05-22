import { Component, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { FileTreeNode } from '../../models/file-tree.model';

@Component({
  selector: 'lib-file-tree',
  imports: [MatIcon],
  templateUrl: './file-tree.component.html',
})
export class FileTreeComponent {
  readonly nodes = input<FileTreeNode[]>([]);

  readonly directorySelected = output<FileTreeNode>();
  readonly fileSelected = output<FileTreeNode>();

  onSelect(node: FileTreeNode): void {
    if (node.isDirectory) {
      this.directorySelected.emit(node);
      return;
    }
    this.fileSelected.emit(node);
  }
}
