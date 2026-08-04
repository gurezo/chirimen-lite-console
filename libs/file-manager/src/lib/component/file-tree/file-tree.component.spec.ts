/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileTreeNode } from '../../models';
import { FileTreeComponent } from './file-tree.component';

describe('FileTreeComponent', () => {
  let fixture: ComponentFixture<FileTreeComponent>;
  const nodes: FileTreeNode[] = [
    { name: 'docs', path: './docs', isDirectory: true },
    { name: 'main.ts', path: './main.ts', isDirectory: false },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTreeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileTreeComponent);
    fixture.componentRef.setInput('nodes', nodes);
    fixture.detectChanges();
  });

  it('emits nodeContextMenu on right click', () => {
    const spy = vi.spyOn(fixture.componentInstance.nodeContextMenu, 'emit');
    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 12,
      clientY: 34,
    });
    button.dispatchEvent(event);

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0]?.[0];
    expect(payload?.node).toEqual(nodes[0]);
    expect(payload?.event.clientX).toBe(12);
    expect(event.defaultPrevented).toBe(true);
  });

  it('highlights the selected file path', () => {
    fixture.componentRef.setInput('selectedPath', './main.ts');
    fixture.detectChanges();

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button');
    const fileButton = buttons[1];

    expect(fileButton?.getAttribute('aria-current')).toBe('true');
    expect(fileButton?.classList.contains('bg-blue-50')).toBe(true);
    expect(buttons[0]?.getAttribute('aria-current')).toBeNull();
  });

  it('moves focus with ArrowDown and ArrowUp', () => {
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button');
    buttons[0]?.focus();
    expect(document.activeElement).toBe(buttons[0]);

    buttons[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[1]);

    buttons[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('moves focus to first and last with Home and End', () => {
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button');
    buttons[0]?.focus();

    buttons[0]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[1]);

    buttons[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('emits fileSelected when Enter activates a file button', () => {
    const spy = vi.spyOn(fixture.componentInstance.fileSelected, 'emit');
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('button');

    buttons[1]?.click();

    expect(spy).toHaveBeenCalledWith(nodes[1]);
  });
});
