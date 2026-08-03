import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, OnInit } from '@angular/core';

export type EditorDraftResolveChoice = 'restore' | 'discard' | 'reload';

export interface EditorDraftResolveDialogData {
  path: string;
}

@Component({
  selector: 'choh-editor-draft-resolve-dialog',
  templateUrl: './editor-draft-resolve-dialog.component.html',
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
        flex-wrap: wrap;
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
export class EditorDraftResolveDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<EditorDraftResolveChoice | null>, {
    optional: true,
  });
  private readonly data = inject<EditorDraftResolveDialogData | null>(DIALOG_DATA, {
    optional: true,
  });

  path = '';

  ngOnInit(): void {
    this.path = this.data?.path ?? '';
  }

  restore(): void {
    this.dialogRef?.close('restore');
  }

  discard(): void {
    this.dialogRef?.close('discard');
  }

  reload(): void {
    this.dialogRef?.close('reload');
  }
}
