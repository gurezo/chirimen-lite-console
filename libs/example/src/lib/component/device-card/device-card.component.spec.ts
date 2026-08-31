import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
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

  it('renders model, description, category, tag, and Pi Zero', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('AHT10');
    expect(text).toContain('温度と湿度を取得する');
    expect(text).toContain('温湿度センサー');
    expect(text).toContain('I2C');
    expect(text).toContain('Pi Zero');
  });

  it('renders the device image with the model as accessible name', () => {
    const img = (fixture.nativeElement as HTMLElement).querySelector(
      'img',
    ) as HTMLImageElement;
    expect(img.src).toBe('https://example.test/aht10.jpg');
    expect(img.alt).toBe('AHT10');
  });

  it('renders a placeholder when imageUrl is missing', () => {
    fixture.componentRef.setInput('device', { ...device, imageUrl: null });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('img')).toBeNull();
    const placeholder = host.querySelector('[role="img"]') as HTMLElement;
    expect(placeholder.getAttribute('aria-label')).toBe('AHT10');
  });

  it('names the download action for assistive technology', () => {
    const button = (
      fixture.nativeElement as HTMLElement
    ).querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe(
      'Download Example for AHT10',
    );
    expect(button.textContent).toContain('Download Example');
  });

  it('emits saveExample with the example id', () => {
    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    const button = (
      fixture.nativeElement as HTMLElement
    ).querySelector('button') as HTMLButtonElement;
    button.click();
    expect(emitSpy).toHaveBeenCalledWith('aht10');
  });

  it('does not emit saveExample while download is in progress', () => {
    fixture.componentRef.setInput('downloadInProgress', true);
    fixture.detectChanges();
    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    component.onSave();
    expect(emitSpy).not.toHaveBeenCalled();
  });
});
