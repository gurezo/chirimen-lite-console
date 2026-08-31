/**
 * Console-facing device example shape.
 * Keeps UI off the certified-devices JSON structure.
 */
export interface DeviceExampleViewModel {
  deviceId: string;
  model: string;
  description: string;
  category: string;
  tag: string;
  imageUrl: string | null;
  exampleId: string;
  circuitUrl: string | null;
}

export type DeviceCatalogState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; devices: DeviceExampleViewModel[] }
  | { status: 'error'; message: string };
