import {
  collapseCarriageRedrawsPerLine,
  stripSerialAnsiForPrompt,
} from '@libs-web-serial-util';

/**
 * シリアル由来の stdout をブラウザ xterm で表示できるよう CR/LF を揃える。
 * lone \\r が混ぜると xterm が行頭に戻して階段状ずれになりやすい（Web Serial でよく見る）。
 *
 * 実装は {@link collapseCarriageRedrawsPerLine}（シリアル受信バッファのプロンプト照合でも同じ）。
 */
export function normalizeSerialNewlines(stdout: string): string {
  return collapseCarriageRedrawsPerLine(stdout);
}

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

function stripForTerminalDisplay(s: string): string {
  /** \\r\\n のみ先に正規化。\\r 単体の解釈は ANSI 除去の後に {@link normalizeSerialNewlines} で行う */
  let t = s.replace(/\r\n/g, '\n');
  t = stripSerialAnsiForPrompt(t);
  t = stripResidualTerminalEscapes(t);
  return normalizeSerialNewlines(t);
}

/**
 * [example-angular][ex] と同様、ANSI 後に論理行内 `\\r` を「見えていた最終セグメント」へ収束させ（{@link normalizeSerialNewlines}
 * と同等）、送信列の並びだけは `sanitizeSerialStdout(..., default)` と異なる細部に留める用途向け。
 *
 * [ex]: https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular
 */
function stripForLineStreamMirrorDisplay(s: string): string {
  let t = s.replace(/\r\n/g, '\n');
  t = stripSerialAnsiForPrompt(t);
  t = stripResidualTerminalEscapes(t);
  return collapseCarriageRedrawsPerLine(t);
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
  /**
   * total／合計、または GNU ls -l の mode＋リンク数付近。
   * mode は ACL/+ 等で 10 桁超になることがあり、過去の {9} 固定では段状空白の行が落ちなかった。
   */
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
 * `'lineStreamMirrored'` はタブラ・ls dedent 等を省略し軽量化する対話コンソール向け。
 * 論理行内の `\\r` は {@link normalizeSerialNewlines} で収束する（シリアル exec のバッファ正規化でも同関数を使う）。
 *
 * Strip echoed command and trailing remote prompt from serial exec capture.
 */
export type SanitizeSerialStdoutVariant =
  /** タブラ・強 dedent を含む従来表示用 */
  | 'default'
  /** タブラ／dedent を省く軽めのパス（`\\r` 収束は default と共通） */
  | 'lineStreamMirrored';

export function sanitizeSerialStdout(
  stdout: string,
  command: string,
  prompt: string,
  variant?: SanitizeSerialStdoutVariant,
): string {
  const mode = variant ?? 'default';

  if (mode === 'lineStreamMirrored') {
    let out = stripForLineStreamMirrorDisplay(stdout);

    out = stripThroughSentCommand(out, command);

    const promptIdx = out.lastIndexOf(prompt);
    if (promptIdx >= 0) {
      out = out.slice(0, promptIdx);
    }

    out = stripRepeatedLeadingCommandEchoLines(out, command);

    return out
      .replace(/^[\r\n]+/, '')
      .replace(/[\r\n]+$/, '')
      .replace(/\r/g, '');
  }

  let out = stripForTerminalDisplay(stdout);

  out = stripThroughSentCommand(out, command);

  const promptIdx = out.lastIndexOf(prompt);
  if (promptIdx >= 0) {
    out = out.slice(0, promptIdx);
  }

  out = stripRepeatedLeadingCommandEchoLines(out, command);

  out = normalizeSerialNewlines(out);
  out = stripSerialAnsiForPrompt(out);
  out = stripResidualTerminalEscapes(out);
  out = normalizeSerialNewlines(out);
  out = expandTabsToSpaces(out);
  out = dedentProbableLsLongListingLines(out);

  return out
    .replace(/^[\r\n]+/, '')
    .replace(/[\r\n]+$/, '')
    .replace(/\r/g, '');
}
