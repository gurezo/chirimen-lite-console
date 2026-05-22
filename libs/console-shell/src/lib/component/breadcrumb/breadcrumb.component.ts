import { Component, input } from '@angular/core';
import type { BreadcrumbSegment } from '../../functions';

@Component({
  selector: 'lib-breadcrumb',
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  segments = input<BreadcrumbSegment[]>([]);
}
