import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-progress-dialog',
  templateUrl: './progress-dialog.component.html',
  styles: [
    `
      .dialog-content {
        padding: 1rem;
        min-width: 200px;
      }
      .progress-bar {
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 0.5rem;
      }
      .progress-fill {
        height: 100%;
        background: #1976d2;
        transition: width 0.2s ease;
      }
    `,
  ],
})
export class ProgressDialogComponent {
  readonly message = input('');
  readonly progress = input(0);
}
