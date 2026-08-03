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
  fileName = input<string | null>(null);
  saveStatus = input<EditorSaveStatus | null>(null);

  readonly isDirty = computed(() => isEditorDirtyStatus(this.saveStatus()));

  readonly statusLabel = computed(() => {
    const status = this.saveStatus();
    return status ? EDITOR_SAVE_STATUS_LABEL[status] : null;
  });
}
