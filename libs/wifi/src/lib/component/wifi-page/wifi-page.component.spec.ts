import { computed, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@libs-shared';
import {
  WifiPostConnectRebootFlowService,
  WifiRebootFlowService,
  WifiScanService,
} from '../../service';
import type { WiFiInfo } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { WifiPageComponent } from './wifi-page.component';

describe('WifiPageComponent', () => {
  let component: WifiPageComponent;
  let fixture: ComponentFixture<WifiPageComponent>;

  const scanNetworks = vi.fn();
  const postConnectRebootRun = vi.fn().mockResolvedValue(undefined);
  const rebootFlowInProgress = signal(false);

  let dialogClosed: ReturnType<typeof of>;

  beforeEach(async () => {
    scanNetworks.mockResolvedValue({
      wifiInfos: [] as WiFiInfo[],
      rawData: [] as string[],
    });
    dialogClosed = of(undefined);
    postConnectRebootRun.mockClear().mockResolvedValue(undefined);
    rebootFlowInProgress.set(false);

    await TestBed.configureTestingModule({
      imports: [WifiPageComponent],
      providers: [
        {
          provide: Dialog,
          useValue: {
            open: vi.fn().mockImplementation(() => ({ closed: dialogClosed })),
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
          useValue: {
            isConnected: computed(() => true),
          },
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
            rebootDevice: vi.fn().mockResolvedValue('ok'),
          },
        },
        {
          provide: WifiPostConnectRebootFlowService,
          useValue: {
            inProgress: rebootFlowInProgress.asReadonly(),
            run: postConnectRebootRun,
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
    expect(component.wifiInfoList().length).toBe(1);
    expect(component.wifiInfoList()[0]?.ssid).toBe('x');
  });

  it('onNetworkSelected sets selectedAddress without opening dialog', () => {
    const dialog = TestBed.inject(Dialog);
    const openSpy = vi.spyOn(dialog, 'open');

    component.onNetworkSelected({
      ssid: 'home',
      address: 'AA:BB:CC:DD:EE:FF',
      channel: 1,
      frequency: '2.4',
      quality: '50',
      spec: 'WPA2',
    });

    expect(component.selectedAddress()).toBe('AA:BB:CC:DD:EE:FF');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('onNetworkConnect opens connect dialog with ssid', async () => {
    const dialog = TestBed.inject(Dialog);
    const openSpy = vi.spyOn(dialog, 'open');

    component.onNetworkConnect({
      ssid: 'home',
      address: 'AA:BB:CC:DD:EE:FF',
      channel: 1,
      frequency: '2.4',
      quality: '50',
      spec: 'WPA2',
    });

    expect(component.selectedAddress()).toBe('AA:BB:CC:DD:EE:FF');
    await fixture.whenStable();
    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls[0]?.[1]?.data).toEqual({
      initialSsid: 'home',
      ssidReadonly: true,
    });
  });

  it('refreshes scan after successful connect dialog close', async () => {
    const closed$ = new Subject<boolean | undefined>();
    const dialog = TestBed.inject(Dialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({
      closed: closed$.asObservable(),
    } as ReturnType<Dialog['open']>);

    const wifiInfos: WiFiInfo[] = [
      {
        ssid: 'home',
        address: 'AA:BB:CC:DD:EE:FF',
        channel: 1,
        frequency: '2.4',
        quality: '50',
        spec: 'WPA2',
      },
    ];
    scanNetworks.mockClear();
    scanNetworks.mockResolvedValue({
      rawData: [] as string[],
      wifiInfos,
    });

    component.openConnectDialog('home', true);
    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
    closed$.next(true);
    closed$.complete();
    await vi.waitFor(() => {
      expect(component.wifiInfoList()).toEqual(wifiInfos);
    });
    expect(scanNetworks).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(postConnectRebootRun).toHaveBeenCalled();
    });
  });

  it('rebootDevice delegates to post-connect reboot flow', async () => {
    await component.rebootDevice();
    expect(postConnectRebootRun).toHaveBeenCalledWith({
      afterReconnect: expect.any(Function),
    });
  });

  it('does not refresh scan when connect dialog is cancelled', async () => {
    const closed$ = new Subject<boolean | undefined>();
    const dialog = TestBed.inject(Dialog);
    const openSpy = vi.spyOn(dialog, 'open').mockReturnValue({
      closed: closed$.asObservable(),
    } as ReturnType<Dialog['open']>);
    scanNetworks.mockClear();

    component.openConnectDialog('home');
    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
    closed$.next(false);
    closed$.complete();
    await new Promise((r) => setTimeout(r, 0));

    expect(scanNetworks).not.toHaveBeenCalled();
  });

  it('runWifiScan sets scanError when scan fails', async () => {
    scanNetworks.mockRejectedValueOnce(new Error('scan failed'));
    await component.runWifiScan();
    expect(component.scanError()).toBe('scan failed');
  });
});


