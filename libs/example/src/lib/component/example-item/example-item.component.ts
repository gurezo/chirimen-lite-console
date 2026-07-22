import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExampleItem } from '../../models';

@Component({
  selector: 'choh-example-item',
  imports: [MatIconModule, MatTableModule, MatTooltipModule],
  templateUrl: './example-item.component.html',
})
export class ExampleItemComponent {
  readonly label = input.required<string>();
  readonly exampleItem = input.required<ExampleItem[]>();
  readonly downloadInProgress = input(false);
  readonly saveExample = output<ExampleItem>();
  displayedColumns: string[] = [
    'id',
    'title',
    'overview',
    'js',
    'circuit',
    // 'link',
  ];

  onSave(element: ExampleItem): void {
    if (this.downloadInProgress()) {
      return;
    }
    this.saveExample.emit(element);
  }
}
