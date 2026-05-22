import { sanitizeProjectSubdir } from './setup.util';
import type { NodeInstallOptions, NodeInstallStep } from '../models/node-install.types';

/**
 * Node 導入〜 CHIRIMEN 依存までのシェルコマンド列
 */
export function buildNodeInstallStepList(
  options: NodeInstallOptions,
): NodeInstallStep[] {
  const installLibDir = options.installLibDir ?? '/usr/local/lib/nodejs';
  const tarFileName = options.nodeTarUrl.split('/').pop() ?? 'node.tar.xz';
  const sub = options.projectSubdir
    ? sanitizeProjectSubdir(options.projectSubdir)
    : '';

  const steps: NodeInstallStep[] = [
    { label: 'Node のバージョン確認', command: 'node -v || true' },
    { label: 'npm のバージョン確認', command: 'npm -v || true' },
    { label: 'forever の有無確認', command: 'which forever || true' },
    {
      label: '作業ディレクトリ chirimenSetup を作成',
      command: 'mkdir -p chirimenSetup',
    },
    { label: 'chirimenSetup に移動', command: 'cd chirimenSetup' },
  ];

  if (sub) {
    steps.push(
      {
        label: `プロジェクトディレクトリ ${sub} を作成`,
        command: `mkdir -p ${sub}`,
      },
      { label: `プロジェクトディレクトリ ${sub} に移動`, command: `cd ${sub}` },
    );
  }

  steps.push(
    {
      label: 'Node.js バイナリを取得',
      command: `wget -O ${tarFileName} ${options.nodeTarUrl}`,
    },
    {
      label: 'Node.js 展開先ディレクトリを作成',
      command: `sudo mkdir -p ${installLibDir}`,
    },
    {
      label: 'Node.js を展開',
      command: `sudo tar -xJvf ${tarFileName} -C ${installLibDir}`,
    },
    {
      label: 'PATH に Node を追加（~/.profile）',
      command:
        "echo 'export PATH=/usr/local/lib/nodejs/bin:$PATH' | tee -a ~/.profile",
    },
    { label: 'プロファイルを再読込', command: '. ~/.profile' },
    {
      label: 'カメラインタフェースを無効化（raspi-config）',
      command: 'sudo raspi-config nonint do_camera 0',
    },
    {
      label: 'レガシーカメラスタックを無効化（raspi-config）',
      command: 'sudo raspi-config nonint do_legacy 0',
    },
    {
      label: 'forever をグローバルインストール',
      command: 'sudo npm install -g forever',
    },
    {
      label: 'package.json を取得',
      command:
        'wget -O package.json https://tutorial.chirimen.org/pizero/package.json',
    },
    {
      label: 'RelayServer.js を取得',
      command:
        'wget -O RelayServer.js https://chirimen.org/remote-connection/js/beta/RelayServer.js',
    },
    { label: 'npm install を実行', command: 'npm install' },
    { label: 'I2C バスを検出（i2cdetect）', command: 'i2cdetect -y 1' },
  );

  return steps;
}
