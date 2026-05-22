import { describe, expect, it } from 'vitest';
import { EXTRA_SETUP_STEP_COUNT } from '../constants/setup.constants';
import { buildNodeInstallStepList } from './node-install.steps';

const sampleUrl =
  'https://unofficial-builds.nodejs.org/download/release/v20.18.1/node-v20.18.1-linux-armv6l.tar.xz';

describe('Setup pipeline step totals', () => {
  it('matches extra + node + post (forever stopall)', () => {
    const nodeSteps = buildNodeInstallStepList({ nodeTarUrl: sampleUrl }).length;
    const total = EXTRA_SETUP_STEP_COUNT + nodeSteps + 1;
    expect(EXTRA_SETUP_STEP_COUNT).toBe(1);
    expect(nodeSteps).toBe(17);
    expect(total).toBe(19);
  });

  it('includes optional project subdir in total', () => {
    const nodeSteps = buildNodeInstallStepList({
      nodeTarUrl: sampleUrl,
      projectSubdir: 'pizero',
    }).length;
    expect(EXTRA_SETUP_STEP_COUNT + nodeSteps + 1).toBe(21);
  });
});
