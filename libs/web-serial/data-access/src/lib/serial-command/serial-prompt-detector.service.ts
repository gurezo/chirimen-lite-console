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

  /**
   * getty の入力待ちを **末尾の非空行** で見る（バッファ先頭に `login:` が残っていても
   * 実際には `Password:` 待ち、などを区別するため）。
   */
  private trailingNonEmptyLine(text: string): string {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i]?.trim();
      if (t && t.length > 0) {
        return t;
      }
    }
    return '';
  }

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
   * 対話シェル到達とみなせるプロンプト（`pi@` に限らない）。
   * 既にログイン済みなのに getty 待ちへ進みタイムアウトする誤判定を防ぐ。
   */
  isLikelyLoggedInShellPrompt(text: string): boolean {
    if (this.isShellPrompt(text)) {
      return true;
    }
    const line = this.trailingNonEmptyLine(text);
    if (!line) {
      return false;
    }
    // user@host:path $ / # / %（bash / zsh 等で一般的な末尾）
    return /^[^\s]+@[^:]+:.+[$#%]\s*$/.test(line);
  }

  /**
   * 末尾行がユーザー名入力待ちの `login:` / `ログイン:`（getty の現在のプロンプト）
   */
  isAwaitingLoginName(text: string): boolean {
    const line = this.trailingNonEmptyLine(text);
    if (!line) {
      return false;
    }
    return /(?:[Ll]ogin|ログイン)\s*:\s*$/.test(line);
  }

  /**
   * 末尾がパスワード入力待ち（接続直後ですでに `Password:` のみ、など）。
   */
  isAwaitingPasswordInput(text: string): boolean {
    const line = this.trailingNonEmptyLine(text);
    if (!line) {
      return false;
    }
    return /[Pp]assword:\s*$/.test(line);
  }

  /**
   * シリアル上のコマンド完了はシェルプロンプトへの復帰で判定する。
   */
  isCommandCompleted(text: string): boolean {
    return this.isLikelyLoggedInShellPrompt(text);
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
