import { describe, expect, it, vi } from 'vitest';
import { SerialNotificationService } from './serial-notification.service';

describe('SerialNotificationService', () => {
  it('notifyAutoLoginFailed shows error toast with message', () => {
    const error = vi.fn();
    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { error: typeof error } }
    ).toastr = { error };

    service.notifyAutoLoginFailed('Shell readiness timeout');

    expect(error).toHaveBeenCalledWith(
      'オートログインに失敗しました: Shell readiness timeout',
      'ログインエラー',
      { timeOut: 8000 },
    );
  });
});
