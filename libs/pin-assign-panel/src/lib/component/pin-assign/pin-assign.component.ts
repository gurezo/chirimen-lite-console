import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'choh-pin-assign',
  imports: [NgOptimizedImage],
  host: {
    class: 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden',
  },
  templateUrl: './pin-assign.component.html',
})
export class PinAssignComponent {}
