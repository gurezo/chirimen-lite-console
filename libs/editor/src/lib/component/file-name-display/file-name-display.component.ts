import { Component, computed, input } from '@angular/core';
import {
  EDITOR_SAVE_STATUS_LABEL,
  EditorSaveStatus,
  isEditorDirtyStatus,
} from '../editor-page/editor-save-status';

@Component({
  selector: 'choh-file-name-display',
  templateUrl: './file-name-display.component.html',
})
export class FileNameDisplayComponent {
  /** Full path of the open file. Null/empty means no file selected. */
  filePath = input<string | null>(null);
  languageLabel = input<string | null>(null);
  saveStatus = input<EditorSaveStatus | null>(null);
  /** Epoch ms of the last successful device save; shown only for savedToDevice. */
  lastSavedAt = input<number | null>(null);
  readOnly = input(false);

  readonly isDirty = computed(() => isEditorDirtyStatus(this.saveStatus()));

  readonly hasFile = computed(() => {
    const path = this.filePath();
    return !!path && path.length > 0;
  });

  readonly statusLabel = computed(() => {
    const status = this.saveStatus();
    if (!status) {
      return null;
    }
    const base = EDITOR_SAVE_STATUS_LABEL[status];
    if (status === 'savedToDevice') {
      const at = this.lastSavedAt();
      if (at != null) {
        return `${base} ${formatTimeHm(at)}`;
      }
    }
    return base;
  });
}

function formatTimeHm(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
