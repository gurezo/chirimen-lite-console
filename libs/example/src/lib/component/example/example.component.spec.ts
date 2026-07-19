import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SerialNotificationService } from '@libs-web-serial';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExampleComponent } from './example.component';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [ExampleComponent, HttpClientTestingModule],
      providers: [
        {
          provide: Router,
          useValue: { navigate },
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyAutoLoginFailed: () => undefined,
            notifyConnectionSuccess: () => undefined,
            notifyConnectionError: () => undefined,
            notifyLogoutDetected: () => undefined,
            notifyLogoutCancelled: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fill outlet height and use flex shell layout', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toMatch(/\bh-full\b/);
    expect(host.className).toMatch(/\bflex\b/);
    expect(host.className).toMatch(/\bflex-col\b/);
    const outer = host.querySelector(':scope > div');
    expect(outer?.className).toMatch(/\bflex-col\b/);
    expect(outer?.className).toMatch(/\bh-full\b/);
    expect(outer?.className).toMatch(/\boverflow-hidden\b/);
    const card = outer?.querySelector(':scope > div');
    expect(card?.className).toMatch(/\bflex-1\b/);
    expect(card?.className).toMatch(/\boverflow-hidden\b/);
  });

  it('should navigate to terminal when closing', () => {
    component.closeModal();
    expect(navigate).toHaveBeenCalledWith(['/terminal']);
  });
});
