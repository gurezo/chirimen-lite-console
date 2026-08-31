import { describe, expect, it } from 'vitest';
import {
  extractPizeroExampleId,
  isRemoteAliasDevice,
  selectPizeroEsmPrimaryExample,
  splitDeviceExamplesByInterface,
  toDeviceExampleViewModels,
  toExampleItem,
} from './device-catalog.adapter';
import type {
  CertifiedDevice,
  CertifiedDeviceExample,
  CertifiedDevicesDocument,
  DeviceExampleViewModel,
} from '../models';

function example(
  overrides: Partial<CertifiedDeviceExample> = {},
): CertifiedDeviceExample {
  return {
    platform: 'pizero-esm',
    status: 'primary',
    upstreamPath: 'pizero/src/esm-examples/adt7410',
    circuitUrl: 'https://example.test/circuit.png',
    ...overrides,
  };
}

function device(
  overrides: Partial<CertifiedDevice> & {
    meta?: Partial<CertifiedDevice['meta']>;
  } = {},
): CertifiedDevice {
  const { meta, ...rest } = overrides;
  return {
    id: 'ADT7410',
    meta: {
      id: 'ADT7410',
      model: 'ADT7410',
      tag: 'I2C',
      category: '温度センサ',
      description: 'temperature sensor',
      image: 'https://example.test/adt7410.jpg',
      examples: [example()],
      ...meta,
    },
    ...rest,
  };
}

describe('device-catalog.adapter', () => {
  it('extractPizeroExampleId takes the last path segment', () => {
    expect(
      extractPizeroExampleId('pizero/src/esm-examples/hello-real-world'),
    ).toBe('hello-real-world');
    expect(extractPizeroExampleId('adt7410')).toBe('adt7410');
    expect(extractPizeroExampleId('')).toBeNull();
    expect(extractPizeroExampleId('///')).toBeNull();
  });

  it('selectPizeroEsmPrimaryExample keeps only pizero-esm primary', () => {
    const selected = selectPizeroEsmPrimaryExample([
      example({ platform: 'legacy-gc-i2c', status: 'archive' }),
      example({ platform: 'pizero-esm', status: 'special' }),
      example({
        platform: 'pizero-esm',
        status: 'primary',
        upstreamPath: 'pizero/src/esm-examples/aht10',
      }),
    ]);
    expect(selected?.upstreamPath).toBe('pizero/src/esm-examples/aht10');
  });

  it('isRemoteAliasDevice detects remote_ ids', () => {
    expect(isRemoteAliasDevice('remote_ADT7410')).toBe(true);
    expect(isRemoteAliasDevice('ADT7410')).toBe(false);
  });

  it('toDeviceExampleViewModels extracts pizero-esm primary devices', () => {
    const document: CertifiedDevicesDocument = {
      version: 1,
      devices: [
        device(),
        device({
          id: '10k',
          meta: {
            id: '10k',
            model: '10kΩ',
            tag: 'GPIO',
            category: 'カーボン抵抗',
            description: 'resistor',
            image: null,
            examples: [
              example({
                upstreamPath: 'pizero/src/esm-examples/hello-real-world',
                circuitUrl: null,
              }),
            ],
          },
        }),
        device({
          id: 'no-pizero',
          meta: {
            examples: [
              example({ platform: 'microbit-driver', status: 'incubator' }),
            ],
          },
        }),
        device({
          id: 'special-only',
          meta: {
            examples: [example({ status: 'special' })],
          },
        }),
        device({
          id: 'remote_ADT7410',
          meta: { id: 'remote_ADT7410' },
        }),
      ],
    };

    const viewModels = toDeviceExampleViewModels(document);
    expect(viewModels).toEqual([
      {
        deviceId: 'ADT7410',
        model: 'ADT7410',
        description: 'temperature sensor',
        category: '温度センサ',
        tag: 'I2C',
        imageUrl: 'https://example.test/adt7410.jpg',
        exampleId: 'adt7410',
        circuitUrl: 'https://example.test/circuit.png',
      },
      {
        deviceId: '10k',
        model: '10kΩ',
        description: 'resistor',
        category: 'カーボン抵抗',
        tag: 'GPIO',
        imageUrl: null,
        exampleId: 'hello-real-world',
        circuitUrl: null,
      },
    ]);
  });

  it('toExampleItem maps view model onto the existing table row', () => {
    const viewModel: DeviceExampleViewModel = {
      deviceId: 'AHT10',
      model: 'AHT10',
      description: 'humidity sensor',
      category: '温湿度センサー',
      tag: 'I2C',
      imageUrl: null,
      exampleId: 'aht10',
      circuitUrl: 'https://example.test/aht10.png',
    };
    expect(toExampleItem(viewModel)).toEqual({
      id: 'aht10',
      title: 'AHT10',
      overview: 'humidity sensor',
      js: '',
      circuit: 'https://example.test/aht10.png',
      link: '',
    });
  });

  it('splitDeviceExamplesByInterface puts I2C in i2c and other tags in gpio', () => {
    const { gpio, i2c } = splitDeviceExamplesByInterface([
      {
        deviceId: 'AHT10',
        model: 'AHT10',
        description: 'humidity',
        category: 'sensor',
        tag: 'I2C',
        imageUrl: null,
        exampleId: 'aht10',
        circuitUrl: null,
      },
      {
        deviceId: '10k',
        model: '10kΩ',
        description: 'resistor',
        category: 'resistor',
        tag: 'GPIO',
        imageUrl: null,
        exampleId: 'hello-real-world',
        circuitUrl: null,
      },
      {
        deviceId: 'SG90',
        model: 'SG90',
        description: 'servo',
        category: 'servo',
        tag: 'Actuator',
        imageUrl: null,
        exampleId: 'servo',
        circuitUrl: null,
      },
    ]);

    expect(i2c.map((item) => item.id)).toEqual(['aht10']);
    expect(gpio.map((item) => item.id)).toEqual([
      'hello-real-world',
      'servo',
    ]);
  });
});
