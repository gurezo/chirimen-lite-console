import { describe, expect, it, vi } from 'vitest';
import { SerialExpectedDisconnectService } from './serial-expected-disconnect.service';
import { SerialNotificationService } from './serial-notification.service';

describe('SerialNotificationService', () => {
  it('notifyManualDisconnect shows info toast', () => {
    const info = vi.fn();
    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (service as unknown as { toastr: { info: typeof info } }).toastr = {
      info,
    };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = new SerialExpectedDisconnectService();

    service.notifyManualDisconnect();

    expect(info).toHaveBeenCalledWith(
      'CHIRIMEN Lite との接続が切断されました。未保存の変更は Editor または Draft に保持されています。',
      '切断',
      { timeOut: 5000 },
    );
  });

  it('notifyUnexpectedDisconnect shows warning toast', () => {
    const warning = vi.fn();
    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { warning: typeof warning } }
    ).toastr = { warning };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = new SerialExpectedDisconnectService();

    service.notifyUnexpectedDisconnect();

    expect(warning).toHaveBeenCalledWith(
      'CHIRIMEN Lite との接続が切断されました。未保存の変更は Editor または Draft に保持されています。',
      '切断',
      { timeOut: 6000 },
    );
  });

  it('notifyUnexpectedDisconnect is suppressed during expected disconnect', () => {
    const warning = vi.fn();
    const expectedDisconnect = new SerialExpectedDisconnectService();
    expectedDisconnect.beginExpectedDisconnect('reboot');

    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { warning: typeof warning } }
    ).toastr = { warning };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = expectedDisconnect;

    service.notifyUnexpectedDisconnect();

    expect(warning).not.toHaveBeenCalled();
  });

  it('notifyAutoLoginFailed shows error toast with message', () => {
    const error = vi.fn();
    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { error: typeof error } }
    ).toastr = { error };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = new SerialExpectedDisconnectService();

    service.notifyAutoLoginFailed('Shell readiness timeout');

    expect(error).toHaveBeenCalledWith(
      'オートログインに失敗しました: Shell readiness timeout',
      'ログインエラー',
      { timeOut: 8000 },
    );
  });

  it('notifyConnectionError is suppressed during expected disconnect', () => {
    const error = vi.fn();
    const expectedDisconnect = new SerialExpectedDisconnectService();
    expectedDisconnect.beginExpectedDisconnect('reboot');

    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { error: typeof error } }
    ).toastr = { error };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = expectedDisconnect;

    service.notifyConnectionError('port closed');

    expect(error).not.toHaveBeenCalled();
  });

  it('notifyConnectionError shows toast when disconnect is not expected', () => {
    const error = vi.fn();
    const service = Object.create(
      SerialNotificationService.prototype,
    ) as SerialNotificationService;
    (
      service as unknown as { toastr: { error: typeof error } }
    ).toastr = { error };
    (
      service as unknown as {
        expectedDisconnect: SerialExpectedDisconnectService;
      }
    ).expectedDisconnect = new SerialExpectedDisconnectService();

    service.notifyConnectionError('port busy');

    expect(error).toHaveBeenCalledWith(
      'Web Serial接続エラー: port busy',
      '接続エラー',
      { timeOut: 5000 },
    );
  });
});
