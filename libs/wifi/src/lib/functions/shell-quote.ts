/**
 * POSIX sh 用に文字列を単一引用符でラップする。
 * シェルに1引数として安全に渡す（`'` は `'\''` にエスケープ）。
 */
export function shellSingleQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}
