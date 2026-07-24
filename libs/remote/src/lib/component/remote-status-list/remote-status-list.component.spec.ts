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

  it('shows loading status while fetching', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector(
      '[role="status"]',
    ) as HTMLElement;
    expect(status.textContent).toContain('取得中');
  });

  it('shows error and emits retry', () => {
    fixture.componentRef.setInput('error', 'list failed');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector(
      '[role="alert"]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('list failed');

    const spy = vi.fn();
    component.retry.subscribe(spy);
    const retryBtn = fixture.nativeElement.querySelector(
      'choh-button button',
    ) as HTMLButtonElement;
    retryBtn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('shows unfetched empty message before first successful fetch', () => {
    fixture.componentRef.setInput('fetched', false);
    fixture.componentRef.setInput('processes', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      '「更新」で一覧を取得してください。',
    );
  });

  it('shows empty message after successful fetch with no processes', () => {
    fixture.componentRef.setInput('fetched', true);
    fixture.componentRef.setInput('processes', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'プロセスがありません。',
    );
  });
});
