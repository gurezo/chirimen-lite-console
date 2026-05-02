# web-serial-data-access

Angular 向けのシリアル（Web Serial + `@gurezo/web-serial-rxjs` v2.3.1）データアクセス層。

**リポジトリ間の責務分界**（ライブラリ一般と本アプリの対応、`SerialSession` を正とする方針など）: [docs/serial-architecture.md](../../../docs/serial-architecture.md)（[#568](https://github.com/gurezo/chirimen-lite-console/issues/568)）。

## 受信ストリームの使い分け（`SerialSession` / `SerialTransportService`）

アプリでは `@gurezo/web-serial-rxjs` の `SerialSession` が提供する受信 Observable を、用途に応じて次のように使い分ける（[#559](https://github.com/gurezo/chirimen-lite-console/issues/559)）。

| 用途 | 使用する stream |
| --- | --- |
| ターミナル表示（terminal helper で整形済みテキスト） | `terminalText$`（= `session.terminalText$`） |
| コマンド実行・結果取得に使う **行** | `lines$` |
| 通常の行単位ログ（単一購読の素の橋渡し） | `lines$` |
| prompt / login / password 判定 | **`lines$`** を購読し、行を `\n` で連結したバッファで判定（[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)） |

### issue #566（表示用 vs コマンド用）

- **`terminalText$`（facade / transport）** = `session.terminalText$`。xterm など **UI 表示専用**。プロンプト検出に使わない。
- **`lines$`（facade / transport）** = `SerialSession.lines$`。行単位読み取りはこの stream に統一する。

### 本プロジェクト内の対応

- **`SerialTransportService`** が上記各ストリームを `activeSession$` 経由で橋渡しする。
- **`SerialCommandRunnerService`（`serial-command-runner.service.ts`）／`SerialCommandService` facade** が `lines$` を購読し、プロンプト待ち用に行連結バッファを保持する（表示の `\r` 処理は `terminalText$` と `@libs-web-serial-util` の `collapseCarriageRedrawsPerLine` に委譲）。
- **ターミナル UI** は **`SerialFacadeService#terminalText$` を購読**し、ライブ表示を xterm 等に反映する（例: `TerminalViewComponent`）。`exec$` の戻り値で同じ画面を二重更新しない。

## 接続状態の単一ビューモデル（[#564](https://github.com/gurezo/chirimen-lite-console/issues/564)）

コンポーネント向けには **`SerialConnectionViewModelFacade`** が `vm$: Observable<SerialConnectionViewModel>` を提供する。接続・切断・送信（ツールバーと同様に `TerminalCommandRequestService.requestCommand` 経由）および `clearError()` を前置し、ブラウザ対応フラグ、`SerialFacadeService.state$` に基づく接続試行状態、`PiZeroShellReadinessService.ready$`（問題文での「ログイン済み」と同義：`isLoggedIn`）、`PiZeroSessionService.initializing$` での初期化フラグ、`errorMessage` をまとめる。

## 公開 API ポリシー（Issue #590）

- UI / Feature / 他ライブラリからの Serial 利用は **`SerialFacadeService` のみ**を参照する。
- `SerialTransportService` は data-access 内部の thin adapter 実装として扱い、外部公開 API として依存しない。
- Facade の主な利用 API は次のとおり:
  - stream: `terminalText$`, `lines$`, `state$`, `isConnected$`, `errors$`, `portInfo$`
  - methods: `connect$()`, `disconnect$()`, `send$()`, `exec$()`, `execRaw$()`, `readUntilPrompt$()`, `read$()`, `getPort()`, `isRaspberryPiZero()`, `getConnectionEpoch()`, `isReading()`, `getPendingCommandCount()`
- 生 `receive$` / `receiveReplay$` は facade では公開しない（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)）。ライブ表示の `\r` 再描画は `terminalText$` に委譲する。

### `terminalText$` の責務（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）

- **ターミナル UI（xterm のライブ表示）は `SerialFacadeService#terminalText$` を購読する**唯一のソースとする。受信テキストの TTY 相当の扱い（累積全文の emit 等）は `@gurezo/web-serial-rxjs` の `SerialSession.terminalText$` に委譲する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。
- **送信**は `send$()` のみ。ライブ表示の更新に **`exec$()` / `execRaw$()` / `readUntilPrompt$()` の戻り値を流用しない**（`exec$` 系は stdout キャプチャ用。使い分けは次節および [#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）。
- **プロンプト検出・ログイン判定**は **`lines$`** 側のバッファを用い、`terminalText$` をプロンプト照合に使わない（上表・[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)）。
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

シェル到達後は **環境設定の初期化**（`PI_ZERO_ENVIRONMENT_STEPS`）を `exec$` で実行する。初期化には timezone に加えて language / locale / `TZ` などを含める。ターミナルへのライブ表示は **`terminalText$`**、プロンプト照合・ログイン判定は **`lines$`** 由来のバッファを用いる。

## CHIRIMEN / Pi Zero 固有ロジックの集約（Issue [#594](https://github.com/gurezo/chirimen-lite-console/issues/594)）

- Pi Zero 向けの **login / password / シェルプロンプト到達確認 / 環境初期化（timezone/language/locale/env）** は **`PiZeroSerialBootstrapService` に集約**する（[`pi-zero-serial-bootstrap.service.ts`](src/lib/pi-zero-serial-bootstrap.service.ts)）。
  - 接続単位の「一度だけ実行」などのオーケストレーションは `PiZeroSessionService`（[`pi-zero-session.service.ts`](src/lib/pi-zero-session.service.ts)）。
  - 環境初期化ステップ（timezone/language/locale/env）／期待プロンプトの定数は [`pi-zero-bootstrap.config.ts`](src/lib/pi-zero-bootstrap.config.ts) に集約。
- Pi Zero 固有のプロンプト判定（`pi@…` シェル / `login:` / `Password:` 等）は **`PiZeroPromptDetectorService`** に分離（[`pi-zero-prompt-detector.service.ts`](src/lib/pi-zero-prompt-detector.service.ts)）。
- `SerialPromptDetectorService` は **汎用 `matchesPrompt` のみ**を提供し、`SerialCommandRunnerService` から共有利用する。
- 他サービス（`wifi`, `file-manager`, `remote`, `chirimen-setup`, `i2cdetect` など）は Pi Zero 固有ロジックを保持しない。期待プロンプト文字列としての `PI_ZERO_PROMPT` 利用は許容する。
