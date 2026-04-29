/**
 * シリアルコンソール上の制御系列を弱めに除去（プロンプト照合用）。
 * RPi 起動直後の clear screen や色コードが `login:` 行の前に来ても正規表現に通す。
 */
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

/** 正規表現リテラルに制御文字を入れない（no-control-regex 回避） */
const CSI_SEQ = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const OSC_SEQ = new RegExp(`${ESC}\\][^${BEL}]*${BEL}`, 'g');

export function stripSerialAnsiForPrompt(s: string): string {
  return s.replace(CSI_SEQ, '').replace(OSC_SEQ, '');
}

/**
 * 1 論理行（`\\n` で区切る）のうち、`\\r` による TTY 重ね描きの最後に見えていたテキストだけ残す。
 */
function lineAfterLastCarriageReturn(line: string): string {
  const segments = line.split(/\r/);
  const n = segments.length;
  if (n === 1) {
    return line;
  }
  const last = segments[n - 1] ?? '';
  if (last.length > 0) {
    return last;
  }
  if (n >= 2) {
    return segments[n - 2] ?? '';
  }
  return '';
}

/**
 * `\\r\\n` を `\\n` にし、各論理行で `\\r` の重ね描きを「最終セグメント」に収束させる。
 * 直後に `\\r` をすべて `\\n` へ置換すると、列揃え用の断片が複数行になって xterm で階段状に見える。
 *
 * シリアルの exec 受信バッファ（プロンプト照合）と xterm 表示用サニタイズで共通化する。
 */
export function collapseCarriageRedrawsPerLine(text: string): string {
  const normalizedCrlf = text.replace(/\r\n/g, '\n');
  const lines = normalizedCrlf.split('\n').map(lineAfterLastCarriageReturn);
  return lines.join('\n').replace(/\r/g, '\n');
}
