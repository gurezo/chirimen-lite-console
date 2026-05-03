# web-serial-data-access

Angular 向けのシリアル（Web Serial + `@gurezo/web-serial-rxjs` v2.3.1）データアクセス層。

**リポジトリ間の責務分界**（ライブラリ一般と本アプリの対応、`SerialSession` を正とする方針など）: [docs/serial-architecture.md](../../../docs/serial-architecture.md)（[#568](https://github.com/gurezo/chirimen-lite-console/issues/568)）。

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
| 上記と同種の照合（**data-access 内部**） | **`SerialCommandRunnerService` が `receive$` を購読**しチャンクを連結。`collapseCarriageRedrawsPerLine` 等で論理表示に収束させてから照合する（getty が行末を lone `\r` のみにすると `lines$` が遅れる／空振りすることがあるため）（[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)） |

### issue #566（表示用 vs コマンド用）

- **`terminalText$`（facade / transport）** = `session.terminalText$`。xterm など **UI 表示専用**。プロンプト照合には使わない。
- **`lines$`（facade / transport）** = `SerialSession.lines$`。行単位の購読向け。コマンドランナーのプロンプト用バッファの **唯一の入力**ではない（上表のとおり `SerialTransportService#receive$` を併用する）。
- **`receive$`（transport のみ）** = `session.receive$` の UTF-8 デコード済み生チャンク。**Facade では橋渡ししない**（[#649](https://github.com/gurezo/chirimen-lite-console/issues/649)）。**Feature から直接購読しない**。プロンプト照合バッファは `SerialCommandRunnerService` が `SerialTransportService#receive$` から構築する。

### 本プロジェクト内の対応

- **`SerialTransportService`** が上記各ストリームを `activeSession$` 経由で橋渡しする。
- **`SerialCommandRunnerService`**（`serial-command-runner.service.ts`）が **`receive$` を購読**し、プロンプト待ち・`exec$` の stdout 集約用の `readBuffer` に追記する（`stripSerialAnsiForPrompt`・チャンク連結・必要に応じた `collapseCarriageRedrawsPerLine` による論理行への収束は実装および [#593](https://github.com/gurezo/chirimen-lite-console/issues/593) を参照）。
- **`SerialCommandService` facade** はキュー・再試行・上記ランナーへの委譲を担い、**Feature は `exec$` / `readUntilPrompt$` 経由で**プロンプト同期を行う。
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
- **Facade では露出しない**（data-access 内部のみ）: 生チャンクの `receive$`（`SerialTransportService` 経由で `SerialCommandRunnerService` がプロンプト照合・`exec$` stdout 用に購読。[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）、接続エポック整数（`SerialConnectionOrchestrationService#getConnectionEpoch` — `PiZeroSessionService` が bootstrap 突き合わせに利用）、`read$` / `getPort` / キュー診断 API。
- ライブラリの `receiveReplay$` は本 data-access の Facade では橋渡ししない。ライブ表示の `\r` 再描画は `terminalText$` に委譲する。

### `terminalText$` の責務（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）

- **ターミナル UI（xterm のライブ表示）は `SerialFacadeService#terminalText$` を購読する**唯一のソースとする。受信テキストの TTY 相当の扱い（累積全文の emit 等）は `@gurezo/web-serial-rxjs` の `SerialSession.terminalText$` に委譲する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。
- **送信**は `send$()` のみ。ライブ表示の更新に **`exec$()` / `execRaw$()` / `readUntilPrompt$()` の戻り値を流用しない**（`exec$` 系は stdout キャプチャ用。使い分けは次節および [#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）。
- **プロンプト検出・ログイン判定**は **`terminalText$` を使わず**、`readUntilPrompt$` / `exec$` 経由で data-access 内部の **`receive$` 由来バッファ**により行う（上表・[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）。
- 契約の一次情報は `SerialFacadeService`（`serial-facade.service.ts`）の **`terminalText$` および `exec$` の JSDoc** を参照する。

### `exec$` / `execRaw$` / `readUntilPrompt$` の利用方針（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）

- **役割**: プロンプト同期でコマンドを送り、**stdout 等のキャプチャ結果**が欲しい **アプリ内部**フロー向け。キュー・リトライ・プロンプト検出は `SerialCommandService` 側。
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
- `SerialPromptDetectorService` は **汎用 `matchesPrompt` のみ**を提供し、`SerialCommandRunnerService` から共有利用する。
- 他サービス（`wifi`, `file-manager`, `remote`, `chirimen-setup`, `i2cdetect` など）は Pi Zero 固有ロジックを保持しない。期待プロンプト文字列としての `PI_ZERO_PROMPT` 利用は許容する。
