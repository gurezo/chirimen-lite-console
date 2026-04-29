/**
 * シリアル経由の擬似 TTY では `ls` が \\r / \\t / 端末幅で列を再描画し、xterm に階段状に見える。
 * `LC_ALL` / `TERM=dumb` に加え、`2>&1 | cat` で疑似 TTY 出力を避ける（列揃え・\\r 再描画が消えやすい）。
 */
function wrapLsForSerial(innerLsCommand: string): string {
  const env = 'LC_ALL=C LANG=C TERM=dumb LS_COLORS= ';
  return `${env}${innerLsCommand} 2>&1 | cat`;
}

export function coerceLsForSerialListing(cmd: string): string {
  const t = cmd.trim();
  if (!/^ls\b/i.test(t)) {
    return cmd;
  }

  let rest = t.replace(/^ls\s*/i, '');
  if (/^--format(=single-column|\s+)/i.test(rest)) {
    return wrapLsForSerial(t);
  }

  /** 既に `-1` が付いた形（単独フラグまたは `-1lah` などクラスタ） */
  if (rest.startsWith('-1')) {
    return wrapLsForSerial(t);
  }

  rest = rest.length > 0 ? `-1 ${rest}` : '-1';
  return wrapLsForSerial(`ls ${rest}`);
}
