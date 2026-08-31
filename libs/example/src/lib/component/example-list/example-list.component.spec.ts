import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { DeviceExampleViewModel } from '../../models';
import { ExampleListComponent } from './example-list.component';

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

const gpioDevice: DeviceExampleViewModel = {
  deviceId: '10k',
  model: '10kΩ',
  description: 'resistor',
  category: 'カーボン抵抗',
  tag: 'GPIO',
  imageUrl: null,
  exampleId: 'hello-real-world',
  circuitUrl: null,
};

const analogDevice: DeviceExampleViewModel = {
  deviceId: 'GP2Y0A21YK',
  model: 'GP2Y0A21YK',
  description: 'distance',
  category: '距離センサ',
  tag: 'Analog',
  imageUrl: null,
  exampleId: 'analog-distance',
  circuitUrl: null,
};

function cardModels(host: HTMLElement): string[] {
  return [...host.querySelectorAll('lib-device-card')].map(
    (card) => card.textContent ?? '',
  );
}

function searchInput(host: HTMLElement): HTMLInputElement {
  return host.querySelector('input[type="search"]') as HTMLInputElement;
}

function clickInterfaceFilter(
  fixture: ComponentFixture<ExampleListComponent>,
  value: 'all' | 'gpio' | 'i2c',
): void {
  const toggle = (fixture.nativeElement as HTMLElement).querySelector(
    `mat-button-toggle[value="${value}"] button`,
  ) as HTMLButtonElement;
  toggle.click();
  fixture.detectChanges();
}

function typeSearch(
  fixture: ComponentFixture<ExampleListComponent>,
  query: string,
): void {
  const input = searchInput(fixture.nativeElement as HTMLElement);
  input.value = query;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function downloadButton(host: HTMLElement): HTMLButtonElement {
  return host.querySelector('lib-device-card button') as HTMLButtonElement;
}

describe('ExampleListComponent', () => {
  let component: ExampleListComponent;
  let fixture: ComponentFixture<ExampleListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleListComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('devices', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should use flex-1 min-h-0 host for shell-fit scroll region', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toMatch(/\bflex\b/);
    expect(host.className).toMatch(/\bflex-1\b/);
    expect(host.className).toMatch(/\bmin-h-0\b/);
    const scrollRegion = host.querySelector('.overflow-y-auto');
    expect(scrollRegion).toBeTruthy();
    expect(scrollRegion?.className).toMatch(/\bmin-h-0\b/);
    expect(scrollRegion?.className).toMatch(/\bflex-1\b/);
  });

  it('shows an empty state when there are no catalog devices', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('デバイスがありません。');
    expect(host.querySelector('lib-device-card')).toBeNull();
  });

  it('renders a device card grid', () => {
    fixture.componentRef.setInput('devices', [device]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lib-device-card')).toBeTruthy();
    expect(host.textContent).toContain('AHT10');
    expect(host.querySelector('choh-example-item')).toBeNull();
  });

  it('exposes a labeled search field and keyboard-accessible interface filter', () => {
    const host = fixture.nativeElement as HTMLElement;
    const input = searchInput(host);
    expect(input).toBeTruthy();
    expect(input.getAttribute('placeholder')).toBe('Search devices...');
    expect(host.textContent).toContain('Search devices');

    const group = host.querySelector(
      'mat-button-toggle-group',
    ) as HTMLElement;
    expect(group.getAttribute('aria-label')).toBe(
      'Filter devices by interface',
    );
    expect(group.getAttribute('tabindex')).not.toBe('-1');
    expect(group.classList.contains('device-interface-filter')).toBe(true);
  });

  it('filters cards by model search', () => {
    fixture.componentRef.setInput('devices', [
      device,
      gpioDevice,
      analogDevice,
    ]);
    fixture.detectChanges();

    typeSearch(fixture, 'aht');

    const models = cardModels(fixture.nativeElement as HTMLElement);
    expect(models).toHaveLength(1);
    expect(models[0]).toContain('AHT10');
    expect(models[0]).not.toContain('10kΩ');
  });

  it('filters cards by gpio and i2c toggles without remapping analog', () => {
    fixture.componentRef.setInput('devices', [
      device,
      gpioDevice,
      analogDevice,
    ]);
    fixture.detectChanges();

    clickInterfaceFilter(fixture, 'gpio');
    let models = cardModels(fixture.nativeElement as HTMLElement);
    expect(models).toHaveLength(1);
    expect(models[0]).toContain('10kΩ');

    clickInterfaceFilter(fixture, 'i2c');
    models = cardModels(fixture.nativeElement as HTMLElement);
    expect(models).toHaveLength(1);
    expect(models[0]).toContain('AHT10');

    clickInterfaceFilter(fixture, 'all');
    models = cardModels(fixture.nativeElement as HTMLElement);
    expect(models).toHaveLength(3);
  });

  it('combines search query and interface filter', () => {
    fixture.componentRef.setInput('devices', [
      device,
      { ...device, deviceId: 'ADT7410', model: 'ADT7410', exampleId: 'adt7410' },
      { ...device, deviceId: 'AHT20-GPIO', model: 'AHT20', tag: 'GPIO' },
    ]);
    fixture.detectChanges();

    typeSearch(fixture, 'aht');
    clickInterfaceFilter(fixture, 'i2c');

    const models = cardModels(fixture.nativeElement as HTMLElement);
    expect(models).toHaveLength(1);
    expect(models[0]).toContain('AHT10');
  });

  it('shows a no-matching empty state', () => {
    fixture.componentRef.setInput('devices', [device, gpioDevice]);
    fixture.detectChanges();

    typeSearch(fixture, 'not-a-device');

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lib-device-card')).toBeNull();
    expect(host.textContent).toContain('No matching devices found.');
    expect(host.textContent).not.toContain('デバイスがありません。');
    expect(host.querySelector('choh-example-item')).toBeNull();
  });

  it('forwards device card download as the example id', () => {
    fixture.componentRef.setInput('devices', [device]);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    downloadButton(fixture.nativeElement as HTMLElement).click();

    expect(emitSpy).toHaveBeenCalledWith('aht10');
  });

  it('does not forward download while it is in progress', () => {
    fixture.componentRef.setInput('devices', [device]);
    fixture.componentRef.setInput('downloadInProgress', true);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.saveExample, 'emit');
    const button = downloadButton(fixture.nativeElement as HTMLElement);
    expect(button.disabled).toBe(true);
    button.click();

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
