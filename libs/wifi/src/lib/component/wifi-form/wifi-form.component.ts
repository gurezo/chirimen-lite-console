import { Component, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { WifiFormSubmit } from '../../models/wifi-form.types';

/**
 * SSID / パスワード入力フォーム
 */
@Component({
  selector: 'choh-wifi-form',
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './wifi-form.component.html',
})
export class WifiFormComponent {
  ssid = '';
  password = '';

  readonly formSubmit = output<WifiFormSubmit>();

  onSubmit(event: Event): void {
    event.preventDefault();
    this.formSubmit.emit({ ssid: this.ssid, password: this.password });
  }
}
