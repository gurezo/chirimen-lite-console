/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const toastrMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: ToastrService, useValue: toastrMock },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    void TestBed.resetTestingModule();
  });

  it('shows error toasts', () => {
    const service = TestBed.inject(NotificationService);
    service.error('保存失敗', 'デバイスへの保存に失敗しました');
    expect(toastrMock.error).toHaveBeenCalledWith(
      'デバイスへの保存に失敗しました',
      '保存失敗',
    );
  });

  it('dedupes consecutive identical notifications within the window', () => {
    const service = TestBed.inject(NotificationService);
    service.error('読込失敗', 'same');
    service.error('読込失敗', 'same');
    expect(toastrMock.error).toHaveBeenCalledTimes(1);
  });

  it('allows the same notification after the dedupe window', () => {
    const service = TestBed.inject(NotificationService);
    service.error('読込失敗', 'same');
    vi.advanceTimersByTime(2600);
    service.error('読込失敗', 'same');
    expect(toastrMock.error).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe different severities or messages', () => {
    const service = TestBed.inject(NotificationService);
    service.error('読込失敗', 'a');
    service.warning('読込失敗', 'a');
    service.error('読込失敗', 'b');
    expect(toastrMock.error).toHaveBeenCalledTimes(2);
    expect(toastrMock.warning).toHaveBeenCalledTimes(1);
  });
});
