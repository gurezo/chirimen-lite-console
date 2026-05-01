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
