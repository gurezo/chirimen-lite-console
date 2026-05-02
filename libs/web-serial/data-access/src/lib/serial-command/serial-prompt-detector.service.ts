/** Full rewrite (#606). Generic prompt matching for command runner buffers. */
import { Injectable } from '@angular/core';

/**
 * シリアル受信バッファに対する汎用プロンプト一致判定（issue #594）。
 *
 * Pi Zero / Raspberry Pi OS 固有の判定（login / password / `pi@…` シェル等）は
 * `PiZeroPromptDetectorService` に分離しているため、本サービスは
 * `SerialCommandRunnerService` などコマンド実行系で使う汎用 `matchesPrompt` のみを提供する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialPromptDetectorService {
  /**
   * 任意の文字列／正規表現による一致（汎用コマンド実行の `prompt` オプション用）。
   *
   * `user@host:…` を部分文字列のみでなく **末尾が入力待ち** のときだけ真にする（issue: エコー行
   * `pi@…:$ ls -la` に含まれる `pi@…:` が即一致し、実行結果を待たずに完了扱いになる）。
   */
  matchesPrompt(input: string, prompt: string | RegExp): boolean {
    if (typeof prompt === 'string') {
      return this.matchesStringPrompt(input, prompt);
    }
    prompt.lastIndex = 0;
    return prompt.test(input);
  }

  private matchesStringPrompt(input: string, prompt: string): boolean {
    if (!prompt.length) {
      return false;
    }

    /** `pi@raspberrypi:` のようなユーザー@ホストプリフィックスのみ厳しく扱う */
    const isUserHostColonPrefix = /^[^\s]+@[^\s:]+:/.test(prompt);

    if (isUserHostColonPrefix) {
      if (!input.includes(prompt)) {
        return false;
      }
      const line = this.trailingNonEmptyLine(
        input.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
      );
      return (
        line.includes(prompt) && this.idleInteractiveShellTrailingLine(line)
      );
    }

    return input.includes(prompt);
  }

  private trailingNonEmptyLine(text: string): string {
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
  private idleInteractiveShellTrailingLine(line: string): boolean {
    const t = line.trimEnd();
    return /[$#%]\s*$/.test(t);
  }
}
