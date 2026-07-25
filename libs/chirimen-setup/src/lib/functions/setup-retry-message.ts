import type { SetupStepProgress } from '../models';

/**
 * 途中失敗時に表示する再試行案内文を生成する。
 */
export function buildSetupRetryMessage(failed: SetupStepProgress): string {
  const detail = failed.errorMessage?.trim()
    ? `\n原因: ${failed.errorMessage.trim()}`
    : '';
  return [
    `ステップ「${failed.label}」で失敗しました（${failed.stepIndex + 1}/${failed.stepTotal}）。`,
    detail,
    '',
    '再試行手順:',
    '1. ログとシリアル接続を確認してください',
    '2. ネットワーク（wget）やディスク容量を確認してください',
    '3. 問題を解消したら、もう一度「セットアップ実行」を押してください',
    '4. 既に一部が完了している場合でも、同じ手順を再実行して構いません',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}
