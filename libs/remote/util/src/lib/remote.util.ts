import type { ForeverProcess } from '@libs-shared';

function stripAnsi(text: string): string {
  const esc = String.fromCharCode(0x1b);
  return text.replace(new RegExp(`${esc}\\[[0-9;]*m`, 'g'), '');
}

export function formatRemoteStatus(output: string): string {
  // forever list --plain の出力を、行単位で整形して返します。
  // 具体的なフォーマットは環境依存のため、ここでは概略整形のみ行います。
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * Parses `forever list` / `forever list --plain` tabular stdout (cliff format).
 * Column order defaults to: uid, command, script, forever, pid, logfile, uptime.
 */
export function parseForeverListPlain(stdout: string): ForeverProcess[] {
  if (!stdout?.trim()) {
    return [];
  }
  const normalized = stripAnsi(stdout);
  if (/\bNo forever processes running\b/i.test(normalized)) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ForeverProcess[] = [];

  for (const line of lines) {
    if (!line.startsWith('[')) {
      continue;
    }
    const m = line.match(/^\[(\d+)\]\s*(.+)$/);
    if (!m) {
      continue;
    }
    const listIndex = Number.parseInt(m[1], 10);
    const rest = m[2].trim();
    const cols = rest
      .split(/\s{2,}/)
      .map((c) => c.trim())
      .filter(Boolean);

    if (cols.length < 3) {
      continue;
    }

    const uid = cols[0];
    const command = cols[1];
    const script = cols[2];
    const foreverPid = cols[3];
    const pid = cols[4];
    const logFile = cols[5];
    const uptime = cols.slice(6).join('  ') || undefined;
    const running = !/\bSTOPPED\b/i.test(rest);

    out.push({
      listIndex,
      uid,
      command,
      script,
      foreverPid,
      pid,
      logFile,
      uptime,
      running,
    });
  }

  return out;
}
