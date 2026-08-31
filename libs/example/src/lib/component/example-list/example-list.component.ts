import { Component, input, output } from '@angular/core';
import { DeviceExampleViewModel, ExampleItem } from '../../models';
import { DeviceCardComponent } from '../device-card/device-card.component';
import { ExampleItemComponent } from '../example-item/example-item.component';

@Component({
  selector: 'choh-example-list',
  imports: [DeviceCardComponent, ExampleItemComponent],
  templateUrl: './example-list.component.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class ExampleListComponent {
  readonly devices = input.required<DeviceExampleViewModel[]>();
  readonly remoteExample = input.required<ExampleItem[]>();
  readonly downloadInProgress = input(false);
  readonly saveExample = output<string>();
}
