import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteStopButtonComponent } from './remote-stop-button.component';

describe('RemoteStopButtonComponent', () => {
  let component: RemoteStopButtonComponent;
  let fixture: ComponentFixture<RemoteStopButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteStopButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteStopButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits stopClick when inner button is clicked', () => {
    const spy = vi.fn();
    component.stopClick.subscribe(spy);
    const btn = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
