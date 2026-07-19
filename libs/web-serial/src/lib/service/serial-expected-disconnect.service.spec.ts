import { describe, expect, it } from 'vitest';
import { SerialExpectedDisconnectService } from './serial-expected-disconnect.service';

describe('SerialExpectedDisconnectService', () => {
  it('beginExpectedDisconnect sets reason and isExpectedDisconnect', () => {
    const service = new SerialExpectedDisconnectService();

    expect(service.isExpectedDisconnect()).toBe(false);
    expect(service.reason()).toBeNull();

    service.beginExpectedDisconnect('reboot');

    expect(service.isExpectedDisconnect()).toBe(true);
    expect(service.isExpectedDisconnect('reboot')).toBe(true);
    expect(service.reason()).toBe('reboot');
  });

  it('clearExpectedDisconnect clears the flag', () => {
    const service = new SerialExpectedDisconnectService();
    service.beginExpectedDisconnect('reboot');
    service.clearExpectedDisconnect();

    expect(service.isExpectedDisconnect()).toBe(false);
    expect(service.reason()).toBeNull();
  });
});
