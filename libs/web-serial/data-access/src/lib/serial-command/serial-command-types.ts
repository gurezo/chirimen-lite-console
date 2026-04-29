/**
 * コマンド実行設定
 */
export interface CommandExecutionConfig {
  /** 期待するプロンプト文字列 */
  prompt: string | RegExp;
  /** タイムアウト時間（ミリ秒） */
  timeout: number;
  /** タイムアウト等失敗時の再試行回数 */
  retry?: number;
}

/**
 * シリアル上でのコマンド実行結果
 *
 * Web Serial の API では exit code や stderr を分離して取得できないため、
 * 現状は stdout 相当の文字列のみを格納します。
 */
export interface CommandResult {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}
