import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProgressDialogComponent,
  ProgressDialogData,
} from './progress-dialog.component';

describe('ProgressDialogComponent', () => {
  let fixture: ComponentFixture<ProgressDialogComponent>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();
    const progress = signal(12);
    const data: ProgressDialogData = {
      message: 'Saving…',
      progress,
      cancelLabel: 'Stop',
    };

    await TestBed.configureTestingModule({
      imports: [ProgressDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: { close } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProgressDialogComponent);
    fixture.detectChanges();
  });

  it('shows message and live progress from dialog data', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Saving…');
    expect(el.textContent).toContain('Progress: 12%');

    const data = TestBed.inject(DIALOG_DATA) as ProgressDialogData;
    (data.progress as ReturnType<typeof signal<number>>).set(55);
    fixture.detectChanges();
    expect(el.textContent).toContain('Progress: 55%');
  });

  it('closes with cancelled when cancel is clicked', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );
    expect(button?.textContent?.trim()).toBe('Stop');
    button?.dispatchEvent(new MouseEvent('click'));
    expect(close).toHaveBeenCalledWith('cancelled');
  });
});
