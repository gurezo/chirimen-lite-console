import { describe, expect, it } from 'vitest';
import { TerminalCommandRequestService } from './terminal-command-request.service';

describe('TerminalCommandRequestService', () => {
  it('emits requested commands to subscribers', () => {
    const svc = new TerminalCommandRequestService();
    const seen: string[] = [];
    const sub = svc.commandRequests$.subscribe((c) => seen.push(c));
    svc.requestCommand('i2cdetect -y 1');
    expect(seen).toEqual(['i2cdetect -y 1']);
    sub.unsubscribe();
  });
});
