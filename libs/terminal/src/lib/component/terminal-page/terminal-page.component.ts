import { Component } from '@angular/core';
import { TerminalViewComponent } from '../terminal-view/terminal-view.component';

@Component({
  selector: 'choh-terminal',
  imports: [TerminalViewComponent],
  templateUrl: './terminal-page.component.html',
})
export default class TerminalPageComponent {}
