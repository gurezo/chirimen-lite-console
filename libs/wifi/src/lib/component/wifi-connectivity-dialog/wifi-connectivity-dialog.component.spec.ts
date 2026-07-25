import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WifiConnectivityDialogComponent } from './wifi-connectivity-dialog.component';

describe('WifiConnectivityDialogComponent', () => {
  let fixture: ComponentFixture<WifiConnectivityDialogComponent>;
  const close = vi.fn();

  async function setup(status: 'ok' | 'ng', detail: string): Promise<void> {
    TestBed.resetTestingModule();
    close.mockClear();
    await TestBed.configureTestingModule({
      imports: [WifiConnectivityDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close } },
        {
          provide: DIALOG_DATA,
          useValue: { status, detail },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiConnectivityDialogComponent);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await setup('ok', '200 OK');
  });

  it('shows OK badge when status is ok', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('OK');
    expect(text).toContain('200 OK');
    expect(text).toContain('疎通確認（tutorial.chirimen.org）');
  });

  it('shows NG badge when status is ng', async () => {
    await setup('ng', 'unable to resolve host');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('NG');
    expect(text).toContain('unable to resolve host');
  });

  it('closes dialog when close is clicked', () => {
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalled();
  });
});
