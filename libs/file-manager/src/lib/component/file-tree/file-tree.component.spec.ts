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
});
