import { Dialog } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@libs-shared-ui';
import {
  WifiRebootFlowService,
  WifiScanService,
} from '@libs-wifi-data-access';
import type { WiFiInfo } from '@libs-shared-types';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { WifiPageComponent } from './wifi-page.component';

describe('WifiPageComponent', () => {
  let component: WifiPageComponent;
  let fixture: ComponentFixture<WifiPageComponent>;

  const scanNetworks = vi.fn();

  beforeEach(async () => {
    scanNetworks.mockResolvedValue({
      wifiInfos: [] as WiFiInfo[],
      rawData: [] as string[],
    });

    await TestBed.configureTestingModule({
      imports: [WifiPageComponent],
      providers: [
        {
          provide: Dialog,
          useValue: {
            open: vi.fn().mockReturnValue({ closed: of(undefined) }),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
          },
        },
        {
          provide: SerialFacadeService,
          useValue: { isConnected$: new BehaviorSubject(true) },
        },
        {
          provide: WifiScanService,
          useValue: {
            scanNetworks,
            getWifiStatus: vi.fn().mockResolvedValue({
              ipInfo: '',
              wlInfo: '',
            }),
            checkChirimenTutorialReachability: vi
              .fn()
              .mockResolvedValue('OK'),
          },
        },
        {
          provide: WifiRebootFlowService,
          useValue: {
            restartWifiService: vi.fn().mockResolvedValue(undefined),
            rebootDevice: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('runWifiScan fills wifiInfoList when serial is connected', async () => {
    const wifiInfos: WiFiInfo[] = [
      {
        ssid: 'x',
        address: '00:00:00:00:00:01',
        channel: 1,
        frequency: '2.4',
        quality: '50',
        spec: 'WPA2',
      },
    ];
    scanNetworks.mockResolvedValue({
      rawData: [] as string[],
      wifiInfos,
    });
    await component.runWifiScan();
    expect(component.wifiInfoList.length).toBe(1);
    expect(component.wifiInfoList[0]?.ssid).toBe('x');
  });
});
