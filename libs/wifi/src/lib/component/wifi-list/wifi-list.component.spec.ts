/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { WiFiInfo } from '@libs-shared';
import { WifiListComponent } from './wifi-list.component';

const sampleNetwork: WiFiInfo = {
  ssid: 'cafe-wifi',
  address: 'AA:BB:CC:DD:EE:01',
  channel: 1,
  frequency: '2.412 GHz (Channel 1)',
  quality: 'Quality=53/70  Signal level=-57 dBm',
  spec: 'IEEE 802.11i/WPA2 Version 1,CCMP,CCMPPSK',
};

const longSsidNetwork: WiFiInfo = {
  ...sampleNetwork,
  ssid: 'a-very-long-ssid-name-that-should-truncate-in-the-list-ui',
  address: 'AA:BB:CC:DD:EE:02',
};

describe('WifiListComponent', () => {
  let component: WifiListComponent;
  let fixture: ComponentFixture<WifiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows empty state when list is empty and not scanning', () => {
    fixture.componentRef.setInput('wifiInfoList', []);
    fixture.componentRef.setInput('scanInProgress', false);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('スキャン結果がありません');
  });

  it('shows loading state while scanning', () => {
    fixture.componentRef.setInput('scanInProgress', true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('スキャン中');
    const list = fixture.nativeElement.querySelector('[role="list"]');
    expect(list?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows error state when scanError is set', () => {
    fixture.componentRef.setInput('scanInProgress', false);
    fixture.componentRef.setInput('scanError', 'スキャンに失敗しました');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('スキャンに失敗しました');
  });

  it('renders column headers and network rows', () => {
    fixture.componentRef.setInput('wifiInfoList', [sampleNetwork]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('SSID');
    expect(text).toContain('Signal');
    expect(text).toContain('Security');
    expect(text).toContain('接続状態');
    expect(text).toContain('接続操作');
    expect(text).toContain('cafe-wifi');
    expect(text).toContain('-57 dBm');
    expect(text).toContain('WPA2');
  });

  it('marks selected and connected rows', () => {
    fixture.componentRef.setInput('wifiInfoList', [sampleNetwork]);
    fixture.componentRef.setInput('selectedAddress', sampleNetwork.address);
    fixture.componentRef.setInput('connectedSsid', sampleNetwork.ssid);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector(
      'choh-wifi-info',
    ) as HTMLElement;
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(row.classList.contains('bg-blue-50')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('接続中');
  });

  it('exposes full ssid via title for long names', () => {
    fixture.componentRef.setInput('wifiInfoList', [longSsidNetwork]);
    fixture.detectChanges();

    const titled = fixture.nativeElement.querySelector(
      `[title="${longSsidNetwork.ssid}"]`,
    );
    expect(titled).toBeTruthy();
  });

  it('emits networkSelected on row activation', () => {
    fixture.componentRef.setInput('wifiInfoList', [sampleNetwork]);
    fixture.detectChanges();

    const selected: WiFiInfo[] = [];
    component.networkSelected.subscribe((info) => selected.push(info));

    const row = fixture.nativeElement.querySelector(
      'choh-wifi-info',
    ) as HTMLElement;
    row.click();
    expect(selected).toHaveLength(1);
    expect(selected[0]?.address).toBe(sampleNetwork.address);
  });

  it('emits networkConnect from connect button without relying on row click alone', () => {
    fixture.componentRef.setInput('wifiInfoList', [sampleNetwork]);
    fixture.detectChanges();

    const connected: WiFiInfo[] = [];
    component.networkConnect.subscribe((info) => connected.push(info));

    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    expect(connected).toHaveLength(1);
    expect(connected[0]?.ssid).toBe('cafe-wifi');
  });
});
