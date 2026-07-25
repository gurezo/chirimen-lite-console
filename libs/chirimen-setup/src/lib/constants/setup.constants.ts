import type { ExtraSetupStep } from '../models';

/**
 * Node.js 非公式ビルド（linux-arm64-musl）のデフォルト URL。
 * 必要に応じて UI から差し替え可能。
 */
export const DEFAULT_NODE_TAR_URL =
  'https://unofficial-builds.nodejs.org/download/release/v24.9.0/node-v24.9.0-linux-arm64-musl.tar.xz';

/**
 * #412 のチュートリアル手順に合わせたプロジェクトサブディレクトリのデフォルト（chirimenSetup 配下）
 */
export const DEFAULT_PROJECT_SUBDIR = 'pizero';

/** ExtraSetupService と同じ内容（Angular 非依存・テスト・件数参照用） */
export const EXTRA_SETUP_STEP_COUNT = 1;

/** デバイス側の追加設定（タイムゾーン）。raspi-config は NodeInstall に集約。 */
export const EXTRA_SETUP_STEPS: readonly ExtraSetupStep[] = [
  {
    label: 'タイムゾーンを Asia/Tokyo に設定',
    command: 'sudo timedatectl set-timezone Asia/Tokyo || true',
    soft: true,
  },
];
