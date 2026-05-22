import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForeverProcess } from '@libs-shared';
import { RemoteStatusListComponent } from './remote-status-list.component';

describe('RemoteStatusListComponent', () => {
  let component: RemoteStatusListComponent;
  let fixture: ComponentFixture<RemoteStatusListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RemoteStatusListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RemoteStatusListComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('processes', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits rowSelected when a row is clicked', () => {
    const proc: ForeverProcess = {
      listIndex: 0,
      uid: 'u',
      command: 'node',
      script: '/p.js',
      running: true,
    };
    fixture.componentRef.setInput('processes', [proc]);
    fixture.detectChanges();

    const spy = vi.fn();
    component.rowSelected.subscribe(spy);

    const btn = fixture.nativeElement.querySelector(
      'button[role="listitem"]',
    ) as HTMLButtonElement;
    btn.click();

    expect(spy).toHaveBeenCalledWith(proc);
  });
});
