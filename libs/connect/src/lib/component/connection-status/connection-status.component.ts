import { Component, input } from '@angular/core';

export type ConnectStatus = 'disconnected' | 'connecting' | 'connected';

@Component({
  selector: 'lib-connection-status',
  templateUrl: './connection-status.component.html',
})
export class ConnectionStatusComponent {
  readonly status = input<ConnectStatus>('disconnected');
  readonly message = input<string>('');
  readonly imageSrc = input<string>('');
  readonly imageAlt = input<string>('');
}
