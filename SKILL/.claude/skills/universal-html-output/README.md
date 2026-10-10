# Universal HTML Output — Claude Code Skill

**任意の入力から任意のHTML成果物を作成するためのSkill**。従来の階層テーブルの見た目を維持したまま、複数の表、自由なHTML、SVG、CSS、JavaScript、フォーム、カード等を任意の順序で組み合わせられます。テーブルを使わない出力も可能です。

## 導入

ZIPを解凍し、`universal-html-output` フォルダごと、対象プロジェクトの `.claude/skills/` に配置してください。全プロジェクトに使う場合は `~/.claude/skills/` に配置します。

```text
.claude/skills/universal-html-output/
├── SKILL.md
├── assets/
│   ├── template.html                  # 複数表＋自由HTML用のページ枠
│   └── original-hierarchy-table.html  # 元の階層表デザイン参照
├── scripts/render.py                  # JSON → HTML（標準ライブラリのみ）
├── references/data-contract.md
├── examples/
│   ├── mixed-report.json              # 自由HTML + 2表 + SVG + JS
│   ├── html-only.json                 # 表を一切使わない出力
│   ├── html-file.json                 # html_file の例
│   └── html-fragment.html
└── tests/test_render.py
```

## Claude Codeでの使用例

```text
/universal-html-output このフォルダの資料を調べ、冒頭に図と要点、
各観点ごとに別々の表、最後に補足を加えたHTMLレポートを作成して。
```

```text
/universal-html-output 現在のリポジトリのアーキテクチャを、
任意のHTMLとSVGで可視化して。テーブルが不要なら使わないで。
```

```text
/universal-html-output git diff を分析し、変更概要・関係図・影響一覧と
推奨アクションを1ページにまとめて。表の列は必要に応じて決めて。
```

## CLI

```bash
python3 .claude/skills/universal-html-output/scripts/render.py \
  -i .claude/skills/universal-html-output/examples/mixed-report.json --validate-only
python3 .claude/skills/universal-html-output/scripts/render.py \
  -i .claude/skills/universal-html-output/examples/mixed-report.json -o report.html
python3 -m unittest discover -s .claude/skills/universal-html-output/tests -v
```

- 入力形式は `blocks` 配列。`type: "html"` と `type: "table"` が混在できる。
- 表は1つずつ独立した列数・階層・列幅を持つ。ブラウザの列幅操作は保持。
- `type: "html"`、`head_html`、`tail_html`、`html_file` は完全に **信頼できるコード向け**。外部やユーザーの任意入力はそのまま実行HTMLにしない。
- CSS/JSをインラインにすれば単一HTMLで閲覧可能。外部リソースには別途ネットワークやファイルが必要。
- 旧形式 `title` + `columns` + `rows` も1表として受け付ける（互換用）。

詳しい契約と例は `references/data-contract.md` を参照してください。
