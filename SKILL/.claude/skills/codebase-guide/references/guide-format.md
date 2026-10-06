# guide.json の書式と書き方

ガイドは `.codebase-guide-out/ガイド/<ガイド名>/guide.json` から `build-guide.mjs` が生成する。
AIが書くのは guide.json だけで、HTMLは書かない。行番号・差分の行・全体図の配置・リンクはスクリプトが計算する。

## 全体の形

```json
{
  "title": "POST /templates の処理フロー",
  "request": "依頼文をそのまま",
  "diff": "main...HEAD",
  "review": true,
  "summary": ["要約1", "要約2"],
  "steps": [ ... ],
  "notes": [ ... ],
  "unverified": [ ... ],
  "flow": { ... },
  "noteTypes": { ... }
}
```

| 項目 | 必須 | 内容 |
|---|---|---|
| `title` | 必須 | ガイドの題名。表紙とフォルダーツリーの一覧に出る。 |
| `request` | 必須 | 依頼文。表紙に出る。 |
| `diff` | 任意 | 差分の範囲。`"working"`（未コミットの変更）、`"A..B"`、`"A...B"`（merge-base から）、`"<コミット>"`（そのコミット1件）。差分が対象でなければ `null`。コミット指定のときは、そのコミットの版のコードを表示する。 |
| `review` | 任意 | レビュー依頼なら `true`。`false`（既定）のときに指摘を書くとエラーになる。 |
| `summary` | 必須 | 表紙の要約。1行1要素。 |
| `steps` | 必須 | 順路のステップ（下記）。 |
| `notes` | 任意 | 指摘と、ステップに属さない補足の解説（下記）。 |
| `unverified` | 任意 | 未確認事項。文字列か `{ "text": "...", "step": "s3" }`。各ステップの `unverified` も自動で表紙に集める。 |
| `flow` | 任意 | 全体図にノードや矢印を足す（下記）。 |
| `noteTypes` | 任意 | 解説・指摘の種類を足す、または表示名や色を変える（下記）。 |

文字列の中では、バッククォートで囲んだ部分がコード表記になる。空行で段落が分かれる。HTMLタグは書かない（そのまま文字として表示される）。

## steps（順路）

```json
{
  "id": "s4",
  "file": "backend/src/services/template.service.ts",
  "anchor": "const id = await this.repo.insert",
  "anchorEnd": "return { id }",
  "kind": "call",
  "parent": "s3",
  "title": "TemplateService.create",
  "summary": "本体を登録したあと、tags があればタグも登録する",
  "body": "解説の本文",
  "branches": [{ "when": "条件", "then": "結果", "to": "s5" }],
  "links": [{ "to": "s5", "label": "表示名" }],
  "unverified": "確かめられなかったこと"
}
```

| 項目 | 必須 | 内容 |
|---|---|---|
| `id` | 必須 | 英数字・`_`・`-`。ほかから参照する名前。 |
| `file` | 必須 | リポジトリのルートからの相対パス。 |
| `anchor` | 必須 | 対象の行にあるコード片（1行の部分一致）。行番号は書かない。 |
| `anchorEnd` / `lines` | 任意 | 範囲の終わり。`anchorEnd` は終わりの行のコード片（`anchor` の行から下を探す）、`lines` は行数。どちらも無ければ1行。 |
| `occurrence` | 任意 | `anchor` が複数行に一致するとき、何番目を使うか（1から）。 |
| `kind` | 任意 | `entry`（入口）、`branch`（分岐）、`call`（呼び出し。既定）、`process`（処理）、`data`（データ操作）、`external`（外部連携）。 |
| `parent` | 任意 | 呼び出し元のステップ。コールスタックと「呼び出し元へ」ボタンに使う。 |
| `title` | 必須 | 関数名など、短い名前。 |
| `summary` | 任意 | 表紙の順路表に出す1行の説明。 |
| `body` | 必須 | 解説の本文。 |
| `branches` | 任意 | 分岐の表。`to` を書くと、その分岐の先のステップへリンクし、全体図でも矢印でつなぐ。`to` が無い分岐は、全体図で「処理の終わり」として描く。 |
| `links` | 任意 | 解説の下に出すリンク。省略すると、`parent` が自分になっているステップ（呼び出し先）へのリンクを自動で出す。 |
| `unverified` | 任意 | このステップで確かめられなかったこと。解説内と表紙に出る。 |

ステップが差分を含むかどうかは、スクリプトが差分の行から判定する。書かない。

順路の組み立て方:

- 入口（ルート定義、ジョブ、イベント受信、CLIのコマンドなど）から始め、実行される順に並べる。
- `parent` は「そのステップを呼び出しているステップ」にする。ミドルウェアのように、呼び出し元ではないが先に実行される処理は、`parent` を入口にする。続く処理へは、`branches` の `to` でつなぐ。
- 依頼に関係しない呼び出しはステップにしない。ステップの数は、流れを追うのに必要な最小限にする。

## notes（指摘と補足）

```json
{
  "type": "bug",
  "file": "backend/src/services/template.service.ts",
  "anchor": "insertTags(db, id, dto.tags)",
  "title": "タグ登録がトランザクションの外で実行される",
  "body": "根拠と影響",
  "fix": "        await this.repo.insertTags(trx, id, dto.tags)",
  "step": "s4"
}
```

| 項目 | 必須 | 内容 |
|---|---|---|
| `type` | 必須 | `explain`（解説）、`bug`（指摘（バグ））、`concern`（指摘（懸念））、`improve`（指摘（改善））。`noteTypes` で足した種類も使える。 |
| `file` / `anchor` / `anchorEnd` / `lines` / `occurrence` | 必須（anchorまで） | steps と同じ。 |
| `title` | 必須 | 1行の見出し。 |
| `body` | 必須 | 本文。 |
| `fix` | 任意 | 修正案のコード（差し替える行）。分かるときだけ書く。複数行は `\n` で区切る。 |
| `step` | 任意 | どのステップに属するか。省略すると、同じファイルで範囲を含むステップ、なければ直前のステップに割り当てる。 |

ステップの範囲内にある注釈は、その範囲の末尾にまとめて表示する。範囲の外の注釈は、対象の行の直後に表示する。

## 指摘の書き方（review が true のとき）

指摘はレビュー依頼のときだけ書く。レビュー依頼でなければ、`type` は `explain` だけにする。

| 種類 | 書く条件 | 本文に書くこと |
|---|---|---|
| 指摘（バグ） | 特定の入力や状態で、誤った結果・例外・データの不整合になることを、コードから示せる | どの入力・状態で、何が起き、どう困るか |
| 指摘（懸念） | 条件によっては問題になる。または、コードからは安全だと確かめられない（設計、運用、性能、セキュリティ） | どの条件で問題になるか、何を確かめれば解消するか |
| 指摘（改善） | 動作は正しいが、読みやすさ・保守性・性能を良くできる | 何をどう変えると、何が良くなるか |

- 1件に問題を1つだけ書く。同じ問題を複数の場所に書かない。
- バグと言い切れないものはバグにしない。根拠がコードで示せないものは指摘にせず、`unverified` に書く。
- 差分の外にある既存の問題も、依頼の流れの上にあれば指摘してよい。その場合は本文で「今回の差分ではなく既存のコード」と分かるように書く。
- 問題が見つからなければ、指摘は書かない。表紙に「指摘はない」と出る。

## 解説の書き方

- そのステップが何をして、次にどこへ進むかを書く。コードを1行ずつ言い換えない。
- 差分を含むステップでは、何が変わり、それで動きがどう変わるかを書く。
- 呼び出し関係は、名前の一致（下準備メモの呼び出し候補）だけで決めない。コードで確かめる。DI・動的な呼び出し・イベント経由などで静的に追えない箇所は、推測でつながずに `unverified` に書く。
- 常体（だ・である）で書き、主語と対象を具体的に書く。「適切に」「いい感じに」のような曖昧な言葉を使わない。

## flow（全体図）

既定では、steps の `parent` と `branches` から全体図を自動で作る。`branches` の `to` で入るステップは分岐からの矢印、それ以外は `parent` からの矢印でつなぐ。

DBテーブルや外部サービスを足すときは `nodes` と `edges` を書く。

```json
"flow": {
  "nodes": [
    { "id": "t1", "kind": "db", "label": "template_summaries" },
    { "id": "api", "kind": "external", "label": "決済API", "sub": "POST /charges" }
  ],
  "edges": [
    { "from": "s5", "to": "t1" },
    { "from": "s6", "to": "api", "label": "失敗時は再試行" }
  ]
}
```

- `kind` は `db`、`external`、`result`（処理の終わり）、`other`。
- `edges` の `from` / `to` には、ステップの `id` かノードの `id` を書く。
- 自動の全体図を使わず全部書く場合は `"auto": false` にする。

## noteTypes（種類を足す）

```json
"noteTypes": {
  "question": { "label": "指摘（質問）", "short": "質問", "color": "#c586c0", "shape": "square" }
}
```

- 名前は英小文字・数字・`-`。
- `shape` は `square`、`circle`、`triangle`、`diamond`。
- `finding` を `false` にすると、指摘の一覧には出ない補足の種類になる（既定は `true`）。
- 既定の種類（`explain`、`bug`、`concern`、`improve`）も、同じ書き方で表示名や色を変えられる。

## 例

```json
{
  "title": "POST /templates の処理フロー",
  "request": "タグ登録を追加した差分をレビューしたい。POST /templates から DB 登録までの流れを追い、問題があれば指摘して",
  "diff": "HEAD~1..HEAD",
  "review": true,
  "summary": [
    "リクエストは `auth` ミドルウェアで認証され、失敗すると 401 を返して終わる。",
    "成功すると Controller → Service → Repository の順に呼ばれ、`template_summaries` に本体を登録する。",
    "今回の差分で、`tags` があるときだけ `template_summary_tags` にも登録するようになった。ただし、タグ登録がトランザクションの外で実行されるバグがある。"
  ],
  "steps": [
    { "id": "s1", "file": "backend/src/routes/templates.ts", "anchor": "router.post('/templates'", "kind": "entry",
      "title": "POST /templates", "summary": "ルート定義。auth を通ってから Controller へ進む",
      "body": "`POST /templates` の入口。先に `auth` ミドルウェアを通り、通過したときだけ `controller.create` が呼ばれる。" },
    { "id": "s2", "file": "backend/src/middlewares/auth.ts", "anchor": "if (!token) {", "anchorEnd": "invalid token", "kind": "branch", "parent": "s1",
      "title": "auth（認証）", "summary": "認証できないと 401 を返して終了",
      "body": "ここで処理が分かれる。トークンが無いか検証に失敗すると 401 を返して終わり、以降の処理は実行されない。",
      "branches": [
        { "when": "Authorization ヘッダーが無い", "then": "401 unauthorized を返して終了" },
        { "when": "トークンの検証に失敗", "then": "401 invalid token を返して終了" },
        { "when": "検証に成功", "then": "next() で次へ進む", "to": "s3" }
      ] },
    { "id": "s3", "file": "backend/src/controllers/template.controller.ts", "anchor": "this.service.create(dto, req.user.id)", "parent": "s1",
      "title": "TemplateController.create", "summary": "リクエスト本文を dto に変換して Service へ渡す",
      "body": "リクエスト本文を `CreateTemplateDto` に変換してサービスへ渡す。成功すると 201 で `{ id }` を返す。",
      "unverified": "`req.user` の型を拡張している宣言ファイルを特定できていない。" },
    { "id": "s4", "file": "backend/src/services/template.service.ts", "anchor": "const id = await this.repo.insert", "anchorEnd": "return { id }", "parent": "s3",
      "title": "TemplateService.create", "summary": "本体を登録したあと、tags があればタグも登録する",
      "body": "本体を登録したあと、`tags` が 1 件以上あるときだけタグも登録するようになった。本体の登録はトランザクション `trx` の中で行う。" }
  ],
  "notes": [
    { "type": "bug", "file": "backend/src/services/template.service.ts", "anchor": "insertTags(db, id, dto.tags)",
      "title": "タグ登録がトランザクションの外で実行される",
      "body": "`trx` ではなく `db` を渡しているため、タグ登録は別の接続で実行される。タグ登録が失敗しても本体の登録は取り消されない。",
      "fix": "        await this.repo.insertTags(trx, id, dto.tags)" }
  ],
  "flow": {
    "nodes": [{ "id": "t1", "kind": "db", "label": "template_summaries" }],
    "edges": [{ "from": "s4", "to": "t1" }]
  }
}
```
