import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DeviceExampleViewModel } from '../../models';
import { TruncatePipe } from './truncate.pipe';

@Component({
  selector: 'lib-device-card',
  imports: [MatButtonModule, MatCardModule, MatIconModule, TruncatePipe],
  templateUrl: './device-card.component.html',
  host: {
    class: 'block h-full',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceCardComponent {
  readonly device = input.required<DeviceExampleViewModel>();
  readonly downloadInProgress = input(false);
  readonly saveExample = output<string>();

  onSave(): void {
    if (this.downloadInProgress()) {
      return;
    }
    this.saveExample.emit(this.device().exampleId);
  }
}
