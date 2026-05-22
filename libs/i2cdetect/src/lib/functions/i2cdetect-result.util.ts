/**
 * i2cdetect コマンドの生出力を HTML 表示用に整形する
 *
 * @param rawOutput - i2cdetect の生出力文字列
 * @returns pre/code でラップした HTML 文字列
 */
export function formatI2cdetectResult(rawOutput: string): string {
  const lines = rawOutput.split('\n');
  let result = '<pre><code>     ';

  for (let i = 1; i < lines.length - 1; i++) {
    result += lines[i] + '\n';
  }

  result += '</pre></code>';
  return result;
}
