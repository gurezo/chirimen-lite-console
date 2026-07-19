/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ActionToolBarComponent } from './action-tool-bar.component';

describe('ActionToolBarComponent', () => {
  let component: ActionToolBarComponent;
  let fixture: ComponentFixture<ActionToolBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionToolBarComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionToolBarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('connected', false);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render toolbar action buttons when disconnected', () => {
    expect(
      fixture.nativeElement.querySelector('button[aria-label="エディター"]'),
    ).toBeNull();
  });

  it('should emit toolbarAction when action icon is clicked', () => {
    fixture.componentRef.setInput('connected', true);
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.toolbarAction, 'emit');
    const editorButton: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('button[aria-label="エディター"]');

    editorButton?.click();

    expect(emitSpy).toHaveBeenCalledWith('editor');
  });

  it('should set tooltip and aria-label on action buttons when connected', () => {
    fixture.componentRef.setInput('connected', true);
    fixture.detectChanges();

    const editorButton = fixture.debugElement.query(
      By.css('button[aria-label="エディター"]'),
    );
    expect(editorButton).not.toBeNull();

    const tooltip = editorButton.injector.get(MatTooltip);
    expect(tooltip.message).toBe('エディター');
  });
});
