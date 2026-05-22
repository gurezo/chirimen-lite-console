import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ConnectButtonComponent } from './connect-button.component';

describe('ConnectButtonComponent', () => {
  let component: ConnectButtonComponent;
  let fixture: ComponentFixture<ConnectButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show default label "Connect"', () => {
    expect(component.label()).toBe('Connect');
    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Connect');
  });

  it('should emit connect when button is clicked', () => {
    const spy = vi.fn();
    component.connect.subscribe(spy);
    const button = fixture.nativeElement.querySelector('button');
    button?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
