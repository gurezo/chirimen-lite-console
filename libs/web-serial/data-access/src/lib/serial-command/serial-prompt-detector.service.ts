import { Injectable } from '@angular/core';

/**
 * Pi Zero / Raspberry Pi OS シリアルコンソール向けのプロンプト判定。
 * 正規表現は本サービス内にのみ置き、呼び出し側は意味メソッドまたは {@link matchesPrompt} を利用する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialPromptDetectorService {
  /**
   * ログイン名入力待ち。
   * 英語 `login:` / 日本語 `ログイン:` 等（大小・`:` 前の空白差を吸収）。
   */
  private readonly loginLinePattern =
    /(?:^|[\r\n])[^\r\n]*(?:[Ll]ogin|ログイン)\s*:\s*/im;

  /**
   * パスワード入力待ち（`Password:` / `password:` 行末）
   */
  private readonly passwordLinePattern = /[^\r\n]*[Pp]assword:\s*$/im;

  /**
   * pi ユーザーシェルプロンプト（`pi@<hostname>:`）
   */
  private readonly shellPromptLinePattern = /pi@[^:\r\n]+:/;

  isLoginPrompt(text: string): boolean {
    this.loginLinePattern.lastIndex = 0;
    return this.loginLinePattern.test(text);
  }

  isPasswordPrompt(text: string): boolean {
    this.passwordLinePattern.lastIndex = 0;
    return this.passwordLinePattern.test(text);
  }

  isShellPrompt(text: string): boolean {
    this.shellPromptLinePattern.lastIndex = 0;
    return this.shellPromptLinePattern.test(text);
  }

  /**
   * シリアル上のコマンド完了はシェルプロンプトへの復帰で判定する。
   */
  isCommandCompleted(text: string): boolean {
    return this.isShellPrompt(text);
  }

  /**
   * 任意の文字列／正規表現による一致（汎用コマンド実行の `prompt` オプション用）。
   */
  matchesPrompt(input: string, prompt: string | RegExp): boolean {
    if (typeof prompt === 'string') {
      return input.includes(prompt);
    }
    prompt.lastIndex = 0;
    return prompt.test(input);
  }
}
