import { Component, input, output } from '@angular/core';
import { ExampleItem } from '../../models';
import { ExampleItemComponent } from '../example-item/example-item.component';

@Component({
  selector: 'choh-example-list',
  imports: [ExampleItemComponent],
  templateUrl: './example-list.component.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class ExampleListComponent {
  readonly gpioExample = input.required<ExampleItem[]>();
  readonly i2cExample = input.required<ExampleItem[]>();
  readonly remoteExample = input.required<ExampleItem[]>();
  readonly downloadInProgress = input(false);
  readonly saveExample = output<ExampleItem>();
}
