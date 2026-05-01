import { stripSerialAnsiForPrompt } from '@libs-web-serial-util';

/**
 * {@link stripSerialAnsiForPrompt} で落ちない端末制御（カーソル退避・文字集合・逆改行）を除く。
 * `ls` が TTY 幅相当で出す列揃えに伴う残りが xterm で階段状に見えるのを抑える。
 */
/** シリアルが \\t で列を揃えていると xterm とズレやすい。表示用に空白へ展開する。 */
function expandTabsToSpaces(s: string, tabWidth = 8): string {
  return s
    .split('\n')
    .map((line) => {
      let out = '';
      let col = 0;
      for (const ch of line) {
        if (ch === '\t') {
          const n = tabWidth - (col % tabWidth);
          const pad = n === 0 ? tabWidth : n;
          out += ' '.repeat(pad);
          col += pad;
        } else if (ch === '\r' || ch === '\n') {
          out += ch;
          col = 0;
        } else {
          out += ch;
          col += 1;
        }
      }
      return out;
    })
    .join('\n');
}

function stripResidualTerminalEscapes(s: string): string {
  const esc = String.fromCharCode(0x1b);
  /** no-control-regex: リテラルに \\x1b を載せず文字コードで組む */
  return s
    .replace(new RegExp(`${esc}7|${esc}8`, 'g'), '') // DECSC / DECRC
    .replace(new RegExp(`${esc}M`, 'g'), '\n') // reverse line feed
    .replace(new RegExp(`${esc}\\([\\x20-\\x7e]`, 'g'), '') // SCS G0/G1 (1 char)
    .replace(new RegExp(`${esc}\\)[\\x20-\\x7e]`, 'g'), ''); // SCS 同上 )
}

/** ライブ表示の \\r 再描画は {@link SerialSession#terminalText$} に委譲。ここでは ANSI 除去と lone \\r の除去のみ。 */
function stripForTerminalDisplay(s: string): string {
  let t = s.replace(/\r\n/g, '\n');
  t = stripSerialAnsiForPrompt(t);
  t = stripResidualTerminalEscapes(t);
  return t.replace(/\r/g, '');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * UART の lines$ が送信行を複数チャンクにすると、送信テキストと完全一致しないことがある。
 * トークン間を `\s+`（改行含む）でマッチし、ヒットぶんだけ送受信側で使う削除幅にする。
 */
function buildFlexibleWhitespaceCommandRegex(command: string): RegExp | null {
  const cmd = command.trim();
  if (!cmd.length) {
    return null;
  }
  const tokens = cmd.split(/\s+/).filter(Boolean);
  try {
    return new RegExp(tokens.map(escapeRegex).join('\\s+'));
  } catch {
    return null;
  }
}

/**
 * 完全一致でなければ、トークン間を `\s+` で繋ぐパターンの先頭にマッチした部分までを削除し、残りを stdout として残す。
 */
function stripThroughSentCommand(out: string, command: string): string {
  const cmd = command.trim();
  if (!cmd.length) {
    return out;
  }

  const exact = out.indexOf(cmd);
  if (exact >= 0) {
    return out.slice(exact + cmd.length);
  }

  const flex = buildFlexibleWhitespaceCommandRegex(cmd);
  if (!flex) {
    return out;
  }
  const m = flex.exec(out);
  if (!m?.[0]?.length || m.index === undefined) {
    return out;
  }

  return out.slice(m.index + m[0].length);
}

/**
 * TTY が \\r で同一行上に積み増した「階段」とき、行頭に大量の空白が残る。
 * `ls -l` らしい行のみ先頭空白を落とし表示を整える（pwd 等はヒットしない）。
 */
function dedentProbableLsLongListingLines(s: string): string {
  const lsLongish =
    /^(合計|total)\b|^[-bcdlps][-rwxsStT?.+]{9,}\s+[0-9,]+/u;
  return s
    .split('\n')
    .map((line) => {
      const t = line.trimStart();
      if (t.length === 0) {
        return line;
      }
      return lsLongish.test(t) ? t : line;
    })
    .join('\n');
}

/**
 * 送信列のエコーが複数行に分かれていても {@link stripThroughSentCommand} で削る。
 * 先頭に同じエコーが残る場合は繰り返し適用する。
 */
function stripRepeatedLeadingCommandEchoLines(
  out: string,
  command: string,
): string {
  if (!command.trim()) {
    return out;
  }

  let s = out;
  for (let i = 0; i < 8; i++) {
    const next = stripThroughSentCommand(s, command);
    if (next === s) {
      break;
    }
    s = next.replace(/^[\r\n]+/, '');
  }

  return s;
}

/**
 * Strip echoed command and trailing remote prompt from serial exec capture.
 * 論理行内の TTY `\\r` 再描画の収束はライブラリの `terminalText$` に任せ、本関数は echo / prompt / ANSI のみ扱う（issue #601）。
 */
export function sanitizeSerialStdout(
  stdout: string,
  command: string,
  prompt: string,
): string {
  let out = stripForTerminalDisplay(stdout);

  out = stripThroughSentCommand(out, command);

  const promptIdx = out.lastIndexOf(prompt);
  if (promptIdx >= 0) {
    out = out.slice(0, promptIdx);
  }

  out = stripRepeatedLeadingCommandEchoLines(out, command);

  out = stripSerialAnsiForPrompt(out);
  out = stripResidualTerminalEscapes(out);
  out = expandTabsToSpaces(out);
  out = dedentProbableLsLongListingLines(out);

  return out
    .replace(/^[\r\n]+/, '')
    .replace(/[\r\n]+$/, '')
    .replace(/\r/g, '');
}
