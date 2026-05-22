import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ConnectStatus,
  ConnectionStatusComponent,
} from './connection-status.component';

describe('ConnectionStatusComponent', () => {
  let component: ConnectionStatusComponent;
  let fixture: ComponentFixture<ConnectionStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectionStatusComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectionStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show disconnected message and image when status is disconnected', () => {
    fixture.componentRef.setInput('status', 'disconnected');
    fixture.componentRef.setInput('message', 'Please connect.');
    fixture.componentRef.setInput('imageSrc', '/test.jpg');
    fixture.componentRef.setInput('imageAlt', 'Test');
    fixture.detectChanges();

    const h2 = fixture.nativeElement.querySelector('h2');
    expect(h2?.textContent?.trim()).toBe('Please connect.');
    const img = fixture.nativeElement.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/test.jpg');
    expect(img?.getAttribute('alt')).toBe('Test');
  });

  it('should show connection status text when status is not disconnected', () => {
    fixture.componentRef.setInput('status', 'connected');
    fixture.detectChanges();

    const p = fixture.nativeElement.querySelector('p');
    expect(p?.textContent?.trim()).toBe('Connection status: connected');
  });
});
