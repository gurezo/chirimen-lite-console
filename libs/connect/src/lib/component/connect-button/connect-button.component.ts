import { Component, input, output } from '@angular/core';

@Component({
  selector: 'lib-connect-button',
  templateUrl: './connect-button.component.html',
})
export class ConnectButtonComponent {
  readonly label = input<string>('Connect');
  readonly connect = output<void>();
}
