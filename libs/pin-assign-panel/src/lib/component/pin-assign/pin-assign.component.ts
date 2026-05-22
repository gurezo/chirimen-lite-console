import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'choh-pin-assign',
  imports: [NgOptimizedImage],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col',
  },
  templateUrl: './pin-assign.component.html',
})
export class PinAssignComponent {}
