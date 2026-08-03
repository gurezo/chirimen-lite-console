import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltip } from '@angular/material/tooltip';

const isApplePlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPod|iPad/i.test(
    navigator.platform || navigator.userAgent,
  );
};

@Component({
  selector: 'choh-editor-toolbar',
  imports: [MatButtonModule, MatTooltip, MatProgressSpinner],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.css',
})
export class EditorToolbarComponent {
  saveDisabled = input(false);
  discardDisabled = input(true);
  formatDisabled = input(true);
  isSaving = input(false);

  saveRequested = output<void>();
  discardRequested = output<void>();
  formatRequested = output<void>();

  private readonly applePlatform = isApplePlatform();

  readonly saveTooltip = computed(() =>
    this.applePlatform ? 'Save (Cmd+S)' : 'Save (Ctrl+S)',
  );

  readonly formatTooltip = computed(() =>
    this.applePlatform
      ? 'Format (Shift+Option+F)'
      : 'Format (Shift+Alt+F)',
  );

  readonly discardTooltip = 'Discard local changes';
}
