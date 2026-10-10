# universal-html-output — Claude Code Skill

**任意の入力を読み、指示された内容をオリジナルの階層テーブルHTMLレイアウトで出力するSkill** です。

## インストール

プロジェクトで使う場合：

```text
<プロジェクト>/.claude/skills/universal-html-output/
    SKILL.md
    assets/template.html
    scripts/render.py
    references/data-contract.md
    examples/example.json
```

ZIPを解凍して `universal-html-output` フォルダごと `.claude/skills/` に置いてください。
全プロジェクトで使うなら `~/.claude/skills/universal-html-output/` に置きます。

## 使用例

```text
/universal-html-output このディレクトリにある要求仕様書を読み、要求ごとの実装方針、検証観点、参照資料を階層HTMLに整理して output/requirements.html に保存
```

```text
/universal-html-output git diff を分析し、変更点と影響範囲、注意点を区分したHTMLレポートにして
```

```text
/universal-html-output 以下の議事録を決定事項・保留事項・タスクに整理してHTML化: ...
```

## データから直接レンダリング

```bash
python3 .claude/skills/universal-html-output/scripts/render.py --input .claude/skills/universal-html-output/examples/example.json --validate-only
python3 .claude/skills/universal-html-output/scripts/render.py --input .claude/skills/universal-html-output/examples/example.json --output output/demo.html
```

Python 3.10以降の標準ライブラリのみを使用します。単体HTMLなので表示にネット接続は不要です。

## 画面の動作

- 初期列幅は画面に合わせた自動幅。
- 列ヘッダー右端をドラッグして幅変更。縮小時も左側列の位置は動きません。
- 列ヘッダー右端をダブルクリックで全列自動幅に戻します。
- ブラウザのローカルストレージ利用が可能なら列幅を保存します。
- HTMLの装飾はJSONの `{ "html": "..." }`、通常文は文字列として指定します。

詳細は `SKILL.md` と `references/data-contract.md` を参照してください。
