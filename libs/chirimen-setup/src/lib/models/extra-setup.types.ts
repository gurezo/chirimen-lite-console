export interface ExtraSetupStep {
  label: string;
  command: string;
  /** true のとき失敗してもセットアップを継続する */
  soft?: boolean;
}
