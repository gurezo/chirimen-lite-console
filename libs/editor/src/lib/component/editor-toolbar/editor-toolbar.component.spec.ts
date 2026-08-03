/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorToolbarComponent } from './editor-toolbar.component';

describe('EditorToolbarComponent', () => {
  let component: EditorToolbarComponent;
  let fixture: ComponentFixture<EditorToolbarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const buttons = (): NodeListOf<HTMLButtonElement> =>
    fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit saveRequested when save button is clicked', () => {
    const emitSpy = vi.spyOn(component.saveRequested, 'emit');

    buttons()[0].click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit formatRequested when format button is clicked', async () => {
    fixture.componentRef.setInput('formatDisabled', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitSpy = vi.spyOn(component.formatRequested, 'emit');

    buttons()[1].click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should emit discardRequested when discard button is clicked', async () => {
    fixture.componentRef.setInput('discardDisabled', false);
    fixture.detectChanges();
    await fixture.whenStable();

    const emitSpy = vi.spyOn(component.discardRequested, 'emit');

    buttons()[2].click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('should disable save button when saveDisabled is true', async () => {
    fixture.componentRef.setInput('saveDisabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(buttons()[0].disabled).toBe(true);
  });

  it('should disable format button when formatDisabled is true', async () => {
    fixture.componentRef.setInput('formatDisabled', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(buttons()[1].disabled).toBe(true);
  });

  it('should set aria-label from tooltips', () => {
    const [save, format, discard] = Array.from(buttons());

    expect(save.getAttribute('aria-label')).toBe(component.saveTooltip());
    expect(format.getAttribute('aria-label')).toBe(component.formatTooltip());
    expect(discard.getAttribute('aria-label')).toBe(component.discardTooltip);
  });

  it('should show a spinner while saving', async () => {
    fixture.componentRef.setInput('isSaving', true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('mat-progress-spinner'),
    ).toBeTruthy();
  });
});
