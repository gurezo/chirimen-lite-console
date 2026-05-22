import { stripSerialAnsiForPrompt } from '../../functions';

/**
 * 受信 1 行をプロンプト検出用バッファ向けに正規化する
 */
export function stripLineForPromptDetection(line: string): string {
  return stripSerialAnsiForPrompt(line);
}
