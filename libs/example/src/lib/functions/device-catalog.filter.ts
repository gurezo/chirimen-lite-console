import type { DeviceExampleViewModel } from '../models';

export type DeviceInterfaceFilter = 'all' | 'gpio' | 'i2c';

export interface DeviceCatalogFilter {
  query: string;
  interfaceTag: DeviceInterfaceFilter;
}

const INTERFACE_TAG_VALUE: Record<
  Exclude<DeviceInterfaceFilter, 'all'>,
  string
> = {
  gpio: 'gpio',
  i2c: 'i2c',
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesQuery(
  device: DeviceExampleViewModel,
  query: string,
): boolean {
  if (!query) {
    return true;
  }

  return (
    normalize(device.model).includes(query) ||
    normalize(device.deviceId).includes(query)
  );
}

function matchesInterfaceTag(
  device: DeviceExampleViewModel,
  interfaceTag: DeviceInterfaceFilter,
): boolean {
  if (interfaceTag === 'all') {
    return true;
  }

  return normalize(device.tag) === INTERFACE_TAG_VALUE[interfaceTag];
}

export function filterDeviceCatalog(
  devices: DeviceExampleViewModel[],
  filter: DeviceCatalogFilter,
): DeviceExampleViewModel[] {
  const query = normalize(filter.query);

  return devices.filter(
    (device) =>
      matchesQuery(device, query) &&
      matchesInterfaceTag(device, filter.interfaceTag),
  );
}
