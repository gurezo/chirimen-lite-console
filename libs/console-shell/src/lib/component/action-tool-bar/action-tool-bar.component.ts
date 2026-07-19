import { Component, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';

export type ToolbarAction =
  | 'editor'
  | 'example'
  | 'i2c'
  | 'remote'
  | 'setup'
  | 'terminal'
  | 'wifi';

@Component({
  selector: 'lib-action-tool-bar',
  imports: [MatIconButton, MatIcon, MatTooltip],
  templateUrl: './action-tool-bar.component.html',
})
export class ActionToolBarComponent {
  connected = input(false);
  toolbarAction = output<ToolbarAction>();

  readonly toolbarActions = [
    { name: 'terminal', icon: 'terminal', tooltip: 'ターミナル' },
    { name: 'wifi', icon: 'signal_wifi_4_bar', tooltip: 'WiFi' },
    { name: 'editor', icon: 'text_ad', tooltip: 'エディター' },
    { name: 'example', icon: 'javascript', tooltip: 'サンプル' },
    { name: 'i2c', icon: 'lan', tooltip: 'I2C' },
    { name: 'setup', icon: 'settings', tooltip: 'セットアップ' },
    { name: 'remote', icon: 'sync', tooltip: 'リモート' },
  ] as const;
}
