import { describe, expect, it } from 'vitest';
import { TerminalCommandRequestService } from './terminal-command-request.service';

describe('TerminalCommandRequestService', () => {
  it('updates commandRequest signal on requestCommand', () => {
    const svc = new TerminalCommandRequestService();
    svc.requestCommand('i2cdetect -y 1');
    expect(svc.commandRequest()).toBe('i2cdetect -y 1');
    expect(svc.requestId()).toBe(1);
  });

  it('increments requestId for repeated requests including identical commands', () => {
    const svc = new TerminalCommandRequestService();
    svc.requestCommand('ls');
    svc.requestCommand('ls');
    expect(svc.requestId()).toBe(2);
  });
});
