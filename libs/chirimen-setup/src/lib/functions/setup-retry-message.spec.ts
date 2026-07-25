import { describe, expect, it } from 'vitest';
import { buildSetupRetryMessage } from './setup-retry-message';
import type { SetupStepProgress } from '../models';

describe('buildSetupRetryMessage', () => {
  it('includes failed step label and retry steps', () => {
    const failed: SetupStepProgress = {
      stepIndex: 2,
      stepTotal: 10,
      phase: 'node',
      label: 'Node.js を展開',
      command: 'sudo tar ...',
      stdout: '',
      status: 'failed',
      errorMessage: 'timeout',
    };
    const msg = buildSetupRetryMessage(failed);
    expect(msg).toContain('Node.js を展開');
    expect(msg).toContain('3/10');
    expect(msg).toContain('timeout');
    expect(msg).toContain('再試行手順');
  });
});
