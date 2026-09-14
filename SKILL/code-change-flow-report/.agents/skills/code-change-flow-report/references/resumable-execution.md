# 中断耐性と完了ゲート

この資料は、調査や検証の一部が失敗した場合、調整担当のコンテキストが切り替わった場合、または生成後の証跡が壊れた場合でも、完了済み作業を失わず安全な地点から再開するための実行契約を定義する。

## 保証する範囲

実行プロセスそのものを、利用者による中止や実行環境の終了後も動かし続けることはできない。代わりに、各状態遷移を永続化し、次にこのスキルが呼び出された時点で未完了タスクだけを再開する。完了条件を満たさない状態を完成として報告しない。

権限不足、比較元を決められないマージコミット、入力不足、利用者による明示的な中止は自動で推測して越えない。これらは`blocked`として理由を保存し、必要な入力が得られた後に再開する。

## 比較計画と状態ファイル

サブエージェントを起動する前に、比較計画JSONを作る。必須項目は次のとおり。

全体の形は[`assets/comparison-plan.example.json`](../assets/comparison-plan.example.json)を参照する。ただし、例のパスとGit参照をそのまま使用せず、対象リポジトリから取得した値へ置き換える。

利用者が内部作業場所を指定していない場合、最終HTMLと同じディレクトリに`.{HTMLファイル名}.code-change-flow-work`という作業ディレクトリを作る。その直下へ`comparison-plan.json`、`run-state.json`、`review-data.json`を置き、コミット別証跡を`evidence/`以下へ置く。次の呼び出しではこの固定名の`run-state.json`を最初に探す。完成後も`assert-completed`が証跡を再検査できるよう、利用者が削除を依頼するまで内部作業ディレクトリを残す。利用者へ成果物として案内するファイルはHTMLだけにする。

- `schemaVersion`: `1`。
- `repositoryPath`: 対象Gitワークツリーの絶対パス。
- `reviewDataPath`: 統合JSONの絶対パス。
- `outputPath`: 最終HTMLの絶対パス。
- `workerCapacity`: 調査を同時実行できる件数。
- `maxWorkerAttempts`: 調査・検証タスクの一時失敗を再試行する上限。既定値は`3`、上限は`20`。
- `maxCorrectionRounds`: 検証NG後に調査結果を修正できる回数。既定値は`2`、上限は`20`。
- `requestedCommitOrder`: 表示順のコミットID。
- `commits`: 各コミットの`commitHash`、`sourceKind`、`targetRef`、`comparisonBase`。未コミット差分では`initialSnapshotSha256`も含める。

`repositoryPath`は`git rev-parse --show-toplevel`の結果と完全一致させる。コミット参照は実在する完全なオブジェクトIDとし、`comparisonBase`は対象コミットの実在する親にする。ルートコミットだけはGitの空ツリーを使用する。未コミット差分では`comparisonBase`を現在の`HEAD`にし、`reviewDataPath`と`outputPath`を対象リポジトリ外へ置く。

状態ファイルは次のコマンドで初期化する。

```bash
node <skill-root>/scripts/manage-run-state.mjs init <comparison-plan.json> <run-state.json>
```

既存の状態ファイルがある場合は再初期化しない。`status`で読み込み、計画のハッシュと対象Git状態が一致することを確認してから続行する。

```bash
node <skill-root>/scripts/manage-run-state.mjs status <run-state.json>
```

主要な更新コマンドは次の形で使用する。`role`は`investigator`、`verifier`、`correction`、`outcome`は`completed`、`passed`、`issues`、`failed`、`interrupted`のうち、その役割で許可された値にする。

```bash
node <skill-root>/scripts/manage-run-state.mjs start-task \
  <run-state.json> <commit-id> <role> <task-id>
node <skill-root>/scripts/manage-run-state.mjs finish-task \
  <run-state.json> <task-id> <outcome> [evidence.json] [reason]
node <skill-root>/scripts/manage-run-state.mjs recover-task \
  <run-state.json> <task-id> <reason>
node <skill-root>/scripts/manage-run-state.mjs mark-integrated \
  <run-state.json> [review-data.json]
```

各コマンドの引数を推測しない。構文が不明な場合は引数なしでスクリプトを実行し、表示されるUsageを確認する。

状態ファイルの更新は、同名のロックディレクトリとハートビート付きリースで直列化し、一時ファイルを書いてからrenameする。PIDだけでは所有者を判定せず、所有者が停止してハートビートの期限が切れたロックは、回収猶予後に自動回収する。状態を書き込む直前にもリース所有権を再確認する。これにより、複数タスクが同時に完了しても一方の更新で他方を失わず、所有者プロセスが強制終了されても次の呼び出しで再開できる。各更新では`stateIntegritySha256`を状態全体から再計算し、次回の読み込み時に一致しなければ直接改変または途中書き込みとして拒否する。

## 状態遷移

| 状態 | 意味 | 次に行うこと |
|---|---|---|
| `running` | 未完了の調査、検証、修正がある | `status`が示す実行可能タスクを開始する |
| `ready-for-generation` | 全コミットの独立検証と統合が完了した | 生成前検査を実行する |
| `publishing` | 検証済み一時HTMLを最終パスへ移動している | 出力の実在とハッシュを確認する |
| `awaiting-final-review` | HTML生成済みだが実画面確認が未完了 | 最終レビュー証跡を作る |
| `completed` | 全証跡、Git、JSON、HTML、最終レビューが再検査済み | この状態でだけ完成を報告する |
| `blocked` | 権限、入力、上限到達など自動解決できない理由がある | 理由を利用者へ示し、解決後に`resume`する |

## タスクの記録

タスクを起動する直前に`start-task`を実行し、担当コミット、役割、エージェントのタスクIDを保存する。終了時は`finish-task`で成功、検証NG、一時失敗のいずれかと証跡ファイルを保存する。成功扱いにできるのは、証跡が次を満たす場合だけである。

- レポートJSONと同じディレクトリ以下にある、シンボリックリンクではない通常のJSONファイル。
- 役割、タスクID、コミット、対象参照、比較元が状態と一致する。
- 調査証跡は`completed`と現在の調査単位SHA-256を持つ。
- 検証証跡は`freshContext: true`、問題一覧、問題件数、検証対象SHA-256を持つ。
- 合格検証のSHA-256が現在の調査証跡と一致する。

空のJSONや後から書き換えられた証跡を成功扱いにしない。

一時失敗または中断は、`maxWorkerAttempts`の範囲で同じ役割を新しいタスクとして再実行する。記録上`running`だが実際には終了しているタスクは、存在を確認したうえで`recover-task`によりそのタスクだけを中断扱いへ戻す。別の実行中タスクを一括で巻き戻さない。すべての実行中タスクが消失したことを確認できた場合だけ`recover-running`を使用できる。

あるタスクが上限へ達して状態全体が`blocked`になっても、その時点ですでに`running`だった他タスクの`finish-task`または`recover-task`は受け付ける。実行中タスクを残したままブロッカー解消へ進まず、全担当の結果または中断を状態へ確定してから`resume`または対象試行の`invalidate-task`を行う。

検証NGでは調査担当が修正証跡を作り、過去の検証担当とは異なる新規コンテキストへ再検証させる。上限に達した場合は`blocked`へ遷移する。利用者が続行を明示した場合、`resume`で上限を増やせるが、未解決の全ブロッカーを解消できる値でなければ状態を変更しない。

## 並列実行の証明

同じ調査バッチの複数タスクには開始時刻と終了時刻を記録する。最終ゲートでは、最初の調査試行の実行区間が実際に重なっていることを確認する。同じバッチ番号を書いただけの逐次実行は拒否する。

## 統合、生成、公開

全コミットの最終検証が合格した後だけ統合する。統合後に`mark-integrated`を実行し、次を確認する。

- 比較計画、実行状態、レポートJSONのコミット件数、順序、担当、バッチ、証跡が一致する。
- 対象Git参照が実在し、比較元が実際の親または空ツリーである。
- レポートのコミットメッセージがGitの件名と一致する。
- 全階層の`filePath`と行範囲から取得した実コードが`beforeCode`、`afterCode`と一致する。
- 未コミット差分の現在スナップショットが開始時と一致する。

生成は状態ファイルを第3引数に渡す。

```bash
bash <skill-root>/scripts/generate-report.sh \
  <review-data.json> <review-report.html> <run-state.json>
```

生成スクリプトは検証済み一時ファイルを作り、生成後検査が成功した場合だけ最終パスへrenameする。失敗時は既存HTMLを変更せず、一時ファイルを削除する。生成後の状態は`awaiting-final-review`であり、まだ完成ではない。

## 最終レビューと完成判定

HTMLを直接開いて確認した担当は、次を含む最終レビューJSONを状態ファイルと同じ作業領域へ保存する。

JSONの形は[`assets/final-review.example.json`](../assets/final-review.example.json)を参照し、`outputSha256`は確認直前のHTMLから計算する。

- `schemaVersion: 1`
- `reviewerTaskId`: 最終確認担当の一意なタスクID。
- `status: "passed"`
- `reviewDataSha256`: 確認対象にした統合JSONのSHA-256。
- `outputSha256`: 確認したHTMLのSHA-256。
- `checks`: コミットタブ、差分色、接続線、独立フロー、入れ子開閉、文章折り返し、原文プロンプトへの再照合を表す真偽値。

すべての確認が真である証跡を`mark-completed`へ渡した後、`assert-completed`を実行する。`assert-completed`は状態名だけを見ず、Git参照、現在の証跡ファイルのSHA-256、レポートJSON、HTML、最終レビューを再検査する。

完成後に証跡、JSON、HTML、Git状態のいずれかが変わった場合、`assert-completed`は失敗する。修復する場合は`reset-integration`で生成前へ戻し、壊れた試行を`invalidate-task`で無効化して、新しい担当による再検証からやり直す。実行中タスクが1件でもある状態では無効化しない。

## 調整担当の継続ループ

調整担当は次を繰り返す。

1. `status`を読む。
2. 実行可能な調査・検証・修正を、利用可能枠まで起動する。
3. 各タスク結果を到着順に状態へ保存する。
4. 一時失敗は上限内で再試行する。
5. 全コミット合格後に統合、生成、最終レビューを行う。
6. `assert-completed`が成功するまで完成を報告しない。

通常のタスク失敗、タイムアウト、担当コンテキストの終了だけを理由に調整担当が最終回答へ移ってはならない。`blocked`になった場合だけ、保存した理由と必要な入力を示して利用者へ判断を求める。
