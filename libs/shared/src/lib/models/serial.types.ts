/// <reference types="@types/w3c-web-serial" />

export interface SerialPortOptions {
  baudRate: number;
}

export interface SerialPort {
  open(options: SerialPortOptions): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream;
  writable: WritableStream;
}

export interface Navigator extends globalThis.Navigator {
  serial: Serial;
}

export interface SerialPortInfo {
  usbVendorId: number;
  usbProductId: number;
}
