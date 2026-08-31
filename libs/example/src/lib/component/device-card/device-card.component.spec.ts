import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it } from 'vitest';
import { DeviceExampleViewModel } from '../../models';
import { DeviceCardComponent } from './device-card.component';

const device: DeviceExampleViewModel = {
  deviceId: 'AHT10',
  model: 'AHT10',
  description: '温度と湿度を取得する',
  category: '温湿度センサー',
  tag: 'I2C',
  imageUrl: 'https://example.test/aht10.jpg',
  exampleId: 'aht10',
  circuitUrl: null,
};

describe('DeviceCardComponent', () => {
  let component: DeviceCardComponent;
  let fixture: ComponentFixture<DeviceCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceCardComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('device', device);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
