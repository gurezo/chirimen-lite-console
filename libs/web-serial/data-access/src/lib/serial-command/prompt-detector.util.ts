/**
 * シリアル受信バッファが期待するプロンプトを含むか判定する
 */
export function matchesPrompt(input: string, prompt: string | RegExp): boolean {
  if (typeof prompt === 'string') {
    return input.includes(prompt);
  }
  prompt.lastIndex = 0;
  return prompt.test(input);
}
