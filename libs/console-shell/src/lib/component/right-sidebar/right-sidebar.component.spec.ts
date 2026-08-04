/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { RightSidebarComponent } from './right-sidebar.component';

describe('RightSidebarComponent', () => {
  let component: RightSidebarComponent;
  let fixture: ComponentFixture<RightSidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RightSidebarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RightSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleRightSidebar when the panel toggle is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleRightSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[1]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit toggleRightSidebar when the fiber_pin icon is clicked', () => {
    const emitSpy = vi.spyOn(component.toggleRightSidebar, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button[mat-icon-button]');

    buttons[0]?.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should not render pin assign when right nav is closed', () => {
    fixture.componentRef.setInput('rightNavOpen', false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('choh-pin-assign'),
    ).toBeNull();
  });

  it('should set tooltip on panel toggle based on open state', () => {
    const contentButton = fixture.debugElement.query(
      By.css('button[aria-label="ピン配置"]'),
    );
    expect(contentButton).not.toBeNull();
    expect(contentButton.injector.get(MatTooltip).message).toBe('ピン配置');

    const openButton = fixture.debugElement.query(
      By.css('button[aria-label="ピン配置を閉じる"]'),
    );
    expect(openButton).not.toBeNull();
    expect(openButton.injector.get(MatTooltip).message).toBe('ピン配置を閉じる');
    expect(openButton.attributes['aria-expanded']).toBe('true');

    fixture.componentRef.setInput('rightNavOpen', false);
    fixture.detectChanges();

    const closedButton = fixture.debugElement.query(
      By.css('button[aria-label="ピン配置を開く"]'),
    );
    expect(closedButton).not.toBeNull();
    expect(closedButton.injector.get(MatTooltip).message).toBe('ピン配置を開く');
    expect(closedButton.attributes['aria-expanded']).toBe('false');
  });

  it('emits paneResizeBy on separator arrow keys', () => {
    const emitSpy = vi.spyOn(component.paneResizeBy, 'emit');
    const separator = fixture.nativeElement.querySelector(
      '[role="separator"]',
    ) as HTMLElement;
    expect(separator).not.toBeNull();

    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    separator.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(emitSpy).toHaveBeenCalledWith(16);
    expect(emitSpy).toHaveBeenCalledWith(-16);
  });
});
