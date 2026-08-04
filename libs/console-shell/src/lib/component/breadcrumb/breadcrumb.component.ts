import { Component, input, output } from '@angular/core';
import { FILE_TREE_DRAG_MIME } from '@libs-file-manager';
import type { BreadcrumbSegment } from '../../functions';

export interface BreadcrumbSegmentDropEvent {
  sourcePath: string;
  targetDirectoryPath: string;
}

@Component({
  selector: 'lib-breadcrumb',
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  segments = input<BreadcrumbSegment[]>([]);
  segmentNavigate = output<string>();
  segmentDrop = output<BreadcrumbSegmentDropEvent>();

  dropTargetPath: string | null = null;

  onSegmentActivate(segment: BreadcrumbSegment): void {
    if (segment.clickable && segment.path) {
      this.segmentNavigate.emit(segment.path);
    }
  }

  isDropTarget(segment: BreadcrumbSegment): boolean {
    return !!segment.path && this.dropTargetPath === segment.path;
  }

  onSegmentDragOver(event: DragEvent, segment: BreadcrumbSegment): void {
    if (!segment.path) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    this.dropTargetPath = segment.path;
  }

  onSegmentDragLeave(segment: BreadcrumbSegment): void {
    if (segment.path && this.dropTargetPath === segment.path) {
      this.dropTargetPath = null;
    }
  }

  onSegmentDrop(event: DragEvent, segment: BreadcrumbSegment): void {
    event.preventDefault();
    this.dropTargetPath = null;
    if (!segment.path) {
      return;
    }
    const sourcePath = this.resolveDroppedPath(event);
    if (!sourcePath) {
      return;
    }
    this.segmentDrop.emit({
      sourcePath,
      targetDirectoryPath: segment.path,
    });
  }

  private resolveDroppedPath(event: DragEvent): string | null {
    const path =
      event.dataTransfer?.getData(FILE_TREE_DRAG_MIME) ||
      event.dataTransfer?.getData('text/plain');
    return path || null;
  }
}
