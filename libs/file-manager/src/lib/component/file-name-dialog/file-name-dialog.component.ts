import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { isValidFileName } from '../../functions/file-name.util';
import type { FileNameDialogData } from '../../models/file-name-dialog.types';

@Component({
  selector: 'lib-file-name-dialog',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './file-name-dialog.component.html',
})
export class FileNameDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<string | null>);
  private readonly data = inject<FileNameDialogData | null>(DIALOG_DATA, {
    optional: true,
  });

  name = '';
  title = '名前を入力';
  confirmLabel = 'OK';
  label = '名前';
  readonly validationError = signal<string | null>(null);

  ngOnInit(): void {
    this.title = this.data?.title?.trim() || this.title;
    this.confirmLabel = this.data?.confirmLabel?.trim() || this.confirmLabel;
    this.label = this.data?.label?.trim() || this.label;
    this.name = this.data?.initialValue ?? '';
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    const trimmed = this.name.trim();
    if (!isValidFileName(trimmed)) {
      this.validationError.set(
        '有効な名前を入力してください（空・.・..・/ は使用できません）',
      );
      return;
    }
    this.validationError.set(null);
    this.dialogRef.close(trimmed);
  }
}
