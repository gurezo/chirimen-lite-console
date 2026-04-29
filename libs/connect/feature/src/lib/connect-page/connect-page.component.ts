import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  ConnectButtonComponent,
  ConnectionStatusComponent,
} from '@libs-connect-ui';
import { SerialConnectionViewModelFacade } from '@libs-web-serial-data-access';

@Component({
  selector: 'lib-connect-page',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  imports: [AsyncPipe, ConnectButtonComponent, ConnectionStatusComponent],
  templateUrl: './connect-page.component.html',
})
export class ConnectPageComponent {
  private readonly connectionVm = inject(SerialConnectionViewModelFacade);

  readonly vm$ = this.connectionVm.vm$;

  disconnectedMessage =
    'Raspberry Pi Zero と PC を USB で繋いだ後、Connect ボタンをクリックして、Web Serial を接続して下さい';
  imageSrc = '/PiZeroW_OTG.jpg';
  imageAlt = 'PiZeroW_OTG';
  connectButtonLabel = 'Web Serial Connect';

  onConnect(): void {
    this.connectionVm.connect();
  }

  onClearError(): void {
    this.connectionVm.clearError();
  }
}
