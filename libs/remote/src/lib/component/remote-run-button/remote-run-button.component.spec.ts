import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteRunButtonComponent } from './remote-run-button.component';

describe('RemoteRunButtonComponent', () => {
  let component: RemoteRunButtonComponent;
  let fixture: ComponentFixture<RemoteRunButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteRunButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteRunButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits runClick when inner button is clicked', () => {
    const spy = vi.fn();
    component.runClick.subscribe(spy);
    const btn = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });
});
