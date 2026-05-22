import { Component, input, output } from '@angular/core';

@Component({
  selector: 'choh-editor-toolbar',
  templateUrl: './editor-toolbar.component.html',
})
export class EditorToolbarComponent {
  saveDisabled = input(false);
  saveRequested = output<void>();
}
