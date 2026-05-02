import { PI_ZERO_PROMPT } from '@libs-web-serial-util';

/**
 * Pi Zero / CHIRIMEN 接続後の初期化で利用する単一ステップの定義（issue #594）。
 * `statusMessage` は機微情報を含めず、ターミナル表示用に使う。
 */
export interface PiZeroEnvironmentStep {
  statusMessage: string;
  command: string;
}

/**
 * 期待する Raspberry Pi Zero のシェルプロンプト。
 * prompt 待機・コマンド完了判定の比較用に利用する。
 */
export const PI_ZERO_PROMPT_TARGET = PI_ZERO_PROMPT;
export const PI_ZERO_TIMEZONE = 'Asia/Tokyo' as const;
export const PI_ZERO_LANG = 'C.UTF-8' as const;
export const PI_ZERO_LC_ALL = 'C.UTF-8' as const;
export const PI_ZERO_TZ_ENV = PI_ZERO_TIMEZONE;

/**
 * 接続直後のタイムゾーン初期化（各ステップの説明とコマンド）。
 * `sudo -n` で対話的パスワード待ちを避ける。
 */
export const PI_ZERO_ENVIRONMENT_STEPS: readonly PiZeroEnvironmentStep[] = [
  {
    statusMessage:
      `[コンソール] 言語環境変数 LANG=${PI_ZERO_LANG} / LC_ALL=${PI_ZERO_LC_ALL} を設定しています...`,
    command: `export LANG=${PI_ZERO_LANG} LC_ALL=${PI_ZERO_LC_ALL}`,
  },
  {
    statusMessage: '[コンソール] 言語環境変数を確認します。',
    command: 'locale | sed -n "1,2p"',
  },
  {
    statusMessage:
      `[コンソール] タイムゾーンを ${PI_ZERO_TIMEZONE} に設定しています...`,
    command: `sudo -n timedatectl set-timezone ${PI_ZERO_TIMEZONE} 2>/dev/null`,
  },
  {
    statusMessage: '[コンソール] タイムゾーンの状態を表示します。',
    command: 'timedatectl status',
  },
  {
    statusMessage: `[コンソール] 環境変数 TZ=${PI_ZERO_TZ_ENV} を設定しています...`,
    command: `export TZ=${PI_ZERO_TZ_ENV}`,
  },
  {
    statusMessage: '[コンソール] 環境変数 TZ を確認します。',
    command: 'echo "TZ=${TZ:-unset}"',
  },
] as const;
