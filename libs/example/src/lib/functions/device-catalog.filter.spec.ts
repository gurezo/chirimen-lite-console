import { describe, expect, it } from 'vitest';
import { filterDeviceCatalog } from './device-catalog.filter';
import type { DeviceExampleViewModel } from '../models';

function device(
  overrides: Partial<DeviceExampleViewModel> = {},
): DeviceExampleViewModel {
  return {
    deviceId: 'AHT10',
    model: 'AHT10',
    description: 'humidity',
    category: 'sensor',
    tag: 'I2C',
    imageUrl: null,
    exampleId: 'aht10',
    circuitUrl: null,
    ...overrides,
  };
}

const catalog: DeviceExampleViewModel[] = [
  device({ deviceId: 'AHT10', model: 'AHT10', tag: 'I2C', exampleId: 'aht10' }),
  device({
    deviceId: '10k',
    model: '10kΩ',
    tag: 'GPIO',
    exampleId: 'hello-real-world',
  }),
  device({
    deviceId: 'SG90',
    model: 'SG90',
    tag: 'Actuator',
    exampleId: 'servo',
  }),
  device({
    deviceId: 'GP2Y0A21YK',
    model: 'GP2Y0A21YK',
    tag: 'Analog',
    exampleId: 'analog-distance',
  }),
];

describe('filterDeviceCatalog', () => {
  it('returns all devices when query is empty and filter is all', () => {
    expect(
      filterDeviceCatalog(catalog, { query: '', interfaceTag: 'all' }),
    ).toEqual(catalog);
  });

  it('treats whitespace-only query as empty', () => {
    expect(
      filterDeviceCatalog(catalog, { query: '   ', interfaceTag: 'all' }),
    ).toEqual(catalog);
  });

  it('matches model by case-insensitive substring', () => {
    const result = filterDeviceCatalog(catalog, {
      query: 'aht',
      interfaceTag: 'all',
    });
    expect(result.map((item) => item.deviceId)).toEqual(['AHT10']);
  });

  it('matches deviceId by case-insensitive substring', () => {
    const result = filterDeviceCatalog(catalog, {
      query: '10k',
      interfaceTag: 'all',
    });
    expect(result.map((item) => item.deviceId)).toEqual(['10k']);
  });

  it('filters gpio by exact tag match', () => {
    const result = filterDeviceCatalog(catalog, {
      query: '',
      interfaceTag: 'gpio',
    });
    expect(result.map((item) => item.deviceId)).toEqual(['10k']);
  });

  it('filters i2c by exact tag match ignoring case', () => {
    const result = filterDeviceCatalog(
      [device({ tag: 'i2c' }), device({ deviceId: '10k', tag: 'GPIO' })],
      { query: '', interfaceTag: 'i2c' },
    );
    expect(result.map((item) => item.deviceId)).toEqual(['AHT10']);
  });

  it('keeps analog and actuator devices only in all', () => {
    const all = filterDeviceCatalog(catalog, {
      query: '',
      interfaceTag: 'all',
    });
    const gpio = filterDeviceCatalog(catalog, {
      query: '',
      interfaceTag: 'gpio',
    });
    const i2c = filterDeviceCatalog(catalog, {
      query: '',
      interfaceTag: 'i2c',
    });

    expect(all.map((item) => item.deviceId)).toEqual([
      'AHT10',
      '10k',
      'SG90',
      'GP2Y0A21YK',
    ]);
    expect(gpio.map((item) => item.deviceId)).toEqual(['10k']);
    expect(i2c.map((item) => item.deviceId)).toEqual(['AHT10']);
  });

  it('combines search query and interface filter with AND', () => {
    const mixed: DeviceExampleViewModel[] = [
      device({ deviceId: 'AHT10', model: 'AHT10', tag: 'I2C' }),
      device({ deviceId: 'ADT7410', model: 'ADT7410', tag: 'I2C' }),
      device({ deviceId: 'AHT20-GPIO', model: 'AHT20', tag: 'GPIO' }),
    ];

    const result = filterDeviceCatalog(mixed, {
      query: 'aht',
      interfaceTag: 'i2c',
    });
    expect(result.map((item) => item.deviceId)).toEqual(['AHT10']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(
      filterDeviceCatalog(catalog, {
        query: 'not-a-device',
        interfaceTag: 'all',
      }),
    ).toEqual([]);
  });
});
