# web-serial-data-access

Angular 向けのシリアル（Web Serial + `@gurezo/web-serial-rxjs`）データアクセス層。

## 受信ストリームの使い分け（`SerialSession` / `SerialTransportService`）

アプリでは `@gurezo/web-serial-rxjs` の `SerialSession` が提供する受信 Observable を、用途に応じて次のように使い分ける（[#559](https://github.com/gurezo/chirimen-lite-console/issues/559)）。

| 用途 | 使用する stream |
| --- | --- |
| ターミナル表示（生の受信を後から購読しても欠けないようにしたい） | `receiveReplay$` |
| 通常の行単位ログ | `lines$` |
| prompt / login / password 判定 | `receiveReplay$` または専用の prompt 用ストリーム。本リポジトリでは **行単位の `lines$`（`getReadStream`）＋プロンプト用バッファ**で判定し、チャンク境界に依存しないようにしている |
| コマンド結果の行処理 | `lines$` |
| 生の受信 chunk が必要な処理 | `receive$` |

### 本プロジェクト内の対応

- **`SerialTransportService`** が上記各ストリームを `activeSession$` 経由で橋渡しする。
- **`SerialCommandRunnerService`（`serial-command-runner.service.ts`）／`SerialCommandService` facade** が `getReadStream()`（= `lines$`）のみを購読し、プロンプト待ち用に行を連結したバッファを保持する（ライブラリの行分割とは別に、複数行にまたがるパターンマッチ用）。
- **ターミナル UI（xterm）** は、現状はコマンド実行の stdout と接続後ブートストラップのステータスログで表示している。シリアルからのライブミラーを xterm に流す場合は、`receiveReplay$` の購読を検討する。
