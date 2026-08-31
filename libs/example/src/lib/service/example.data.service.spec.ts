import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CERTIFIED_DEVICES_JSON_URL, type CertifiedDevicesDocument } from '../models';
import { DeviceCatalogService } from './device-catalog.service';
import { ExampleDataService } from './example.data.service';
import { ExampleService } from './example.service';

const document: CertifiedDevicesDocument = {
  version: 1,
  devices: [
    {
      id: 'ADT7410',
      meta: {
        id: 'ADT7410',
        model: 'ADT7410',
        tag: 'I2C',
        category: '温度センサ',
        description: 'temperature sensor',
        image: null,
        examples: [
          {
            platform: 'pizero-esm',
            status: 'primary',
            upstreamPath: 'pizero/src/esm-examples/adt7410',
            circuitUrl: null,
          },
        ],
      },
    },
    {
      id: '10k',
      meta: {
        id: '10k',
        model: '10kΩ',
        tag: 'GPIO',
        category: 'カーボン抵抗',
        description: 'resistor',
        image: null,
        examples: [
          {
            platform: 'pizero-esm',
            status: 'primary',
            upstreamPath: 'pizero/src/esm-examples/hello-real-world',
            circuitUrl: null,
          },
        ],
      },
    },
  ],
};

describe('ExampleDataService', () => {
  let service: ExampleDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ExampleDataService, ExampleService, DeviceCatalogService],
    });
    service = TestBed.inject(ExampleDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getGPIOExampleList and getI2CExampleList split the catalog by tag', async () => {
    const gpioPromise = firstValueFrom(service.getGPIOExampleList());
    const i2cPromise = firstValueFrom(service.getI2CExampleList());

    httpMock.expectOne(CERTIFIED_DEVICES_JSON_URL).flush(document);

    const gpio = await gpioPromise;
    const i2c = await i2cPromise;
    expect(gpio.map((item) => item.id)).toEqual(['hello-real-world']);
    expect(i2c.map((item) => item.id)).toEqual(['adt7410']);
  });

  it('getRemoteExampleList still loads remote.json', async () => {
    const remotePromise = firstValueFrom(service.getRemoteExampleList());
    const req = httpMock.expectOne('./assets/json/remote.json');
    req.flush([{ id: 'remote_gpio_led', title: 'リモートLチカ', overview: 'led' }]);

    const remote = await remotePromise;
    expect(remote[0]?.id).toBe('remote_gpio_led');
  });
});
