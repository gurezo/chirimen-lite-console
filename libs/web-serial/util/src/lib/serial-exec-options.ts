/**
 * {@link SerialFacadeService#exec} / execRaw / readUntilPrompt 向けオプション
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
  timeout?: number;
  retry?: number;
}
