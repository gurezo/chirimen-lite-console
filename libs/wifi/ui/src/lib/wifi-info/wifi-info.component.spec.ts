/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WiFiInfo } from '@libs-shared';
import { WifiInfoComponent } from './wifi-info.component';

describe('WifiInfoComponent', () => {
  let component: WifiInfoComponent;
  let fixture: ComponentFixture<WifiInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WifiInfoComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiInfoComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('wifiInfo', {
      ssid: 'test-ssid',
      address: '00:00:00:00:00:00',
      channel: 1,
      frequency: '2.4 GHz',
      quality: '70/70',
      spec: '802.11n',
    } satisfies WiFiInfo);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
