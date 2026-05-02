# web-serial-data-access

Angular 向けのシリアル（Web Serial + `@gurezo/web-serial-rxjs`）データアクセス層。

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
- **`SerialCommandRunnerService`（`serial-command-runner.service.ts`）／`SerialCommandService` facade** が `lines$` を購読し、プロンプト待ち用に行連結バッファを保持する（表示の `\r` 処理は `terminalText$` に委譲）。
- **ターミナル UI** は `TerminalConsoleOrchestrationService#pipeTerminalOutputToSink$` で **`terminalText$` のみ** をライブミラーに接続できる。`exec` の stdout 整形表示と二重にならないよう使い分けること。

## 接続状態の単一ビューモデル（[#564](https://github.com/gurezo/chirimen-lite-console/issues/564)）

コンポーネント向けには **`SerialConnectionViewModelFacade`** が `vm$: Observable<SerialConnectionViewModel>` を提供する。接続・切断・送信（ツールバーと同様に `TerminalCommandRequestService.requestCommand` 経由）および `clearError()` を前置し、ブラウザ対応フラグ、`SerialFacadeService.state$` に基づく接続試行状態、`PiZeroShellReadinessService.ready$`（問題文での「ログイン済み」と同義：`isLoggedIn`）、`PiZeroSessionService.initializing$` での初期化フラグ、`errorMessage` をまとめる。

## 公開 API ポリシー（Issue #590）

- UI / Feature / 他ライブラリからの Serial 利用は **`SerialFacadeService` のみ**を参照する。
- `SerialTransportService` は data-access 内部の thin adapter 実装として扱い、外部公開 API として依存しない。
- Facade の主な利用 API は次のとおり:
  - stream: `terminalText$`, `lines$`, `state$`, `isConnected$`, `errors$`, `portInfo$`
  - methods: `connect$()`, `disconnect$()`, `send$()`, `exec$()`, `execRaw$()`, `readUntilPrompt$()`, `read$()`, `getPort()`, `isRaspberryPiZero()`, `getConnectionEpoch()`, `isReading()`, `getPendingCommandCount()`
- 生 `receive$` / `receiveReplay$` は facade では公開しない（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)）。ライブ表示の `\r` 再描画は `terminalText$` に委譲する。
