# Web Serial の責務分界（web-serial-rxjs と chirimen-lite-console）

本ドキュメントは [issue #568](https://github.com/gurezo/chirimen-lite-console/issues/568) の趣旨に沿い、汎用ライブラリ **@gurezo/web-serial-rxjs** と本リポジトリ **chirimen-lite-console** の責務境界、および受信ストリームの使い分けをまとめる。実装の詳細（各サービス名・マルチキャスト等）は [libs/web-serial/data-access/README.md](../libs/web-serial/data-access/README.md) を参照。

## リポジトリ別の責務（概要）

```text
web-serial-rxjs（@gurezo/web-serial-rxjs）
  └─ 汎用 serial 通信
      ├─ connect / disconnect
      ├─ send
      ├─ receive（生チャンク）
      ├─ terminalText（TTY 再描画を含む表示用テキスト）
      ├─ state
      ├─ errors
      └─ lines（行分割ストリーム）

chirimen-lite-console（本リポジトリ）
  └─ CHIRIMEN / Pi Zero 固有処理
      ├─ browser check
      ├─ device check（フィルタ・接続フロー）
      ├─ login
      ├─ environment setup（初期化コマンド・シェル準備）
      ├─ command execution（キュー・プロンプト待ち・retry 等）
      └─ terminal UI（表示用パイプ・ViewModel）
```

**原則**: ブラウザの Web Serial 上で「どのボードでも再利用できる」送受信・セッション状態管理は **web-serial-rxjs** に置く。ボード ID・ログインシーケンス・プロンプト文字列・アプリ固有のコマンドオーケストレーション・xterm 等の UI は **本リポジトリ** に置く。

## `SerialSession` と本アプリの薄いラッパー（issue #557 との対応）

本リポジトリでは `SerialSession`（`state$` / `isConnected$` / `errors$` 等）を **接続状態などの唯一のソース** とし、[`SerialTransportService`](../libs/web-serial/data-access/src/lib/serial-transport.service.ts) は `activeSession$` 経由内の **橋渡し（thin adapter）** に留める。Pi Zero 向けの接続・ログイン・初期化は `PiZeroSessionService` やオーケストレーション層に集約し、機能コンポーネントから `SerialTransportService` を直接注入しない方針とする（[`SerialFacadeService`](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) 経由）。

Issue #590 / [#601](https://github.com/gurezo/chirimen-lite-console/issues/601) / [#649](https://github.com/gurezo/chirimen-lite-console/issues/649) 以降は、外部公開 API を `SerialFacadeService` に集約し、利用側は `terminalText$` / `lines$` / `state$` / `isConnected$` / `errors$` / `portInfo$` / `connectionEstablished$` と `connect$()` / `disconnect$()` / `send$()` / `exec$()` / `execRaw$()` / `readUntilPrompt$()` / `isBrowserSupported()` / `isRaspberryPiZero()` を基本導線とする。`receive$` は **Facade では橋渡しせず**、`SerialTransportService` 経由で data-access 内部（`SerialCommandPipelineService`）のみがプロンプト照合・`exec$` の stdout 集約に用いる（[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）。Pi Zero のログイン〜タイムゾーン初期化の期待シーケンスは [Issue #606](https://github.com/gurezo/chirimen-lite-console/issues/606) を参照。

[#664](https://github.com/gurezo/chirimen-lite-console/issues/664) に沿い、`@libs-web-serial-data-access` のパッケージ公開面からは **`SerialCommandPipelineService` クラスを export せず**、コマンド実行の利用入口は Facade の `exec$` / `execRaw$` / `readUntilPrompt$` とする。一方、接続ライフサイクルの read loop 開始・停止・切断時キャンセルは、`SerialFacadeService` と `SerialConnectionOrchestrationService` の **循環 DI を避けるため**、オーケストレーションが Pipeline を **data-access 内部だけ**直接 inject して制御する（詳細は [libs/web-serial/data-access/README.md](../libs/web-serial/data-access/README.md) の「Orchestration と Pipeline」節）。

### `exec$` 系 API の責務（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）

- **ターミナル（xterm）経路**では `send$()` と `terminalText$` のみを使い、`exec$()` / `execRaw$()` / `readUntilPrompt$()` は **呼ばない**（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609)）。
- **`exec$` 系**は、プロンプトまで待って **キャプチャした stdout 等をアプリが解釈する**内部処理向け。i2cdetect・setup・ログイン後初期化はその代表例であり、Wi-Fi・ファイル・リモートなど同種の同期コマンドも同じ原則に含める。
- 詳細は [`SerialFacadeService` の JSDoc](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) および [libs/web-serial/data-access/README.md](../libs/web-serial/data-access/README.md) の「`exec$` の利用方針」を参照。

### `terminalText$` / `send$` / `exec$` の使い分け（[#625](https://github.com/gurezo/chirimen-lite-console/issues/625)）

- **`terminalText$`**: Terminal UI のライブ表示専用。受信表示の責務に限定し、判定処理には使わない。
- **`send$`**: ユーザー入力送信専用。結果解析や完了待ちは行わない。
- **`exec$`**: アプリ制御専用。プロンプト同期で完了まで待ち、stdout 等を解釈する内部フローに使う。
- **UI で `exec$` を使わない理由**: 表示系（`terminalText$`）と制御系（`exec$`）を分離し、二重表示や責務混在を防ぐため。
- **初期化で `exec$` を使う理由**: ログイン後の環境設定では完了待ちと成功/失敗判定が必要で、キャプチャ結果を返す API が必要になるため。

### `terminalText$` の責務（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）

- **ターミナル UI は `SerialFacadeService#terminalText$` を購読**して xterm 等にライブ表示する。送信は `send$()` のみとし、`exec$` 系の戻り値で同じ画面を更新しない（上記 `exec$` 節および [#616](https://github.com/gurezo/chirimen-lite-console/issues/616) と対で読む）。
- 表示の TTY 相当処理・`\r` の扱いはライブラリの `terminalText$` に委譲する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)）。
- **契約の一次情報**は [`SerialFacadeService` の JSDoc](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) および [README の `terminalText$` / `exec$` 節](../libs/web-serial/data-access/README.md) を正とする。

## 受信ストリーム（ライブラリ vs 本アプリの公開面）

ライブラリの `SerialSession` は `receive$` / `receiveReplay$` / `lines$` / `terminalText$` 等を提供する。本アプリの **`SerialFacadeService`** は `terminalText$` / `lines$` を `readonly` で橋渡しする。**`receive$` は Facade では露出せず**、`SerialTransportService` が `activeSession$` 経由で橋渡しし、`SerialCommandPipelineService` がプロンプト照合・`exec$` stdout 用に購読する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)、[#649](https://github.com/gurezo/chirimen-lite-console/issues/649)）。ライブ表示の `\r` 再描画や表示用バッファ正規化は **ライブラリの `terminalText$`** に委譲する。

| ストリーム | ライブラリ `SerialSession` | 本アプリ `SerialFacadeService` |
|------------|---------------------------|--------------------------------|
| `terminalText$` | terminal helper 相当の表示用テキスト | Feature から購読可（xterm ライブ表示） |
| `lines$` | 行境界で分割された行 | Feature から購読可（行単位の読み取り） |
| `receive$` | UTF-8 デコード済みの生チャンク | **橋渡ししない**（`SerialTransportService` のみが data-access 内部向けに公開） |
| `receiveReplay$` | 生チャンク（リプレイ付き） | Facade では橋渡ししない |

### 本アプリでの推奨利用

詳細な対応表は [`libs/web-serial/data-access/README.md`](../libs/web-serial/data-access/README.md) を正とする。要約すると次のとおり。

- **ターミナル表示（xterm 等・TTY 再描画を含むライブ表示）**  
  - `terminalText$` のみを購読する。受信テキストをそのまま xterm に書き込み、`sanitizeSerialStdout` は **ターミナル UI 経路では使用しない**（[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。
- **コマンド実行・プロンプト待ち・ログイン判定（本リポジトリの Feature）**  
  - **`exec$` / `execRaw$` / `readUntilPrompt$`** を使う。プロンプト照合バッファは **`SerialCommandPipelineService` が `receive$` から構築**する（getty の lone `\r` 等で `lines$` が空振りしうるため、照合の一次入力を `lines$` のみに寄せない。[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）。ライブラリ層では `lines$` と同根の **`commandResultLines$` / `getReadStream()`** 等の設計もあるが、本アプリの利用境界は [README](../libs/web-serial/data-access/README.md) を正とする。
- **単一購読で `SerialSession.lines$` をそのまま見たい場合**  
  - `lines$` の素の橋渡し。
- **生チャンクを直接扱う必要がある場合（本アプリの Feature）**  
  - `receive$` を **直接購読しない**。高度用途はライブラリを直接利用する別設計とし、通常は上記 `exec$` 系に任せる。
- **exec 結果の整形表示（エコー削り・プロンプト削り・ANSI 除去）**  
  - `@libs-terminal-util` の `sanitizeSerialStdout`（ライブ表示の `\r` 収束は行わず、`terminalText$` に委譲）。利用は **exec キャプチャ後の後処理**に限定し、残存例は Pi Zero 初期化コマンドのコンソールログや Remote の一覧パースなど（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609) の非対象フロー）。

## 新規実装をどちらのリポジトリに置くか

| 判断 | 置き場所の目安 |
|------|----------------|
| 新しいボード・ベンダーと無関係な送受信 API、セッション寿命、汎用 Observable 設計 | **web-serial-rxjs** |
| Raspberry Pi Zero / CHIRIMEN 固有のフィルタ、ログイン、初期化シーケンス、プロンプト定義、ターミナル画面との連携 | **chirimen-lite-console**（通常は `libs/web-serial` や `libs/terminal`） |

迷った場合は、**「他プロジェクトにそのままコピーしても意味が通るか」** で区切るとよい。通るならライブラリ、CHIRIMEN Lite Console 前提なら本リポジトリ。

## 関連 Issue

- [#557](https://github.com/gurezo/chirimen-lite-console/issues/557) — `SerialSession` を正としたアプリ側の薄型化（本ドキュメント執筆時点でコード上の受け入れ条件を満たしている旨を PR で確認済みとする想定）
- [#568](https://github.com/gurezo/chirimen-lite-console/issues/568) — 本ドキュメントの追加
- [#601](https://github.com/gurezo/chirimen-lite-console/issues/601) — `terminalText$` への表示委譲と facade 公開面の整理
- [#613](https://github.com/gurezo/chirimen-lite-console/issues/613) — ターミナル UI から stdout 整形（`sanitizeSerialStdout`）を排除し、表示は `terminalText$` の生データに統一
- [#616](https://github.com/gurezo/chirimen-lite-console/issues/616) — `exec$` の責務整理（ターミナル外の内部同期コマンド用と文書化）
- [#617](https://github.com/gurezo/chirimen-lite-console/issues/617) — `terminalText$` の責務明確化（ドキュメント・JSDoc）
- [#646](https://github.com/gurezo/chirimen-lite-console/issues/646) — README / ドキュメント上の `receive$` / `lines$` / `terminalText$` と Feature 境界の明文化
- [#649](https://github.com/gurezo/chirimen-lite-console/issues/649) — `SerialFacadeService` の公開 API 縮小（`receive$` 等を Facade から除去）
- [#664](https://github.com/gurezo/chirimen-lite-console/issues/664) — Facade を実質入口に統一し、パッケージ公開面からコマンド Pipeline クラスを除く（Orchestration の内部例外を文書化）
