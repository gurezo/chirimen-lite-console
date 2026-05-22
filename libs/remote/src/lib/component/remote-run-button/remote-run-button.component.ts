import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '@libs-shared/component/button';

@Component({
  selector: 'lib-remote-run-button',
  imports: [ButtonComponent],
  templateUrl: './remote-run-button.component.html',
})
export class RemoteRunButtonComponent {
  readonly label = input('起動');
  readonly disabled = input(false);
  readonly runClick = output<void>();
}
