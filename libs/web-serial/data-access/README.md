# web-serial-data-access

Angular 向けのシリアル（Web Serial + `@gurezo/web-serial-rxjs` v2.3.1）データアクセス層。

**リポジトリ間の責務分界**（ライブラリ一般と本アプリの対応、`SerialSession` を正とする方針など）: [docs/serial-architecture.md](../../../docs/serial-architecture.md)（[#568](https://github.com/gurezo/chirimen-lite-console/issues/568)）。

## 設計メモ（責務と実装ルール）（[#652](https://github.com/gurezo/chirimen-lite-console/issues/652)）

今後の実装判断用のレイヤ概要。ストリームの詳細・公開 API の契約・Pi Zero の集約方針は、本 README 下記の「受信ストリームの使い分け」「公開 API ポリシー」「接続 epoch と bootstrap 済み epoch」「CHIRIMEN / Pi Zero 固有ロジックの集約」などの各節を参照する。

### 責務レイヤ（俯瞰）

```text
Feature / UI
  -> SerialFacadeService のみ参照する

SerialFacadeService
  -> 外部 API の入口

SerialTransportService
  -> SerialSession の thin adapter

SerialCommandPipelineService
  -> exec / readUntilPrompt / 直列キュー / prompt 判定

PiZeroSessionService
  -> Pi Zero 接続後 bootstrap の制御

PiZeroSerialBootstrapService
  -> login / environment setup の具体処理
```

### Orchestration と Pipeline（data-access 内部）（[#664](https://github.com/gurezo/chirimen-lite-console/issues/664)）

`SerialConnectionOrchestrationService` は、接続成功直後にコマンド用 **read loop** を開始し、切断時に実行中コマンドをキャンセルして read loop を停止する。これらは **`SerialCommandPipelineService` を直接 inject** して呼ぶ（`startReadLoop` / `stopReadLoop` / `cancelAllCommands`）。

`SerialFacadeService` が既に `SerialConnectionOrchestrationService` を inject しているため、オーケストレーション側まで Facade 経由にすると **Angular DI の循環依存**になりやすい。よって read loop ライフサイクルだけ Pipeline を直接触るのは **data-access 内部の例外** とし、Feature 層の「入口は `SerialFacadeService` のみ」とは両立させる。

### 実装時のルール（要約）

- Feature 側から `SerialTransportService` を直接参照しない（入口は `SerialFacadeService` のみ）。
- `@libs-web-serial-data-access` の公開境界では **`SerialCommandPipelineService` クラスを export しない**。`exec$` 系の戻り値型など必要な **型**（`CommandResult` 等）のみ barrel から再エクスポートする（[#664](https://github.com/gurezo/chirimen-lite-console/issues/664)）。
- ターミナル表示には `terminalText$` を使う。
- 生の `receive$` は原則 **data-access internal**（Feature から購読しない。プロンプト照合は `SerialCommandPipelineService` が `receive$` からバッファを構築）。
- コマンド実行（stdout キャプチャ付き）には `exec$` / `execRaw$` を使う。
- prompt 待ちには `readUntilPrompt$` を使う。
- Pi Zero 固有の login / 環境初期化 / 接続後オーケストレーションは **`PiZeroSerialBootstrapService` / `PiZeroSessionService` に集約**し、Feature 側に散らさない。

### 受信ストリーム（`terminalText$` / `receive$` / `lines$`）の一行要約

| Stream / 経路 | 役割（誰が使うか） |
| --- | --- |
| `terminalText$` | **ターミナル UI のライブ表示**（`\r` 再描画を含む）。Feature は Facade 経由で購読。プロンプト判定には使わない。 |
| `lines$` | **行境界が確まった行**の購読（単発 1 行は `take(1)` 等）。コマンドランナーの唯一の入力ではない（[#593](https://github.com/gurezo/chirimen-lite-console/issues/593) 参照）。 |
| `receive$`（Transport） | **UTF-8 デコード済みの生チャンク**。Facade では露出しない。プロンプト同期・`exec$` の stdout 照合は **`SerialCommandPipelineService` が `receive$` を購読**してバッファする。 |

詳細な使い分け表・根拠は下記「受信ストリームの使い分け」節を参照する。

## 受信ストリームの使い分け（`SerialSession` / `SerialTransportService`）

アプリでは `@gurezo/web-serial-rxjs` の `SerialSession` が提供する受信 Observable を、用途に応じて次のように使い分ける（[#559](https://github.com/gurezo/chirimen-lite-console/issues/559)）。

### Feature 向け推奨導線（[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）

- **入口**: `SerialFacadeService` のみ（他サービスに `SerialTransportService` を直接注入しない）。
- **ターミナル表示**: `terminalText$` を購読する。
- **ユーザー入力の送信**: `send$()`。
- **コマンド実行（stdout キャプチャ付き）**: `exec$()` / `execRaw$()`。
- **送信なしでプロンプト出現まで待つ**: `readUntilPrompt$()`。
- **生の `receive$` を Feature から購読しない**（プロンプト同期は上記 `exec$` 系に任せる。内部では `receive$` チャンクをバッファして照合する）。

| 用途 | 使用する stream / API |
| --- | --- |
| ターミナル表示（TTY の `\r` 再描画を含むライブ表示） | `terminalText$`（= `session.terminalText$`） |
| 行境界が確定した **行** の購読（単発 1 行は `lines$` に `take(1)` 等） | `lines$` |
| プロンプト同期・ログイン〜シェル到達・`exec$` の stdout 照合（**Feature から**） | **`readUntilPrompt$` / `exec$` / `execRaw$`**（内部実装がバッファリングと照合を担当） |
| 上記と同種の照合（**data-access 内部**） | **`SerialCommandPipelineService` が `receive$` を購読**しチャンクを連結。`collapseCarriageRedrawsPerLine` 等で論理表示に収束させてから照合する（getty が行末を lone `\r` のみにすると `lines$` が遅れる／空振りすることがあるため）（[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)） |

### issue #566（表示用 vs コマンド用）

- **`terminalText$`（facade / transport）** = `session.terminalText$`。xterm など **UI 表示専用**。プロンプト照合には使わない。
- **`lines$`（facade / transport）** = `SerialSession.lines$`。行単位の購読向け。コマンドランナーのプロンプト用バッファの **唯一の入力**ではない（上表のとおり `SerialTransportService#receive$` を併用する）。
- **`receive$`（transport のみ）** = `session.receive$` の UTF-8 デコード済み生チャンク。**Facade では橋渡ししない**（[#649](https://github.com/gurezo/chirimen-lite-console/issues/649)）。**Feature から直接購読しない**。プロンプト照合バッファは `SerialCommandPipelineService` が `SerialTransportService#receive$` から構築する。

### 本プロジェクト内の対応

- **`SerialTransportService`** が上記各ストリームを `activeSession$` 経由で橋渡しする。
- **`SerialCommandPipelineService`**（`serial-command-pipeline.service.ts`）が **`receive$` を購読**し、直列キュー・プロンプト待ち・`exec$` の stdout 集約用の `readBuffer` に追記する（`stripSerialAnsiForPrompt`・チャンク連結・必要に応じた `collapseCarriageRedrawsPerLine` による論理行への収束は実装および [#593](https://github.com/gurezo/chirimen-lite-console/issues/593) を参照）。
- **Feature は `SerialFacadeService` の `exec$` / `readUntilPrompt$` 経由で**プロンプト同期を行う（実装はパイプラインに集約）。
- **ターミナル UI** は **`SerialFacadeService#terminalText$` を購読**し、ライブ表示を xterm 等に反映する（例: `TerminalViewComponent`）。`receive$` を xterm に直結しない（[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。`exec$` の戻り値で同じ画面を二重更新しない。

## 主要 3 API の責務と判断基準（Issue #625）

- **`terminalText$`**
  - ターミナル UI（xterm 等）のライブ表示専用。
  - 受信表示の再描画（`\r`）を含む表示責務は `SerialSession.terminalText$` に委譲する。
  - プロンプト判定やログイン判定には使わない。**Feature** が同期待ちする場合は **`readUntilPrompt$` / `exec$` / `execRaw$`** を使う（バッファは data-access 内で `receive$` から構築される）。
- **`send$()`**
  - ユーザー入力送信専用（対話入力・ツールバー送信）。
  - コマンド完了待ちや結果解析は行わない。
  - Terminal UI は「送信=`send$` / 表示=`terminalText$`」を基本導線にする。
- **`exec$()`**
  - アプリ制御用（ログイン後初期化、i2cdetect、setup、結果解析）。
  - プロンプト同期で完了を待ち、stdout 等のキャプチャ結果を返す。
  - Terminal UI で使わない理由は、UI 側の責務を「入力送信とライブ表示」に限定し、結果キャプチャ経路との二重更新・責務混在を防ぐため。

### なぜ初期化処理で `exec$` を使うか（Issue #625）

- 接続直後の bootstrap は、コマンド送信後にプロンプトまで待つ同期制御と結果判定が必要になる。
- タイムゾーンや環境設定の成功/失敗を呼び出し元へ伝播するため、キャプチャ結果を返す `exec$` が適している。
- その結果、Terminal UI は表示責務を維持しつつ、初期化フローは制御責務として分離できる。

## 接続状態の単一ビューモデル（[#564](https://github.com/gurezo/chirimen-lite-console/issues/564)）

コンポーネント向けには **`SerialConnectionViewModelFacade`** が `vm$: Observable<SerialConnectionViewModel>` を提供する。接続・切断・送信（ツールバーと同様に `TerminalCommandRequestService.requestCommand` 経由）および `clearError()` を前置し、ブラウザ対応フラグ、`SerialFacadeService.state$` に基づく接続試行状態、`PiZeroShellReadinessService.ready$`（問題文での「ログイン済み」と同義：`isLoggedIn`）、`PiZeroSessionService.initializing$` での初期化フラグ、`errorMessage` をまとめる。

## 接続 epoch と bootstrap 済み epoch（[#647](https://github.com/gurezo/chirimen-lite-console/issues/647)）

| 状態 | 所有者 | 役割 |
| --- | --- | --- |
| **接続 epoch**（単調増加の整数） | `SerialConnectionOrchestrationService` | 成功した `connect$` のたびに 1 つ進める。切断だけでは進めない。 |
| **bootstrap 済み epoch**（最後に完了した接続 epoch） | `PiZeroSessionService` | 現在の接続 epoch と比較し、接続後パイプライン（ログイン・環境初期化）を **同一接続で 1 回**に抑える。 |
| **進行中パイプライン**（`activeBootstrap$` とその epoch） | `PiZeroSessionService` | 同一接続 epoch での重複 `runAfterConnect$` を抑止。完了時は現在の接続 epoch と突き合わせ、再接続後に遅延した旧パイプラインが `bootstrappedEpoch` を汚染しない。 |

`SerialConnectionOrchestrationService#getConnectionEpoch` は上記突き合わせ用に **data-access 内部**からのみ呼ぶ（Facade には載せない）。

## 公開 API ポリシー（Issue #590 / [#649](https://github.com/gurezo/chirimen-lite-console/issues/649)）

- UI / Feature / 他ライブラリからの Serial 利用は **`SerialFacadeService` のみ**を参照する。
- `SerialTransportService` は data-access 内部の thin adapter 実装として扱い、外部公開 API として依存しない。
- **`SerialFacadeService` の公開 API（Feature が参照してよい契約）**は次のとおり:
  - **Observable**: `terminalText$`, `lines$`, `state$`, `isConnected$`, `errors$`, `portInfo$`, `connectionEstablished$`（接続成功直後 1 回・接続後 bootstrap のトリガ用）
  - **メソッド**: `connect$()`, `disconnect$()`, `send$()`, `exec$()`, `execRaw$()`, `readUntilPrompt$()`, `isBrowserSupported()`, `isRaspberryPiZero()`
- **Facade では露出しない**（data-access 内部のみ）: 生チャンクの `receive$`（`SerialTransportService` 経由で `SerialCommandPipelineService` がプロンプト照合・`exec$` stdout 用に購読。[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）、接続エポック整数（`SerialConnectionOrchestrationService#getConnectionEpoch` — `PiZeroSessionService` が bootstrap 突き合わせに利用）、`read$` / `getPort` / キュー診断 API。
- ライブラリの `receiveReplay$` は本 data-access の Facade では橋渡ししない。ライブ表示の `\r` 再描画は `terminalText$` に委譲する。

### `terminalText$` の責務（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）

- **ターミナル UI（xterm のライブ表示）は `SerialFacadeService#terminalText$` を購読する**唯一のソースとする。受信テキストの TTY 相当の扱い（累積全文の emit 等）は `@gurezo/web-serial-rxjs` の `SerialSession.terminalText$` に委譲する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。
- **送信**は `send$()` のみ。ライブ表示の更新に **`exec$()` / `execRaw$()` / `readUntilPrompt$()` の戻り値を流用しない**（`exec$` 系は stdout キャプチャ用。使い分けは次節および [#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）。
- **プロンプト検出・ログイン判定**は **`terminalText$` を使わず**、`readUntilPrompt$` / `exec$` 経由で data-access 内部の **`receive$` 由来バッファ**により行う（上表・[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）。
- 契約の一次情報は `SerialFacadeService`（`serial-facade.service.ts`）の **`terminalText$` および `exec$` の JSDoc** を参照する。

### `exec$` / `execRaw$` / `readUntilPrompt$` の利用方針（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）

- **役割**: プロンプト同期でコマンドを送り、**stdout 等のキャプチャ結果**が欲しい **アプリ内部**フロー向け。キュー・リトライ・プロンプト検出は `SerialCommandPipelineService` 側。
- **ターミナル UI（xterm の対話・ツールバー）では使わない。** 送信は `send$()`、ライブ表示は `terminalText$` のみ（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609)）。
- **代表例**（Issue 本文の列挙に沿った説明）: ログイン後の bootstrap / タイムゾーン初期化、i2cdetect、Chirimen setup。これに限らず、**同様にプロンプト待ちと stdout が必要な機能**（Wi-Fi、ファイルマネージャ、リモート等）も `exec$` を用いる。
- 契約の一次情報は `SerialFacadeService`（`serial-facade.service.ts`）の各メソッド JSDoc を参照する。

## Pi Zero 接続直後の期待フロー（Issue [#606](https://github.com/gurezo/chirimen-lite-console/issues/606)）

`PiZeroSerialBootstrapService` は `@gurezo/web-serial-rxjs` の `SerialSession` を {@link SerialFacadeService} 経由で利用し、次のコンソール遷移を自動処理する。

1. **接続直後** — getty のログインプロンプト（例: `raspberrypi login:`）。
2. **ユーザー名送信後** — `Password:` プロンプト。
3. **パスワード送信後** — Debian MOTD と `pi@raspberrypi:~$` 形式のシェルプロンプト。

シェル到達後は **環境設定の初期化**（`PI_ZERO_ENVIRONMENT_STEPS`）を `exec$` で実行する。初期化には timezone に加えて language / locale / `TZ` などを含める。ターミナルへのライブ表示は **`terminalText$`**。プロンプト照合・ログイン判定は **`exec$` / `readUntilPrompt$` 経路**（内部で `receive$` チャンクをバッファ）により行う。

## CHIRIMEN / Pi Zero 固有ロジックの集約（Issue [#594](https://github.com/gurezo/chirimen-lite-console/issues/594)）

- Pi Zero 向けの **login / password / シェルプロンプト到達確認 / 環境初期化（timezone/language/locale/env）** は **`PiZeroSerialBootstrapService` に集約**する（[`pi-zero-serial-bootstrap.service.ts`](src/lib/pi-zero-serial-bootstrap.service.ts)）。
  - 接続単位の「一度だけ実行」などのオーケストレーションは `PiZeroSessionService`（[`pi-zero-session.service.ts`](src/lib/pi-zero-session.service.ts)）。
  - 環境初期化ステップ（timezone/language/locale/env）／期待プロンプトの定数は [`pi-zero-bootstrap.config.ts`](src/lib/pi-zero-bootstrap.config.ts) に集約。
- Pi Zero 固有のプロンプト判定（`pi@…` シェル / `login:` / `Password:` 等）は **`PiZeroPromptDetectorService`** に分離（[`pi-zero-prompt-detector.service.ts`](src/lib/pi-zero-prompt-detector.service.ts)）。
- `SerialPromptDetectorService` は **汎用 `matchesPrompt` のみ**を提供し、`SerialCommandPipelineService` から共有利用する。
- 他サービス（`wifi`, `file-manager`, `remote`, `chirimen-setup`, `i2cdetect` など）は Pi Zero 固有ロジックを保持しない。期待プロンプト文字列としての `PI_ZERO_PROMPT` 利用は許容する。

## 回帰テスト（自動 / 手動）（[#651](https://github.com/gurezo/chirimen-lite-console/issues/651) / 親 [#643](https://github.com/gurezo/chirimen-lite-console/issues/643)）

Web Serial 周辺の変更後は、接続・ログイン・timezone・ターミナル・コマンド経路の回帰を必ず確認する。

### 自動テスト（Vitest）のおおよその対応

| 確認観点 | 主な spec |
| --- | --- |
| Facade 経由の `connect$` / `disconnect$` / `exec$` / `readUntilPrompt$` / `terminalText$` | `serial-facade.service.spec.ts` |
| 接続ライフサイクル・再接続時の `disconnect$` → `connect$`・`connectionEpoch`・`connectionEstablished$` | `serial-connection-orchestration.service.spec.ts` |
| `terminalText$` / `errors$` の橋渡し | `serial-transport.service.spec.ts` |
| `exec$` / `readUntilPrompt$`・キュー | `serial-command.service.spec.ts`（`describe: SerialCommandPipelineService`）、`serial-command-queue.service.spec.ts` |
| Pi Zero bootstrap・ログイン・環境初期化 | `pi-zero-serial-bootstrap.service.spec.ts`、`pi-zero-session.service.spec.ts` |
| 接続 UI の VM（timezone 初期化中など）・接続失敗時の通知 | `serial-connection-view-model.facade.spec.ts` |
| ターミナルが `terminalText$` の差分のみ反映する挙動 | `libs/terminal/ui` の `terminal-view.component.spec.ts` |
| Feature が `SerialTransportService` を直接 import しないこと | リポジトリ直下 `tools/verify-serial-feature-boundary.mjs`（CI） |

### 手動確認チェックリスト（実機 / ブラウザ）

実機または対象ブラウザで、必要に応じて記録を残す。

- [ ] ブラウザが Web Serial に対応している（非対応時は `/unsupported-browser` 等の導線）
- [ ] Web Serial でポート選択・接続ができる
- [ ] 切断ができる
- [ ] 再接続（2 回目以降の接続）が問題なく完了する
- [ ] Pi Zero として認識される（想定デバイスのみ接続する運用の場合はその前提で確認）
- [ ] ログイン（login / password）〜シェルプロンプトまで到達する
- [ ] timezone / language（locale）設定が完了し、想定プロンプトに戻る
- [ ] ターミナルに `terminalText$` 由来のライブ表示が出る（`\r` 再描画含む想定動作）
- [ ] ユーザー入力（`send$`）がシェルに届く
- [ ] アプリからのコマンド実行（`exec$`）が期待どおり完了する
- [ ] `readUntilPrompt$` 相当の「プロンプト待ち」フローが期待どおり完了する
- [ ] `i2cdetect` 等、シリアル経由の機能コマンドが動作する
- [ ] 接続失敗・シリアルエラー時にユーザーへ分かる形でエラーが出る

### 変更後に壊れやすい箇所（リグレッション注意）

- **接続 epoch と bootstrap epoch の整合**（`SerialConnectionOrchestrationService` と `PiZeroSessionService` の突き合わせ。再接続直後に旧パイプラインが状態を汚染しないこと）
- **`receive$` と `terminalText$` の責務分界**（表示は `terminalText$`、プロンプト照合は data-access 内の `receive$` バッファ）
- **コマンドキューとプロンプト検出**（`SerialCommandPipelineService` に集約）
- **Feature 境界**（`SerialFacadeService` 以外への低レイヤー依存を増やさない。CI の feature-boundary 検証に抵触しないこと）
