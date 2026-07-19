/**
 * シリアル経由の擬似 TTY では `ls` が \\r / \\t / 端末幅で列を再描画し、xterm に階段状に見える。
 * `LC_ALL` / 単一列に加え、`</dev/null` でstdinを切り、パイプ経由で非 TTY とし、
 * POSIX `sed` で行頭ホワイトのみ落とす（段状の先頭スペース）。
 * 色は `--color=always`（未指定時）と `TERM=xterm-256color` で xterm テーマに渡す。
 */
function wrapLsForSerial(innerLsCommand: string): string {
  const env = 'LC_ALL=C LANG=C TERM=xterm-256color ';
  return `${env}${innerLsCommand} </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat`;
}

/** ユーザーが既に `--color=...` を指定しているか */
function hasColorOption(lsCommand: string): boolean {
  return /(?:^|\s)--color(?:=|\s|$)/.test(lsCommand);
}

/** `--color` 未指定ならパイプ先でも色が出るよう `--color=always` を付与 */
function withColorAlways(lsCommand: string): string {
  if (hasColorOption(lsCommand)) {
    return lsCommand;
  }
  return lsCommand.replace(/^ls\b/i, 'ls --color=always');
}

export function coerceLsForSerialListing(cmd: string): string {
  const t = cmd.trim();
  if (!/^ls\b/i.test(t)) {
    return cmd;
  }

  let rest = t.replace(/^ls\s*/i, '');
  if (/^--format(=single-column|\s+)/i.test(rest)) {
    return wrapLsForSerial(withColorAlways(t));
  }

  /** 既に `-1` が付いた形（単独フラグまたは `-1lah` などクラスタ） */
  if (rest.startsWith('-1')) {
    return wrapLsForSerial(withColorAlways(t));
  }

  rest = rest.length > 0 ? `-1 ${rest}` : '-1';
  return wrapLsForSerial(withColorAlways(`ls ${rest}`));
}
