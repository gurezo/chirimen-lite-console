import { Component, output } from '@angular/core';

@Component({
  selector: 'lib-upload-button',
  templateUrl: './upload-button.component.html',
})
export class UploadButtonComponent {
  readonly upload = output<void>();
}
