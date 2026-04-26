/**
 * シリアルコンソール上の制御系列を弱めに除去（プロンプト照合用）。
 * RPi 起動直後の clear screen や色コードが `login:` 行の前に来ても正規表現に通す。
 */
export function stripSerialAnsiForPrompt(s: string): string {
  return s
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\u001b\][^\u0007]*\u0007/g, '');
}
