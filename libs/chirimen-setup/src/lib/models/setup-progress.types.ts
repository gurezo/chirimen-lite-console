/**
 * CHIRIMEN セットアップの進捗通知（Web Serial 上の 1 コマンド単位）
 */
export type SetupProgressPhase = 'extra' | 'node' | 'post';

export type SetupStepStatus =
  | 'pending'
  | 'running'
  | 'ok'
  | 'failed'
  | 'skipped';

export interface SetupStepProgress {
  stepIndex: number;
  stepTotal: number;
  phase: SetupProgressPhase;
  label: string;
  command: string;
  stdout: string;
  stderr?: string;
  status: SetupStepStatus;
  errorMessage?: string;
}

/** Setup 画面のステップ一覧表示用 */
export interface SetupStepListItem {
  label: string;
  phase: SetupProgressPhase;
  status: SetupStepStatus;
}
