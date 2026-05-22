import { Component, input, output } from '@angular/core';
import { ExampleItem } from '../../models/example.model';
import { ExampleItemComponent } from '../example-item/example-item.component';

@Component({
  selector: 'choh-example-list',
  imports: [ExampleItemComponent],
  templateUrl: './example-list.component.html',
})
export class ExampleListComponent {
  readonly gpioExample = input.required<ExampleItem[]>();
  readonly i2cExample = input.required<ExampleItem[]>();
  readonly remoteExample = input.required<ExampleItem[]>();
  readonly saveExample = output<ExampleItem>();
}
