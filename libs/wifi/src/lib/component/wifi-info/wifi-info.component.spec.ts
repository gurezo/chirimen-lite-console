/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { WiFiInfo } from '@libs-shared';
import { WifiInfoComponent } from './wifi-info.component';

const sample: WiFiInfo = {
  ssid: 'test-ssid',
  address: '00:00:00:00:00:00',
  channel: 1,
  frequency: '2.4 GHz',
  quality: 'Quality=70/70  Signal level=-40 dBm',
  spec: 'IEEE 802.11i/WPA2 Version 1',
};

describe('WifiInfoComponent', () => {
  let component: WifiInfoComponent;
  let fixture: ComponentFixture<WifiInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiInfoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('wifiInfo', sample);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows hidden label for empty ssid', () => {
    fixture.componentRef.setInput('wifiInfo', { ...sample, ssid: '' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('（非公開）');
  });

  it('emits selectNetwork on Enter key', () => {
    const selected: WiFiInfo[] = [];
    component.selectNetwork.subscribe((info) => selected.push(info));

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.ssid).toBe('test-ssid');
  });

  it('emits selectNetwork on Space key', () => {
    const selected: WiFiInfo[] = [];
    component.selectNetwork.subscribe((info) => selected.push(info));

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    expect(selected).toHaveLength(1);
  });

  it('shows connected badge when connected input is true', () => {
    fixture.componentRef.setInput('connected', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('接続中');
  });
});
