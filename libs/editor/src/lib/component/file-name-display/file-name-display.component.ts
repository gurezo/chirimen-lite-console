import { Component, input } from '@angular/core';

@Component({
  selector: 'choh-file-name-display',
  templateUrl: './file-name-display.component.html',
})
export class FileNameDisplayComponent {
  fileName = input<string | null>(null);
  isDirty = input(false);
}
