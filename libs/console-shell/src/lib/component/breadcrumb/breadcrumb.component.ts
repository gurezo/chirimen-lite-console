import { Component, input, output } from '@angular/core';
import type { BreadcrumbSegment } from '../../functions';

@Component({
  selector: 'lib-breadcrumb',
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  segments = input<BreadcrumbSegment[]>([]);
  segmentNavigate = output<string>();

  onSegmentActivate(segment: BreadcrumbSegment): void {
    if (segment.clickable && segment.path) {
      this.segmentNavigate.emit(segment.path);
    }
  }
}
