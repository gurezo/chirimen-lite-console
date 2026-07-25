import { Component, input } from '@angular/core';
import type { SetupStepListItem } from '../../models';

@Component({
  selector: 'lib-setup-step-list',
  templateUrl: './setup-step-list.component.html',
})
export class SetupStepListComponent {
  readonly steps = input<SetupStepListItem[]>([]);
}
