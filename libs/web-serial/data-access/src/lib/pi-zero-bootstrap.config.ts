import { PI_ZERO_PROMPT } from '@libs-web-serial-util';

/**
 * Pi Zero / CHIRIMEN 接続後の初期化で利用する単一ステップの定義（issue #594）。
 * `statusMessage` は機微情報を含めず、ターミナル表示用に使う。
 */
export interface PiZeroTimezoneStep {
  statusMessage: string;
  command: string;
}

/**
 * 期待する Raspberry Pi Zero のシェルプロンプト。
 * prompt 待機・コマンド完了判定の比較用に利用する。
 */
export const PI_ZERO_PROMPT_TARGET = PI_ZERO_PROMPT;

/**
 * 接続直後のタイムゾーン初期化（各ステップの説明とコマンド）。
 * `sudo -n` で対話的パスワード待ちを避け、失敗時も `|| true` で後続へ進める。
 */
export const PI_ZERO_TIMEZONE_STEPS: readonly PiZeroTimezoneStep[] = [
  {
    statusMessage:
      '[コンソール] タイムゾーンを Asia/Tokyo に設定しています...',
    command:
      'sudo -n timedatectl set-timezone Asia/Tokyo 2>/dev/null || true',
  },
  {
    statusMessage: '[コンソール] タイムゾーンの状態を表示します。',
    command: 'timedatectl status',
  },
] as const;
