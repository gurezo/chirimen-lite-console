import { Component, input } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'lib-setup-progress',
  imports: [MatProgressBarModule],
  templateUrl: './setup-progress.component.html',
})
export class SetupProgressComponent {
  /** 0–100 */
  readonly progress = input(0);
  readonly currentLabel = input('');
  readonly indeterminate = input(false);
}
