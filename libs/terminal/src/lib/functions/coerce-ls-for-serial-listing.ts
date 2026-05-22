/**
 * シリアル経由の擬似 TTY では `ls` が \\r / \\t / 端末幅で列を再描画し、xterm に階段状に見える。
 * `LC_ALL` / `TERM=dumb` / 単一列に加え、`</dev/null` でstdinを切り、パイプ経由で非 TTY とし、
 * POSIX `sed` で行頭ホワイトのみ落とす（段状の先頭スペース）。
 */
function wrapLsForSerial(innerLsCommand: string): string {
  const env = 'LC_ALL=C LANG=C TERM=dumb LS_COLORS= ';
  return `${env}${innerLsCommand} </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat`;
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
