import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  ConnectButtonComponent,
  ConnectionStatusComponent,
  type ConnectStatus,
} from '@libs-connect-ui';
import {
  SerialFacadeService,
  SerialNotificationService,
} from '@libs-web-serial-data-access';
import { map, take } from 'rxjs';

@Component({
  selector: 'lib-connect-page',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  imports: [AsyncPipe, ConnectButtonComponent, ConnectionStatusComponent],
  templateUrl: './connect-page.component.html',
})
export class ConnectPageComponent {
  private serial = inject(SerialFacadeService);
  private serialNotification = inject(SerialNotificationService);

  disconnectedMessage =
    'Raspberry Pi Zero と PC を USB で繋いだ後、Connect ボタンをクリックして、Web Serail を接続して下さい';
  imageSrc = '/PiZeroW_OTG.jpg';
  imageAlt = 'PiZeroW_OTG';
  connectButtonLabel = 'Web Serial Connect';

  connectionStatus$ = this.serial.isConnected$.pipe(
    map(
      (connected): ConnectStatus =>
        connected ? 'connected' : 'disconnected',
    ),
  );

  onConnect(): void {
    this.serial
      .connect$()
      .pipe(take(1))
      .subscribe((result) => {
        if (result.ok) {
          this.serialNotification.notifyConnectionSuccess();
        } else {
          this.serialNotification.notifyConnectionError(result.errorMessage);
        }
      });
  }
}
