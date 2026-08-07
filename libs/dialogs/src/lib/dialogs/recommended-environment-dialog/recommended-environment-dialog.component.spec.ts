import { DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendedEnvironmentDialogComponent } from './recommended-environment-dialog.component';

describe('RecommendedEnvironmentDialogComponent', () => {
  let fixture: ComponentFixture<RecommendedEnvironmentDialogComponent>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    close = vi.fn();

    await TestBed.configureTestingModule({
      imports: [RecommendedEnvironmentDialogComponent],
      providers: [{ provide: DialogRef, useValue: { close } }],
    }).compileComponents();

    fixture = TestBed.createComponent(RecommendedEnvironmentDialogComponent);
    fixture.detectChanges();
  });

  it('shows recommended hardware and software with release link', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('推奨環境');
    expect(el.textContent).toContain('Raspberry Pi Zero 2 W');
    expect(el.textContent).toContain('chirimen-lite v2.0.0');

    const link = el.querySelector('a');
    expect(link?.getAttribute('href')).toBe(
      'https://github.com/chirimen-oh/chirimen-lite/releases/tag/v2.0.0',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('closes when close button is clicked', () => {
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );
    expect(button?.textContent?.trim()).toBe('閉じる');
    button?.dispatchEvent(new MouseEvent('click'));
    expect(close).toHaveBeenCalled();
  });
});
