import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  filterDeviceCatalog,
  type DeviceInterfaceFilter,
} from '../../functions';
import { DeviceExampleViewModel } from '../../models';
import { DeviceCardComponent } from '../device-card/device-card.component';

@Component({
  selector: 'choh-example-list',
  imports: [
    DeviceCardComponent,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './example-list.component.html',
  styles: `
    mat-button-toggle-group.device-interface-filter {
      display: inline-grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
    }

    mat-button-toggle-group.device-interface-filter mat-button-toggle {
      width: 100%;
    }
  `,
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class ExampleListComponent {
  readonly devices = input.required<DeviceExampleViewModel[]>();
  readonly downloadInProgress = input(false);
  readonly saveExample = output<string>();

  readonly searchQuery = signal('');
  readonly interfaceTag = signal<DeviceInterfaceFilter>('all');

  readonly filteredDevices = computed(() =>
    filterDeviceCatalog(this.devices(), {
      query: this.searchQuery(),
      interfaceTag: this.interfaceTag(),
    }),
  );

  onSearchInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.searchQuery.set(target.value);
  }

  onInterfaceTagChange(value: string): void {
    if (value === 'all' || value === 'gpio' || value === 'i2c') {
      this.interfaceTag.set(value);
    }
  }
}
