/**
 * CHIRIMEN セットアップの進捗通知（Web Serial 上の 1 コマンド単位）
 */
export type SetupProgressPhase = 'extra' | 'node' | 'post';

export interface SetupStepProgress {
  stepIndex: number;
  stepTotal: number;
  phase: SetupProgressPhase;
  label: string;
  command: string;
  stdout: string;
}
