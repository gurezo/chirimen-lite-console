import { Component, input, output } from '@angular/core';

@Component({
  selector: 'choh-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
})
export class EditorToolbarComponent {
  saveDisabled = input(false);
  discardDisabled = input(true);
  saveRequested = output<void>();
  discardRequested = output<void>();
}
