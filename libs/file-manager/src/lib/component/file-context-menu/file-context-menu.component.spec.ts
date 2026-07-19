/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileContextMenuComponent } from './file-context-menu.component';

describe('FileContextMenuComponent', () => {
  let fixture: ComponentFixture<FileContextMenuComponent>;

  async function openMenu(): Promise<void> {
    fixture.componentInstance.openAt(8, 16);
    await fixture.whenStable();
    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(document.querySelector('.mat-mdc-menu-panel')).toBeTruthy();
    });
  }

  function menuLabels(): string[] {
    return Array.from(
      document.querySelectorAll('.mat-mdc-menu-panel button[mat-menu-item]'),
    ).map((el) => (el as HTMLElement).textContent?.trim() ?? '');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileContextMenuComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(FileContextMenuComponent);
  });

  it('shows directory-only actions for directories', async () => {
    fixture.componentRef.setInput('target', {
      name: 'docs',
      path: './docs',
      isDirectory: true,
    });
    fixture.detectChanges();
    await openMenu();

    expect(menuLabels()).toEqual([
      '新規ファイル',
      '新規ディレクトリ',
      '名前変更',
      '削除',
      '再読み込み',
    ]);
  });

  it('hides create actions for files', async () => {
    fixture.componentRef.setInput('target', {
      name: 'main.ts',
      path: './main.ts',
      isDirectory: false,
    });
    fixture.detectChanges();
    await openMenu();

    expect(menuLabels()).toEqual(['名前変更', '削除', '再読み込み']);
  });

  it('emits menuAction when an item is selected', () => {
    fixture.componentRef.setInput('target', {
      name: 'main.ts',
      path: './main.ts',
      isDirectory: false,
    });
    fixture.detectChanges();

    const spy = vi.spyOn(fixture.componentInstance.menuAction, 'emit');
    fixture.componentInstance.onSelect('rename');
    expect(spy).toHaveBeenCalledWith('rename');
  });

  it('does not emit when disabled', () => {
    fixture.componentRef.setInput('target', {
      name: 'main.ts',
      path: './main.ts',
      isDirectory: false,
    });
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const spy = vi.spyOn(fixture.componentInstance.menuAction, 'emit');
    fixture.componentInstance.onSelect('delete');
    expect(spy).not.toHaveBeenCalled();
  });
});
