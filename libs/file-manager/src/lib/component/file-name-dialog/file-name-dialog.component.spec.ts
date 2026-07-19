/// <reference types="vitest/globals" />
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileNameDialogComponent } from './file-name-dialog.component';

describe('FileNameDialogComponent', () => {
  let component: FileNameDialogComponent;
  let fixture: ComponentFixture<FileNameDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [FileNameDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        {
          provide: DIALOG_DATA,
          useValue: {
            title: '新規ファイル',
            initialValue: 'draft.txt',
            confirmLabel: '作成',
            label: 'ファイル名',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FileNameDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with dialog data', () => {
    expect(component.title).toBe('新規ファイル');
    expect(component.name).toBe('draft.txt');
    expect(component.confirmLabel).toBe('作成');
    expect(component.label).toBe('ファイル名');
  });

  it('closes with null on cancel', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('closes with trimmed name on valid submit', () => {
    component.name = '  hello.ts  ';
    component.submit();
    expect(dialogRef.close).toHaveBeenCalledWith('hello.ts');
    expect(component.validationError()).toBeNull();
  });

  it('does not close when name is invalid', () => {
    component.name = '../secret';
    component.submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.validationError()).toBeTruthy();
  });
});
