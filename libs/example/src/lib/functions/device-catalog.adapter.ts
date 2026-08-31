import {
  PIZERO_ESM_PLATFORM,
  PRIMARY_EXAMPLE_STATUS,
  REMOTE_DEVICE_ID_PREFIX,
  type CertifiedDevice,
  type CertifiedDeviceExample,
  type CertifiedDevicesDocument,
  type DeviceExampleViewModel,
  type ExampleItem,
} from '../models';

/** Last path segment of a pizero-esm upstreamPath, used as wget example id. */
export function extractPizeroExampleId(upstreamPath: string): string | null {
  const trimmed = upstreamPath.replace(/\/+$/, '').trim();
  if (!trimmed) {
    return null;
  }
  const segment = trimmed.split('/').filter(Boolean).at(-1);
  return segment && segment.length > 0 ? segment : null;
}

export function selectPizeroEsmPrimaryExample(
  examples: CertifiedDeviceExample[],
): CertifiedDeviceExample | undefined {
  return examples.find(
    (example) =>
      example.platform === PIZERO_ESM_PLATFORM &&
      example.status === PRIMARY_EXAMPLE_STATUS,
  );
}

export function isRemoteAliasDevice(deviceId: string): boolean {
  return deviceId.startsWith(REMOTE_DEVICE_ID_PREFIX);
}

export function toDeviceExampleViewModel(
  device: CertifiedDevice,
): DeviceExampleViewModel | null {
  if (isRemoteAliasDevice(device.id)) {
    return null;
  }

  const example = selectPizeroEsmPrimaryExample(device.meta.examples);
  if (!example) {
    return null;
  }

  const exampleId = extractPizeroExampleId(example.upstreamPath);
  if (!exampleId) {
    return null;
  }

  return {
    deviceId: device.id,
    model: device.meta.model,
    description: device.meta.description,
    category: device.meta.category,
    tag: device.meta.tag,
    imageUrl: device.meta.image,
    exampleId,
    circuitUrl: example.circuitUrl,
  };
}

export function toDeviceExampleViewModels(
  document: CertifiedDevicesDocument,
): DeviceExampleViewModel[] {
  return document.devices
    .map(toDeviceExampleViewModel)
    .filter((item): item is DeviceExampleViewModel => item !== null);
}

export function toExampleItem(viewModel: DeviceExampleViewModel): ExampleItem {
  return {
    id: viewModel.exampleId,
    title: viewModel.model,
    overview: viewModel.description,
    js: '',
    circuit: viewModel.circuitUrl ?? '',
    link: '',
  };
}

/**
 * Maps catalog devices onto the current GPIO / I2C table columns.
 * Non-I2C tags (GPIO, Analog, Actuator, Other) go to GPIO until Device Cards (#849).
 */
export function splitDeviceExamplesByInterface(
  devices: DeviceExampleViewModel[],
): { gpio: ExampleItem[]; i2c: ExampleItem[] } {
  const gpio: ExampleItem[] = [];
  const i2c: ExampleItem[] = [];

  for (const device of devices) {
    const item = toExampleItem(device);
    if (device.tag === 'I2C') {
      i2c.push(item);
    } else {
      gpio.push(item);
    }
  }

  return { gpio, i2c };
}
