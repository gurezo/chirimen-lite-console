import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-wait-dialog',
  templateUrl: './wait-dialog.component.html',
  styles: [
    `
      .dialog-content {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        min-width: 200px;
      }
      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e0e0e0;
        border-top-color: #1976d2;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class WaitDialogComponent {
  readonly message = input('Please wait...');
}
