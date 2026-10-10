# データ契約 — 任意HTMLブロック + 独立した階層テーブル

## 概要

最上位にページ設定と、順序付きの **`blocks`** を置く。

```json
{
  "title": "レポート名",
  "banner": "任意の注意表示",
  "meta": [{"label":"対象", "value":"任意の情報"}],
  "legend": "読み方",
  "head_html": "<style>.my-card { border-radius: 8px; }</style>",
  "blocks": [
    {"type":"html", "html":"<p>普通の文章。<strong>太字</strong>や図も可能。</p>"},
    {
      "type":"table", "id":"comparison", "title":"比較一覧",
      "columns":[
        {"key":"name", "label":"項目"},
        {"key":"summary", "label":"概要"},
        {"key":"status", "label":"状態", "kind":"badge"}
      ],
      "rows":[{"name":"分類", "children":[
        {"name":"選択肢A", "cells":{"summary":"文章\n2行目", "status":{"text":"確認済","style":"st-done"}}}
      ]}]
    },
    {"type":"html", "html":"<div class='my-card'><svg viewBox='0 0 30 30'><circle cx='15' cy='15' r='12'/></svg></div>"},
    {
      "type":"table", "id":"notes", "title":"別表",
      "columns":[{"key":"name", "label":"項目"}, {"key":"detail", "label":"詳細"}],
      "rows":[{"name":"情報1","cells":{"detail":"例"}}]
    }
  ],
  "tail_html": "<script>console.log('ページの読み込み完了');</script>"
}
```

## トップレベル

| フィールド | 必須 | 意味 |
|---|---|---|
| `title` | はい | ページタイトル（プレーンテキストまたは `{ "html": ... }`） |
| `banner` / `legend` | いいえ | ページ上部の注意・凡例。省略すると表示しない |
| `meta` | いいえ | ヘッダー情報 `[{"label":...,"value":...}]` |
| `blocks` | はい（推奨） | 1個以上の `html` / `table` ブロックを順番に並べる |
| `head_html` | いいえ | `<head>` に挿入する **未加工の任意HTML**（通常CSS、meta等） |
| `tail_html` | いいえ | ページ本文とテーブル生成用スクリプトの後に挿入する **未加工の任意HTML**（通常JavaScript） |

**テーブルは0個でよい**。`blocks` に `html` だけがあるページは有効。互換用として旧形式の `columns` + `rows` も受け付けるが、`blocks` と旧形式を同時に使用しない。

## 自由HTMLブロック

次のどちらか一方を指定する。

```json
{"type":"html", "html":"<section><h2>自由な表現</h2><p>文章</p></section>"}
```

```json
{"type":"html", "html_file":"sections/interactive-dashboard.html"}
```

- `html`: HTML断片をそのまま `<main>` 内の指定位置に挿入する。HTML要素の種類に制限はない。CSS, JS, SVG, Canvas, iframe, forms, video, 一般のtable要素も対象。前後に独自のラッパーは付与しない。
- `html_file`: 入力JSONを置いたディレクトリ以下の相対パスのみ。UTF-8のHTML断片をそのまま読み込む。大きなCSS/SVG/HTML等の管理に使える。
- **明示的なraw HTMLであり、サニタイズしない。信頼できるコードだけ記述すること。** 外部から読み取った文章は、HTMLで表すときエスケープして挿入する。
- 自前のインタラクション用JavaScriptは `tail_html` を推奨。HTML内の `<script>` も通常のブラウザ処理に従う。
- `head_html` にCSS、`tail_html` にJSを入れるとコードを見通しやすくできる。どちらも任意のHTML断片として扱う。
- `<html>` や `<body>` など文書全体のタグではなく、**その場所に置くHTML断片**を記述する（ページ殻はテンプレートが担当）。
- 完全オフライン動作には、リソースをインライン埋め込みする必要がある。外部URLはそのまま残る。

## 階層テーブルブロック

```json
{
  "type":"table", "id":"unique-id", "title":"表のタイトル", "intro":"説明（任意）",
  "columns":[
    {"key":"name", "label":"項目"},
    {"key":"content1", "label":"内容1"},
    {"key":"content2", "label":"内容2"},
    {"key":"label", "label":"ラベル", "kind":"badge"},
    {"key":"refs", "label":"参照", "kind":"chips"}
  ],
  "rows":[
    {"name":"大分類", "children":[
      {"name":"任意の深さの子分類", "children":[
        {"name":"項目名", "cells":{
          "content1":"通常文\n改行も表示",
          "content2":{"html":"<strong>太字</strong> と <span class='rich-red'>赤字</span>"},
          "label":{"text":"進行中", "style":"st-wip"},
          "refs":[{"text":"参照番号", "style":"j-ok", "title":"参照情報"}]
        }}
      ]}
    ]}
  ]
}
```

- `id` は省略可能だが、表間で安定した列幅状態を保ちたい場合に **表ごとに異なる固定ID** を推奨。値は英数字および `-` `_`、先頭は英字。重複不可。省略時は `table-1`, `table-2`, ...。
- 各表の `columns`、`rows`、`title`、`intro` は独立。2列の表も9列の表も混在可能。
- `columns` と `rows` は必須。列は任意の個数。**先頭列の `key` は必ず `name`**。 `kind` は既定 `text`、`badge`、`chips` が使える。`badge` / `chips` がある場合は通常列の右側に、`badge` → `chips` の順番で置く。
- `columns[].key` は英字開始、英数字と `_`。重複不可。
- `children` が1件以上ある行は全列結合の分類行となり、その行では `cells` を使わない。子がない行はデータ行。最大100階層。各階層の兄弟で番号は自動的に `1.`, `2.` ... と採番。
- 初期幅は表示領域に自動フィット。列ヘッダー端のドラッグで幅を変更、ダブルクリックで自動幅復帰。幅の変更は **表ごとに独立**。左側の列位置は他列を縮めても動かさない。

### テーブル内の通常テキスト・リッチHTML

| 記法 | 表現 |
|---|---|
| `"通常のテキスト"` | HTMLを解釈しない、改行可 |
| `{ "text": "<b>タグ</b>" }` | タグは文字として見せる |
| `{ "html": "<strong>太字</strong>" }` | 強調タグの表示 |
| `{ "html": "<span class='rich-red'>赤字</span>" }` | テーマ色 |
| `{ "html": "<ul><li>A</li><li>B</li></ul>" }` | 箇条書き |
| `{ "html": "<a href='https://example.com'>資料</a>" }` | ハイパーリンク |

テーブル内のリッチHTMLはスクリプトで **許可タグ/属性にサニタイズ**する。使用可：`strong`, `b`, `em`, `i`, `u`, `s`, `del`, `mark`, `br`, `p`, `ul`, `ol`, `li`, `blockquote`, `code`, `pre`, `a`, `span`, `small`, `sup`, `sub`, `div`, `kbd`, `q`。悪意あるイベント属性、script、iframe等は除去する。

ラベルスタイル：`d-light`, `d-focus`, `d-undecided`, `st-done`, `st-wip`, `st-todo`, `j-ok`, `j-defect`, `j-undef`, `j-pending`, `j-na`。列の色の意味は目的に応じて定義する。

**任意HTML表現のために、テーブル内のリッチHTML制限を外さない。** 動画や操作UIなどを表示する必要がある場合は自由HTMLブロックを使う。

## 検証と互換性

- `--validate-only` で契約・参照ファイルの存在・JSON埋込可否を検証する。
- HTML出力は `--output`。既存成果物を上書きするには `--overwrite`。
- 元の見た目の参照：`assets/original-hierarchy-table.html`。ただし自由HTMLが標準HTMLタグを独自スタイルで使えるように、**新ページの表固有CSSは `.tree` にスコープされている**（表の表示結果は元のCSSと同じ）。
- 旧契約の `{ "title": ..., "columns": [...], "rows": [...] }` は単一テーブルへ自動変換する。自由HTMLと複数テーブルを使う場合は新しい `blocks` 形式を使用する。
