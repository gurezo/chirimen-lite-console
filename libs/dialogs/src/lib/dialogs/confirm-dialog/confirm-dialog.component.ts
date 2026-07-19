import { Component, inject, input, OnInit } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface ConfirmDialogData {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true のときキャンセルボタンを出さない（情報表示のみ） */
  hideCancel?: boolean;
}

@Component({
  selector: 'lib-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
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
      .dialog-content p {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.5;
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
export class ConfirmDialogComponent implements OnInit {
  private dialogRef = inject(DialogRef<boolean>, { optional: true });
  private data = inject<ConfirmDialogData | null>(DIALOG_DATA, { optional: true });

  readonly title = input('Confirm');
  readonly message = input('Are you sure?');
  readonly confirmLabel = input('OK');
  readonly cancelLabel = input('Cancel');
  readonly hideCancel = input(false);

  /** 入力と DIALOG_DATA をマージした表示用（テンプレートはこちらを参照） */
  viewTitle = 'Confirm';
  viewMessage = 'Are you sure?';
  viewConfirmLabel = 'OK';
  viewCancelLabel = 'Cancel';
  viewHideCancel = false;

  ngOnInit(): void {
    this.viewTitle = this.title();
    this.viewMessage = this.message();
    this.viewConfirmLabel = this.confirmLabel();
    this.viewCancelLabel = this.cancelLabel();
    this.viewHideCancel = this.hideCancel();
    if (this.data) {
      if (this.data.title != null) this.viewTitle = this.data.title;
      if (this.data.message != null) this.viewMessage = this.data.message;
      if (this.data.confirmLabel != null)
        this.viewConfirmLabel = this.data.confirmLabel;
      if (this.data.cancelLabel != null)
        this.viewCancelLabel = this.data.cancelLabel;
      if (this.data.hideCancel === true) this.viewHideCancel = true;
    }
  }

  confirm(): void {
    this.dialogRef?.close(true);
  }

  cancel(): void {
    this.dialogRef?.close(false);
  }
}
