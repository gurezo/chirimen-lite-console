import { describe, expect, it } from 'vitest';
import { buildNodeInstallStepList } from './node-install.steps';

const sampleUrl =
  'https://unofficial-builds.nodejs.org/download/release/v20.18.1/node-v20.18.1-linux-armv6l.tar.xz';

describe('buildNodeInstallStepList', () => {
  it('builds steps without project subdir', () => {
    const steps = buildNodeInstallStepList({ nodeTarUrl: sampleUrl });
    expect(steps.length).toBe(17);
    expect(steps[0]?.command).toBe('node -v || true');
    expect(steps.some((s) => s.command.includes('wget') && s.command.includes(sampleUrl))).toBe(
      true,
    );
  });

  it('inserts mkdir/cd for project subdir', () => {
    const steps = buildNodeInstallStepList({
      nodeTarUrl: sampleUrl,
      projectSubdir: 'pizero',
    });
    expect(steps.length).toBe(19);
    expect(steps.some((s) => s.command === 'mkdir -p pizero')).toBe(true);
    expect(steps.some((s) => s.command === 'cd pizero')).toBe(true);
  });
});
