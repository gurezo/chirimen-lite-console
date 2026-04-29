import { SERIAL_TIMEOUT } from './serial-timeout';

/**
 * {@link SerialFacadeService#exec} / execRaw / readUntilPrompt 向けオプション（issue #565）
 */
export interface SerialExecOptions {
  /**
   * 受信バッファ全体に対するプロンプト一致。指定時は {@link prompt} より優先。
   */
  promptMatch?: (buffer: string) => boolean;
  /**
   * {@link promptMatch} 未指定時に必須。指定時はダミーでも可（未使用）。
   */
  prompt?: string | RegExp;
  /**
   * タイムアウト（ミリ秒）。{@link timeoutMs} 未指定時の {@link timeout} と同義。
   * 後方互換のため残す。
   */
  timeout?: number;
  /** `timeout` の別名。両方指定時はこちらが優先。 */
  timeoutMs?: number;
  /** 失敗試行ごとの再試行回数（初回を除く）。{@link retryCount} 未指定時に使う。 */
  retry?: number;
  /** `retry` の別名。両方指定時はこちらが優先。 */
  retryCount?: number;
  /**
   * 既定 `true`。`false` のとき送信後（または readUntil 時）はプロンプト待ちをせず完了する。
   * exec / execRaw では `stdout` は空文字を返す。
   */
  waitForPrompt?: boolean;
  /**
   * 既定 `false`。`true` のとき、このコマンドをキューに載せる直前に、
   * **未実行**の先行ジョブだけを破棄する（実行中のジョブは止めない）。
   * {@link SerialCommandQueueService#cancelAllCommands} とは別。
   */
  cancelPrevious?: boolean;
}

/**
 * {@link mergeSerialExecOptions} が埋める既定（ミリ秒・回数・フラグ）。
 */
export const DEFAULT_SERIAL_EXEC_OPTIONS = {
  timeoutMs: SERIAL_TIMEOUT.DEFAULT,
  retryCount: 0,
  waitForPrompt: true,
  cancelPrevious: false,
} as const;

/**
 * 省略フィールドを {@link DEFAULT_SERIAL_EXEC_OPTIONS} で埋め、`timeout`/`timeoutMs` と `retry`/`retryCount` を正規化する。
 */
export function mergeSerialExecOptions(options: SerialExecOptions): SerialExecOptions {
  const timeout =
    options.timeoutMs ?? options.timeout ?? DEFAULT_SERIAL_EXEC_OPTIONS.timeoutMs;
  const retry =
    options.retryCount ?? options.retry ?? DEFAULT_SERIAL_EXEC_OPTIONS.retryCount;
  const waitForPrompt =
    options.waitForPrompt ?? DEFAULT_SERIAL_EXEC_OPTIONS.waitForPrompt;
  const cancelPrevious =
    options.cancelPrevious ?? DEFAULT_SERIAL_EXEC_OPTIONS.cancelPrevious;
  return {
    ...options,
    timeout,
    retry,
    timeoutMs: timeout,
    retryCount: retry,
    waitForPrompt,
    cancelPrevious,
  };
}
