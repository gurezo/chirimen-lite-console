import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-setup-step-list',
  templateUrl: './setup-step-list.component.html',
})
export class SetupStepListComponent {
  readonly steps = input<string[]>([]);
}
