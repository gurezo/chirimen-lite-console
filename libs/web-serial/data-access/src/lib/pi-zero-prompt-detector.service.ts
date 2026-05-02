/** Full rewrite (#606). Pi Zero prompt heuristics on line-joined buffers from `lines$`. */
import { Injectable } from '@angular/core';

/**
 * Pi Zero / Raspberry Pi OS シリアルコンソール固有のプロンプト判定（issue #594）。
 *
 * 汎用な `matchesPrompt` は {@link import('./serial-command/serial-prompt-detector.service').SerialPromptDetectorService}
 * 側に残し、login / password / `pi@…` シェルなど CHIRIMEN/Pi Zero 固有判定は本サービスに集約する。
 *
 * 利用主は {@link import('./pi-zero-serial-bootstrap.service').PiZeroSerialBootstrapService}。
 * 他サービスから直接利用しないこと（Pi Zero 固有ロジック集約方針）。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroPromptDetectorService {
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
   * Last login や MOTD のあとにある `pi@...$` は末尾行でなくとも検出する。
   */
  isLikelyLoggedInShellPrompt(text: string): boolean {
    if (this.isShellPrompt(text)) {
      return true;
    }
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // パス省略で `pi@host:$` になるとき `.+` は一致しない（`.` は 0 回以上にする）
    if (/(?:^|[\n])[\t ]*[^\s]+@[^:]+:.*[$#%]/m.test(normalized)) {
      return true;
    }
    const lines = normalized.split('\n');
    const windowSize = Math.min(lines.length, 128);
    for (let j = lines.length - 1; j >= lines.length - windowSize; j--) {
      const line = (lines[j] ?? '').trimEnd().trim();
      if (line.length === 0) {
        continue;
      }
      if (this.lineLooksLikeSerialAuthPrompt(line)) {
        continue;
      }
      if (/^[^\s]+@[^:]+:.*[$#%]\s*$/.test(line)) {
        return true;
      }
    }
    const line = this.trailingNonEmptyLine(normalized);
    if (!line) {
      return false;
    }
    return /^[^\s]+@[^:]+:.*[$#%]\s*$/.test(line);
  }

  /** login: / Password: 単独行のときはシェル到達とはみなさない */
  private lineLooksLikeSerialAuthPrompt(trimmedSingleLine: string): boolean {
    return (
      /(?:[Ll]ogin|ログイン)\s*:\s*$/u.test(trimmedSingleLine) ||
      /[Pp]assword\s*:\s*$/.test(trimmedSingleLine)
    );
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
}
