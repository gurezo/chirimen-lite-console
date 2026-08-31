import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
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
    fixture.componentRef.setInput('remoteExample', []);
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

  it('renders a device card grid and keeps the remote table', () => {
    fixture.componentRef.setInput('devices', [device]);
    fixture.componentRef.setInput('remoteExample', [
      {
        id: 'remote_gpio_led',
        title: 'Remote LED',
        overview: 'remote',
        js: '',
        circuit: '',
        link: '',
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lib-device-card')).toBeTruthy();
    expect(host.textContent).toContain('AHT10');
    expect(host.querySelector('choh-example-item')).toBeTruthy();
    expect(host.textContent).toContain('Remote');
    expect(host.textContent).toContain('remote_gpio_led');
  });
});
