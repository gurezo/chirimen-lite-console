import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'choh-button',
  imports: [MatButtonModule],
  templateUrl: './button.component.html',
})
export class ButtonComponent {
  readonly label = input.required<string>();
  readonly color = input('');
  readonly disabled = input(false);
  readonly clickEvent = output<void>();
}
