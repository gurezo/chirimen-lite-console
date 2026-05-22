import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {
      void 0;
    }
    unobserve(): void {
      void 0;
    }
    disconnect(): void {
      void 0;
    }
  };
}

/** Minimal CanvasRenderingContext2D stub for xterm in jsdom */
const canvas2dStub: Partial<CanvasRenderingContext2D> = {
  fillRect: () => undefined,
  clearRect: () => undefined,
  scale: () => undefined,
  fillText: () => undefined,
  measureText: () => ({ width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }),
  getImageData: () =>
    new ImageData(new Uint8ClampedArray(4), 1, 1),
  putImageData: () => undefined,
  drawImage: () => undefined,
  save: () => undefined,
  restore: () => undefined,
  translate: () => undefined,
  beginPath: () => undefined,
  clip: () => undefined,
  strokeRect: () => undefined,
  createImageData: (w: number, h: number) =>
    new ImageData(w, h),
};

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
) {
  if (contextId === '2d') {
    canvas2dStub.canvas = this;
    return canvas2dStub as CanvasRenderingContext2D;
  }
  return null;
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
