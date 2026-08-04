import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';

export interface ProgressDialogData {
  message?: string;
  /** Caller updates this signal to refresh the progress bar (0–100). */
  progress?: WritableSignal<number> | Signal<number>;
  cancelLabel?: string;
  /** When true, hide the cancel button. */
  hideCancel?: boolean;
}

export type ProgressDialogResult = 'cancelled' | undefined;

@Component({
  selector: 'lib-progress-dialog',
  templateUrl: './progress-dialog.component.html',
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
      .dialog-content p {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.5;
      }
      .progress-label {
        margin-top: 0.75rem;
        font-variant-numeric: tabular-nums;
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
export class ProgressDialogComponent implements OnInit {
  private dialogRef = inject(DialogRef<ProgressDialogResult>, {
    optional: true,
  });
  private data = inject<ProgressDialogData | null>(DIALOG_DATA, {
    optional: true,
  });

  readonly message = input('Transferring...');
  readonly progress = input(0);
  readonly cancelLabel = input('Cancel');
  readonly hideCancel = input(false);

  viewMessage = 'Transferring...';
  viewCancelLabel = 'Cancel';
  viewHideCancel = false;
  private progressSource: Signal<number> = signal(0);

  readonly viewProgress = computed(() => {
    const value = this.progressSource();
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  });

  ngOnInit(): void {
    this.viewMessage = this.message();
    this.viewCancelLabel = this.cancelLabel();
    this.viewHideCancel = this.hideCancel();
    this.progressSource = signal(this.progress());

    if (this.data) {
      if (this.data.message != null) {
        this.viewMessage = this.data.message;
      }
      if (this.data.cancelLabel != null) {
        this.viewCancelLabel = this.data.cancelLabel;
      }
      if (this.data.hideCancel === true) {
        this.viewHideCancel = true;
      }
      if (this.data.progress) {
        this.progressSource = this.data.progress;
      }
    }
  }

  cancel(): void {
    this.dialogRef?.close('cancelled');
  }
}
