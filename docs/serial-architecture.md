# Web Serial の責務分界（web-serial-rxjs と chirimen-lite-console）

本ドキュメントは [issue #568](https://github.com/gurezo/chirimen-lite-console/issues/568) の趣旨に沿い、汎用ライブラリ **@gurezo/web-serial-rxjs** と本リポジトリ **chirimen-lite-console** の責務境界、および受信ストリームの使い分けをまとめる。実装の詳細（各サービス名・マルチキャスト等）は [libs/web-serial/README.md](../libs/web-serial/README.md) を参照。

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

[#664](https://github.com/gurezo/chirimen-lite-console/issues/664) に沿い、`@libs-web-serial` のパッケージ公開面からは **`SerialCommandPipelineService` クラスを export せず**、コマンド実行の利用入口は Facade の `exec$` / `execRaw$` / `readUntilPrompt$` とする。実装として **`SerialFacadeService` は上記 API を Pipeline に委譲するため Pipeline を直接 inject** する。接続ライフサイクルの read loop 開始・停止・切断時キャンセルは、`SerialFacadeService` と `SerialConnectionOrchestrationService` の **循環 DI を避けるため**、オーケストレーションも Pipeline を **data-access 内部だけ**直接 inject して制御する（詳細は [libs/web-serial/README.md](../libs/web-serial/README.md) の「Orchestration と Pipeline」節）。

### `exec$` 系 API の責務（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）

- **ターミナル（xterm）経路**では `send$()` と `terminalText$` のみを使い、`exec$()` / `execRaw$()` / `readUntilPrompt$()` は **呼ばない**（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609)）。
- **`exec$` 系**は、プロンプトまで待って **キャプチャした stdout 等をアプリが解釈する**内部処理向け。i2cdetect・setup・ログイン後初期化はその代表例であり、Wi-Fi・ファイル・リモートなど同種の同期コマンドも同じ原則に含める。
- 詳細は [`SerialFacadeService` の JSDoc](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) および [libs/web-serial/README.md](../libs/web-serial/README.md) の「`exec$` の利用方針」を参照。

### `terminalText$` / `send$` / `exec$` の使い分け（[#625](https://github.com/gurezo/chirimen-lite-console/issues/625)）

- **`terminalText$`**: Terminal UI のライブ表示専用。受信表示の責務に限定し、判定処理には使わない。
- **`send$`**: ユーザー入力送信専用。結果解析や完了待ちは行わない。
- **`exec$`**: アプリ制御専用。プロンプト同期で完了まで待ち、stdout 等を解釈する内部フローに使う。
- **UI で `exec$` を使わない理由**: 表示系（`terminalText$`）と制御系（`exec$`）を分離し、二重表示や責務混在を防ぐため。
- **初期化で `exec$` を使う理由**: ログイン後の環境設定では完了待ちと成功/失敗判定が必要で、キャプチャ結果を返す API が必要になるため。

### `terminalText$` の責務（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）

- **ターミナル UI は `SerialFacadeService#terminalText$` を購読**して xterm 等にライブ表示する。送信は `send$()` のみとし、`exec$` 系の戻り値で同じ画面を更新しない（上記 `exec$` 節および [#616](https://github.com/gurezo/chirimen-lite-console/issues/616) と対で読む）。
- 表示の TTY 相当処理・`\r` の扱いはライブラリの `terminalText$` に委譲する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)）。
- **契約の一次情報**は [`SerialFacadeService` の JSDoc](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) および [README の `terminalText$` / `exec$` 節](../libs/web-serial/README.md) を正とする。

## 受信ストリーム（ライブラリ vs 本アプリの公開面）

ライブラリの `SerialSession` は `receive$` / `receiveReplay$` / `lines$` / `terminalText$` 等を提供する。本アプリの **`SerialFacadeService`** は `terminalText$` / `lines$` を `readonly` で橋渡しする。**`receive$` は Facade では露出せず**、`SerialTransportService` が `activeSession$` 経由で橋渡しし、`SerialCommandPipelineService` がプロンプト照合・`exec$` stdout 用に購読する（[#601](https://github.com/gurezo/chirimen-lite-console/issues/601)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)、[#649](https://github.com/gurezo/chirimen-lite-console/issues/649)）。ライブ表示の `\r` 再描画や表示用バッファ正規化は **ライブラリの `terminalText$`** に委譲する。

| ストリーム | ライブラリ `SerialSession` | 本アプリ `SerialFacadeService` |
|------------|---------------------------|--------------------------------|
| `terminalText$` | terminal helper 相当の表示用テキスト | Feature から購読可（xterm ライブ表示） |
| `lines$` | 行境界で分割された行 | Feature から購読可（行単位の読み取り） |
| `receive$` | UTF-8 デコード済みの生チャンク | **橋渡ししない**（`SerialTransportService` のみが data-access 内部向けに公開） |
| `receiveReplay$` | 生チャンク（リプレイ付き） | Facade では橋渡ししない |

### 本アプリでの推奨利用

詳細な対応表は [`libs/web-serial/README.md`](../libs/web-serial/README.md) を正とする。要約すると次のとおり。

- **ターミナル表示（xterm 等・TTY 再描画を含むライブ表示）**  
  - `terminalText$` のみを購読する。受信テキストをそのまま xterm に書き込み、`sanitizeSerialStdout` は **ターミナル UI 経路では使用しない**（[#613](https://github.com/gurezo/chirimen-lite-console/issues/613)）。
- **コマンド実行・プロンプト待ち・ログイン判定（本リポジトリの Feature）**  
  - **`exec$` / `execRaw$` / `readUntilPrompt$`** を使う。プロンプト照合バッファは **`SerialCommandPipelineService` が `receive$` から構築**する（getty の lone `\r` 等で `lines$` が空振りしうるため、照合の一次入力を `lines$` のみに寄せない。[#593](https://github.com/gurezo/chirimen-lite-console/issues/593)、[#646](https://github.com/gurezo/chirimen-lite-console/issues/646)）。ライブラリ層では `lines$` と同根の **`commandResultLines$` / `getReadStream()`** 等の設計もあるが、本アプリの利用境界は [README](../libs/web-serial/README.md) を正とする。
- **単一購読で `SerialSession.lines$` をそのまま見たい場合**  
  - `lines$` の素の橋渡し。
- **生チャンクを直接扱う必要がある場合（本アプリの Feature）**  
  - `receive$` を **直接購読しない**。高度用途はライブラリを直接利用する別設計とし、通常は上記 `exec$` 系に任せる。
- **exec 結果の整形表示（エコー削り・プロンプト削り・ANSI 除去）**  
  - `@libs-terminal` の `sanitizeSerialStdout`（ライブ表示の `\r` 収束は行わず、`terminalText$` に委譲）。利用は **exec キャプチャ後の後処理**に限定し、残存例は Pi Zero 初期化コマンドのコンソールログや Remote の一覧パースなど（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609) の非対象フロー）。

## 公開面の棚卸し（Issue [#672](https://github.com/gurezo/chirimen-lite-console/issues/672)）

親 Issue [#671](https://github.com/gurezo/chirimen-lite-console/issues/671) のサブタスクとして、`@libs-web-serial` の **barrel（[`libs/web-serial/src/index.ts`](../libs/web-serial/src/index.ts)）に載っているシンボル**と、**ワークスペース内の import 実態**を突き合わせ、公開契約・条件付き公開・内部向け候補に分類する。本節は **現状の事実と判断材料**を記録するものであり、barrel の変更は後続 Issue（#673 以降）で小さく行う前提とする。

### Barrel から公開されているシンボル（`index.ts` 由来）

| 公開経路 | シンボル（代表） | 備考 |
|----------|------------------|------|
| `@libs-web-serial` の再エクスポート | `SerialExecOptions`（型）, `DEFAULT_SERIAL_EXEC_OPTIONS`, `mergeSerialExecOptions` | 実行オプションの型とヘルパ |
| `export *` | `PiZeroPromptDetectorService` | Pi ログイン／プロンプト判定の実装詳細 |
| `export *` | `PiZeroSessionService` | 接続後 bootstrap・epoch 制御 |
| `export *` | `PiZeroSerialBootstrapService` | login / setup の具体シーケンス |
| `export *` | `PiZeroShellReadinessService` | シェル準備状態 |
| `export *` | `SerialSetupStatus`（型） | setup 進行状態の列挙 |
| `export type` | `CommandExecutionConfig`, `CommandResult` | `exec$` 系の戻り値・内部設定型（[#664](https://github.com/gurezo/chirimen-lite-console/issues/664)） |
| `export type` | `SerialCommandEnqueueOptions` | キュー投入オプション型 |
| `export *` | `SerialFacadeService`, `SerialFacadeConnectResult`（型） | アプリ主入口 |
| `export *` | `SerialNotificationService` | 接続 VM 等が利用 |
| `export *` | `SerialConnectionViewModelFacade`, `SerialConnectionViewModel`（型） | 接続画面用 ViewModel |

**barrel から出ていない（確認ポイント）**: `SerialCommandPipelineService` クラス、`SerialTransportService` — data-access 内部（および `SerialConnectionOrchestrationService` の read loop 制御）に閉じる方針どおり（[#664](https://github.com/gurezo/chirimen-lite-console/issues/664)）。

**統合済み**: `SerialValidatorService` は [#674](https://github.com/gurezo/chirimen-lite-console/issues/674) で `SerialTransportService` に統合し、barrel からも除外した。判定対象（`getPortInfo()` / `getPort()`）と `RASPBERRY_PI_ZERO_INFO` 定数の所有者が同一であること、利用箇所が `SerialFacadeService#isRaspberryPiZero()` の 1 箇所に限られ専用 spec も存在しなかったことが根拠（親 [#671](https://github.com/gurezo/chirimen-lite-console/issues/671) の「小さいサービスだけ統合」方針に合致）。Feature 層から見た公開 API（`SerialFacadeService#isRaspberryPiZero()`）は変更していない。

### 汎用プロンプト照合（Sub [#675](https://github.com/gurezo/chirimen-lite-console/issues/675)）

- **責務**: `exec$` / `readUntilPrompt$` の `prompt` 文字列／`RegExp` による受信バッファ照合（`user@host:` 行末の厳格化、`[$#%]` で終わる「入力待ち」行の判定など）。Pi Zero 固有の login / password / シェル到達は `PiZeroPromptDetectorService` のまま（本サブ Issue の対象外）。
- **統合済み（#675）**: `SerialPromptDetectorService`（Injectable）を廃止し、同等ロジックを [`serial-prompt-match.ts`](../libs/web-serial/data-access/src/lib/serial-command/serial-prompt-match.ts) の **`matchesSerialPrompt` 純関数**に集約。`SerialCommandPipelineService` が直接 import する。利用者が Pipeline のみで外部 I/O がなく、親 [#671](https://github.com/gurezo/chirimen-lite-console/issues/671) の「小さいサービスだけ統合」に合致。PoC では `serial-prompt-match.spec.ts` に境界ケースを移せば可読性を維持でき、Pipeline の DI 引数も減るため **統合を採用**。barrel の公開面に変更はない。

### ワークスペースでの `@libs-web-serial` import 実態

`libs/web-serial/data-access` 自身を除き、`import ... from '@libs-web-serial'` があるファイルは次のとおり。

| import しているシンボル | ファイル |
|-------------------------|----------|
| `SerialFacadeService` のみ | `libs/chirimen-setup/data-access`（`setup-command.service`, `extra-setup.service`, `node-install.service`）、`libs/chirimen-setup/feature/setup-page`（本体・spec）、`libs/file-manager/data-access/file.service`（本体・spec）、`libs/i2cdetect/data-access/i2cdetect.service`、`libs/remote/data-access`（`remote-run`, `remote-stop`, `remote-status` および `remote-stop.service.spec`）、`libs/remote/feature/remote-page`（本体・spec）、`libs/shared/guards/connection.guard`、`libs/terminal/ui/terminal-view/terminal-view.component.ts`、`libs/wifi/data-access`（`wifi-scan`, `wifi-config`, `file-content`, `wifi-reboot-flow`）、`libs/wifi/feature/wifi-page`（本体・spec） |
| `SerialConnectionViewModelFacade`, `SerialConnectionViewModel`（型） | `libs/connect/feature/connect-page`（本体・spec）、`libs/console-shell/feature/console-shell`（本体・spec） |
| `SerialFacadeService` と `PiZeroSessionService` の併用 | `libs/terminal/ui/terminal-view/terminal-console-orchestration.service`（本体）、`terminal-console-orchestration.service.spec`、`terminal-view.component.spec` |
| `PiZeroShellReadinessService` | `libs/file-manager/feature/file-tree-feature`（本体・spec） |

**設定のみ**: `libs/terminal/feature/vitest.config.ts` はパスエイリアスで `data-access/src/index.ts` を参照（実行時 import ではない）。

### 三層分類（現状評価と目標の整理）

| 層 | 意味 | 該当シンボル・パターン |
|----|------|------------------------|
| **公開契約** | Feature / 他 domain の data-access から依存してよい契約として文書化済み | `SerialFacadeService`（主入口）。`SerialExecOptions` / `CommandResult` / `CommandExecutionConfig` / `SerialCommandEnqueueOptions` は型としての再エクスポートが妥当。`DEFAULT_SERIAL_EXEC_OPTIONS` / `mergeSerialExecOptions` は `exec$` 呼び出し側で利用するなら公開のまま。 |
| **条件付き公開** | 特定 UI 導線のため barrel を跨ぐが、「第二の入口」として理由を添える | `SerialConnectionViewModelFacade` と `SerialConnectionViewModel`（接続ページ・コンソールシェル）。README の「入口は Facade のみ」と併記し、**接続 UI 専用の公開面**として位置づける。 |
| **内部向け候補（barrel から外す・非 export の検討）** | data-access 外に利用者がいない、または README の集約方針とズレる公開 | `SerialNotificationService`（現状、外部から直接 import なし — VM 内部利用）。`PiZeroPromptDetectorService` / `PiZeroSerialBootstrapService`（bootstrap 集約の内部部品）。`SerialSetupStatus` は VM の型として spec が型 import する可能性はあるが、主に data-access 内。 |

**方針とのギャップ（判断材料）**: [README の Pi 集約方針](../libs/web-serial/README.md)では Pi 固有処理を `PiZeroSessionService` / `PiZeroSerialBootstrapService` に集約し Feature に散らさない旨がある一方、**`PiZeroSessionService` を `terminal-console-orchestration` が直接 inject**し、**`PiZeroShellReadinessService` を file-manager feature が直接 inject**している。Issue #672 の完了条件は「削除・制限対象の明確化」までとし、**移行（Facade または別 VM への寄せ）**は #671 の後続サブ Issue で扱うのが安全。

### 制限・削除の優先度（提案）

1. **対応済み（[#674](https://github.com/gurezo/chirimen-lite-console/issues/674)）**: `SerialValidatorService` は `SerialTransportService` に統合し、barrel からも除外済み。Pi Zero 判定の入口は従来どおり `SerialFacadeService#isRaspberryPiZero()`。
2. **中リスク**: `PiZeroPromptDetectorService` / `PiZeroSerialBootstrapService` の barrel 非公開化は、外部から直接 import していないことを確認済みだが、将来のテストや E2E での参照に注意。
3. **高リスク（要設計）**: `PiZeroSessionService` / `PiZeroShellReadinessService` の Feature 直接利用をやめる場合は、`SerialFacadeService` へのメソッド追加、または接続／ターミナル用の薄いファサードの新設など **移行先の API 設計**が先に必要。

### 回帰確認の観点（export を変更する後続 PR 用）

barrel を変更する際は、少なくとも次を満たすこと（親 #671・[#662](https://github.com/gurezo/chirimen-lite-console/issues/662) 以降の方針と整合）。

- **Terminal**: `terminalText$` の表示、`\r` 再描画の崩れなし。
- **Input**: `send$` が正常動作。
- **Command**: `exec$` / `readUntilPrompt$`、並列 `exec` の直列化。
- **Pi Zero**: ログイン、shell readiness、timezone / setup。
- **その他**: i2cdetect、ターミナル二重表示なし。
- 関連 Issue の回帰なし: [#559](https://github.com/gurezo/chirimen-lite-console/issues/559) / [#593](https://github.com/gurezo/chirimen-lite-console/issues/593) / [#606](https://github.com/gurezo/chirimen-lite-console/issues/606) / [#647](https://github.com/gurezo/chirimen-lite-console/issues/647) / [#662](https://github.com/gurezo/chirimen-lite-console/issues/662)。

サブ Issue [#676](https://github.com/gurezo/chirimen-lite-console/issues/676) では上記の**実機確認**と併せ、少なくとも次の **Nx / Vitest** をローカルまたは CI で実行して回帰の目安とする。

```bash
npx nx run libs-web-serial:test
npx nx run libs-web-serial:test
npx nx run libs-web-serial:lint
npx nx run libs-web-serial:lint
npx nx run apps-console:test
```

`libs-web-serial` のテストには `SerialCommandPipelineService`（並列 `exec` の直列化・`readUntilPrompt$` 等）および Pi Zero ブートストラップ周りの spec が含まれる。ブラウザ実機（`terminalText$` の `\r` 表示、二重表示の有無、Pi Zero ログイン〜setup）は上記コマンドでは代替できないため、**マージ前に手元で接続確認**し、PR に環境と結果を記録する。

## 新規実装をどちらのリポジトリに置くか

| 判断 | 置き場所の目安 |
|------|----------------|
| 新しいボード・ベンダーと無関係な送受信 API、セッション寿命、汎用 Observable 設計 | **web-serial-rxjs** |
| Raspberry Pi Zero / CHIRIMEN 固有のフィルタ、ログイン、初期化シーケンス、プロンプト定義、ターミナル画面との連携 | **chirimen-lite-console**（通常は `libs/web-serial` や `libs/terminal`） |

迷った場合は、**「他プロジェクトにそのままコピーしても意味が通るか」** で区切るとよい。通るならライブラリ、CHIRIMEN Lite Console 前提なら本リポジトリ。

## ログアウト後のセッションリセット（[#725](https://github.com/gurezo/chirimen-lite-console/issues/725)）

Web Serial の物理接続と Linux シェルのログイン状態は別である。Terminal で `logout` が完了すると getty が再び `login:` を出すが、ポートは開いたままになり得る。画面状態と実セッションを一致させるため、本アプリでは **ログアウト完了を検出したら Web Serial ポートを閉じ、既存の未接続 UI へ戻す**。

### 状態モデル

| 状態 | 意味 | 主な判定 |
|------|------|----------|
| 切断済み | Web Serial 未接続。Connect ページを表示 | `SerialConnectionViewModel.isConnected === false` |
| 物理接続 | ポートは開いているがシェル未到達 | `isConnected === true` かつ `isLoggedIn === false` |
| ログイン済みシェル | 対話シェル到達後 | `PiZeroShellReadinessService.ready === true`（`isLoggedIn`） |
| ログアウト完了 | ログイン済みから getty の login 待ちへ戻った | `logoutCompletedEpoch` が増加 |

### 検出とリセットの流れ

```text
ログイン済みシェル
  -> receive$ 末尾が login: / ログイン: （isAwaitingLoginName）
  -> PiZeroShellReadinessService.logoutCompletedEpoch++
  -> ConsoleShellComponent がダイアログを閉じ disconnect()
  -> SerialConnectionOrchestrationService.disconnect$()
       ├ PiZeroSessionService.resetSession()（setupStatus idle / bootstrap 無効化）
       ├ shellReadiness.reset()
       ├ command cancel / stopReadLoop
       └ transport.disconnect$()
  -> isConnected false
  -> ConsoleShellStore.resetLayoutAfterDisconnect() + Connect ページ表示
```

要点:

- **接続直後の `login:` では発火しない**。一度シェル到達（`ready === true`）したあとに限りログアウト完了とみなす。
- **`logout` 失敗でシェルが残る場合はリセットしない**（末尾がシェルプロンプトのままなら `logoutCompletedEpoch` は増えない）。
- **再接続時**は新しい connection epoch と `resetSession()` によりオートログイン（`runAfterConnect$`）を再実行できる。
- **Editor 未保存内容**はデバイスへ書き戻せず失われるため、`EditorDraftService` が同じタブの `sessionStorage` にドラフトを保持し、再接続後に Editor を開いた際に自動復元する。

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
- [#671](https://github.com/gurezo/chirimen-lite-console/issues/671) — Web Serial 実装の追加簡素化（公開 API・薄い責務の整理）
- [#672](https://github.com/gurezo/chirimen-lite-console/issues/672) — `@libs-web-serial` の公開 API 棚卸し（本節の表・分類）
- [#673](https://github.com/gurezo/chirimen-lite-console/issues/673) — Facade / Orchestration / Pipeline の境界整理（docs / JSDoc の整合）
- [#674](https://github.com/gurezo/chirimen-lite-console/issues/674) — `SerialValidatorService` を `SerialTransportService` に統合（Pi Zero 判定の集約）
- [#676](https://github.com/gurezo/chirimen-lite-console/issues/676) — 回帰テスト・実機確認（親 #671 の受け入れ）
- [#725](https://github.com/gurezo/chirimen-lite-console/issues/725) — logout 完了後に Web Serial 接続前の状態へ戻す（本ドキュメント「ログアウト後のセッションリセット」節）
