export interface NodeInstallStep {
  label: string;
  command: string;
}

export interface NodeInstallOptions {
  /**
   * unofficial-builds の tarball URL
   */
  nodeTarUrl: string;
  installLibDir?: string;
  /**
   * chirimenSetup 配下の作業ディレクトリ（#412 の targetDir 相当）
   */
  projectSubdir?: string;
}
