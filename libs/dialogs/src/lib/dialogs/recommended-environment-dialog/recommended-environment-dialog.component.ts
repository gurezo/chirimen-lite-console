import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';

@Component({
  selector: 'lib-recommended-environment-dialog',
  templateUrl: './recommended-environment-dialog.component.html',
  styles: [
    `
      .dialog-content {
        min-width: 280px;
        max-width: 100%;
        padding: 1.25rem 1.5rem;
        background: #fff;
        color: rgba(0, 0, 0, 0.87);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      }
      .dialog-content h2 {
        margin: 0 0 0.75rem;
        font-size: 1.125rem;
        font-weight: 500;
        line-height: 1.4;
      }
      .dialog-content dl {
        margin: 0;
      }
      .dialog-content dt {
        margin-top: 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.6);
      }
      .dialog-content dt:first-of-type {
        margin-top: 0;
      }
      .dialog-content dd {
        margin: 0.25rem 0 0;
        line-height: 1.5;
      }
      .dialog-content a {
        color: #1565c0;
        text-decoration: underline;
      }
      .dialog-note {
        margin: 1rem 0 0;
        font-size: 0.875rem;
        line-height: 1.5;
        color: rgba(0, 0, 0, 0.7);
      }
      .dialog-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1.25rem;
        justify-content: flex-end;
      }
      .dialog-actions button {
        padding: 0.4rem 0.85rem;
        border: 1px solid rgba(0, 0, 0, 0.24);
        border-radius: 4px;
        background: #fff;
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .dialog-actions button:hover {
        background: rgba(0, 0, 0, 0.04);
      }
    `,
  ],
})
export class RecommendedEnvironmentDialogComponent {
  private dialogRef = inject(DialogRef<void>, { optional: true });

  readonly title = '推奨環境';
  readonly hardwareLabel = 'ハードウェア';
  readonly hardware = 'Raspberry Pi Zero 2 W';
  readonly softwareLabel = 'ソフトウェア';
  readonly softwareName = 'chirimen-lite v2.0.0';
  readonly softwareUrl =
    'https://github.com/chirimen-oh/chirimen-lite/releases/tag/v2.0.0';
  readonly note =
    'v2.0.0 は 64-bit（Pi 4B / 5 / Zero 2 向け）です。初代 Zero W / WH をご利用の場合は v1.6 をご使用ください。';
  readonly closeLabel = '閉じる';

  close(): void {
    this.dialogRef?.close();
  }
}
