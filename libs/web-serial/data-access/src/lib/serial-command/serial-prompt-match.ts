/** Full rewrite (#606). Generic prompt matching for command runner buffers (#594, #675). */

/**
 * シリアル受信バッファに対する汎用プロンプト一致判定。
 *
 * Pi Zero / Raspberry Pi OS 固有の判定は {@link import('../pi-zero-prompt-detector.service').PiZeroPromptDetectorService}
 * に分離。本モジュールは {@link import('./serial-command-pipeline.service').SerialCommandPipelineService}
 * の `prompt` / `RegExp` 照合専用。
 */
export function matchesSerialPrompt(
  input: string,
  prompt: string | RegExp,
): boolean {
  if (typeof prompt === 'string') {
    return matchesStringPrompt(input, prompt);
  }
  prompt.lastIndex = 0;
  return prompt.test(input);
}

function matchesStringPrompt(input: string, prompt: string): boolean {
  if (!prompt.length) {
    return false;
  }

  /** `pi@raspberrypi:` のようなユーザー@ホストプリフィックスのみ厳しく扱う */
  const isUserHostColonPrefix = /^[^\s]+@[^\s:]+:/.test(prompt);

  if (isUserHostColonPrefix) {
    if (!input.includes(prompt)) {
      return false;
    }
    const line = trailingNonEmptyLine(
      input.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    );
    return (
      line.includes(prompt) && idleInteractiveShellTrailingLine(line)
    );
  }

  return input.includes(prompt);
}

function trailingNonEmptyLine(text: string): string {
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]?.trim();
    if (t && t.length > 0) {
      return t;
    }
  }
  return '';
}

/**
 * エコー中の `…$ ls` / `…# command` ではなく、シェルが入力待ちで行末がプロンプトで終わるか。
 */
function idleInteractiveShellTrailingLine(line: string): boolean {
  const t = line.trimEnd();
  return /[$#%]\s*$/.test(t);
}
