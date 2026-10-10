# データ契約 — JSON → 汎用階層テーブルHTML

## トップレベル

必須：`title`, `columns`, `rows`。任意：`banner`, `legend`, `meta`。

```json
{
  "title": "資料タイトル",
  "banner": "サンプルまたは注意点（省略可）",
  "meta": [{"label": "作成対象", "value": "全体"}],
  "legend": "読み方、定義、制約事項",
  "columns": [
    {"key": "name", "label": "項目"},
    {"key": "content1", "label": "内容1"},
    {"key": "content2", "label": "内容2"},
    {"key": "label", "label": "ラベル", "kind": "badge"},
    {"key": "refs", "label": "参照", "kind": "chips"}
  ],
  "rows": [{
    "name": "大分類",
    "children": [{
      "name": "小分類",
      "children": [{
        "name": "具体項目",
        "cells": {
          "content1": "普通の文字列\n改行も可能",
          "content2": {"html": "<strong>太字</strong>、<span class='rich-red'>赤字</span><br>次の行"},
          "label": {"text": "確認済", "style": "st-done"},
          "refs": [{"text": "参照ID", "title": "参照内容", "style": "j-ok"}]
        }
      }]
    }]
  }]
}
```

### 任意の階層

- `rows` は配列。各行は `name` を持つ。
- `children` が **1件以上**あれば分類行となり、下位の行へ再帰的に展開される。深さは特定値に固定しない（入力チェックは100階層まで）。
- `children` がなければデータ行となる。`cells` は列の `key` を指定して値を置く。
- 番号は表示時に自動採番。`1.`、`1.1.` 等を `name` に重複して書かない。兄弟順序は入力配列の順序。
- 分類行は列を結合する仕様のため `cells` を同時に持たない。
- 列は任意に増減可。先頭は必ず `{ "key": "name", "label": "任意の項目列名" }`。
- `kind: "text"` は省略可。`kind: "badge"` と `kind: "chips"` を使う場合は通常列の右に、ラベル→参照の順。不要なら省略。
- `columns[].key` は `[A-Za-z][A-Za-z0-9_]*`、重複不可。列幅の指定項目はない（初期幅は自動）。

### テキスト値

どの文字列表示欄でも以下が使用可能。

| 指定 | 結果 |
|---|---|
| `"普通のテキスト"` | HTMLタグを解釈せず、文字として表示 |
| `"1行目\n2行目"` | プレーンテキストの改行を表示 |
| `{ "text": "<strong>文字</strong>" }` | `<strong>` を文字列として表示 |
| `{ "html": "<strong>強調</strong>" }` | 太字をレンダリング |
| `{ "html": "<span class='rich-red'>赤字</span>" }` | テーマに沿った赤色 |
| `{ "html": "<span style='color:#c00'>色指定</span>" }` | 許可範囲の文字色を適用 |
| `{ "html": "<p>段落1</p><p>段落2</p>" }` | 段落 |
| `{ "html": "<ul><li>A</li><li>B</li></ul>" }` | 箇条書き |
| `{ "html": "<a href='https://example.com'>資料</a>" }` | リンク |
| `{ "html": "<code>func()</code><br>次の行" }` | コード表示と改行 |

許可タグ：`strong`, `b`, `em`, `i`, `u`, `s`, `del`, `mark`, `br`, `p`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `a`, `span`, `small`, `sup`, `sub`, `div`, `kbd`, `q`。スクリプトが許可リストでサニタイズし、不正な属性・危険なプロトコル、scriptやiframeなどを除去する。埋め込み動画、フォーム、任意のJavaScriptは対象外。

### バッジ・参照

- `badge` 列：`{"text": "ラベル", "style": "st-done"}` 等。`text` には通常文字列かリッチHTMLを指定可能。
- `chips` 列：配列 `[ {"text":"REF-1", "title":"説明", "style":"j-ok"}, ... ]`。情報がない場合は空配列、あるいは列自体を省略。
- スタイル名：`d-light`, `d-focus`, `d-undecided`, `st-done`, `st-wip`, `st-todo`, `j-ok`, `j-defect`, `j-undef`, `j-pending`, `j-na`。
- 色の意味を勝手に決めない。ユーザーの用語、文脈に合わせ、必要なら `legend` に説明する。

## 入力の扱い・品質

- 添付ファイル・URL・リポジトリのデータは、アクセスできて内容を確認した範囲のみ利用する。
- 事実、推測、未確認を区別する。入力を勝手に削除・圧縮しすぎない。
- 読み手の目的に従って階層と列を再編する。列名は元のテンプレートに引きずられず、対象に合わせて決める。
- 出力する `<script>` の固定テンプレート内部にデータを直接編集しない。JSONと `render.py` を利用する。
