import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CERTIFIED_DEVICES_JSON_FALLBACK_URL,
  CERTIFIED_DEVICES_JSON_URL,
  type CertifiedDevicesDocument,
} from '../models';
import { DeviceCatalogService } from './device-catalog.service';

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
  ],
};

describe('DeviceCatalogService', () => {
  let service: DeviceCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DeviceCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('load fetches devices.json and maps pizero-esm primary devices', () => {
    service.load();
    expect(service.state().status).toBe('loading');

    const req = httpMock.expectOne(CERTIFIED_DEVICES_JSON_URL);
    expect(req.request.method).toBe('GET');
    req.flush(document);

    expect(service.state()).toEqual({
      status: 'success',
      devices: [
        {
          deviceId: 'ADT7410',
          model: 'ADT7410',
          description: 'temperature sensor',
          category: '温度センサ',
          tag: 'I2C',
          imageUrl: null,
          exampleId: 'adt7410',
          circuitUrl: null,
        },
      ],
    });
  });

  it('load does not issue a second HTTP request after success', () => {
    service.load();
    httpMock.expectOne(CERTIFIED_DEVICES_JSON_URL).flush(document);

    service.load();
    httpMock.expectNone(CERTIFIED_DEVICES_JSON_URL);
    httpMock.expectNone(CERTIFIED_DEVICES_JSON_FALLBACK_URL);
    expect(service.state().status).toBe('success');
  });

  it('falls back to jsDelivr when GitHub raw fails', () => {
    service.load();
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(CERTIFIED_DEVICES_JSON_FALLBACK_URL).flush(document);

    expect(service.state().status).toBe('success');
  });

  it('sets an error state when both sources fail', () => {
    service.load();
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_FALLBACK_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });

    expect(service.state()).toEqual({
      status: 'error',
      message: 'Unable to load device examples.',
    });
  });

  it('retry refetches after an error', () => {
    service.load();
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_FALLBACK_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });

    service.retry();
    expect(service.state().status).toBe('loading');
    httpMock.expectOne(CERTIFIED_DEVICES_JSON_URL).flush(document);
    expect(service.state().status).toBe('success');
  });

  it('load does not refetch while the last result is an error', () => {
    service.load();
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });
    httpMock
      .expectOne(CERTIFIED_DEVICES_JSON_FALLBACK_URL)
      .flush('fail', { status: 500, statusText: 'Server Error' });

    service.load();
    httpMock.expectNone(CERTIFIED_DEVICES_JSON_URL);
    expect(service.state().status).toBe('error');
  });
});
