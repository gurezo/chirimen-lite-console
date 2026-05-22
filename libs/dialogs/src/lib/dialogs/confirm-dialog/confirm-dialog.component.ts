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
        padding: 1rem;
      }
      .dialog-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        justify-content: flex-end;
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
