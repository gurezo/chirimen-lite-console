import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '@libs-shared/component/button';

@Component({
  selector: 'lib-remote-stop-button',
  imports: [ButtonComponent],
  templateUrl: './remote-stop-button.component.html',
})
export class RemoteStopButtonComponent {
  readonly label = input('停止');
  readonly disabled = input(false);
  readonly stopClick = output<void>();
}
