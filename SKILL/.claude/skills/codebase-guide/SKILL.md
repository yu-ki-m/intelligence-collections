---
name: codebase-guide
description: リポジトリ全体を探索し、各ファイルをVS Code風の閲覧用HTMLへ変換して .codebase-guide-out/ に出力する。ディレクトリ構造を保持し、フォルダーツリー.html から全ファイルへ移動できるようにする。引数に依頼文がある場合は、差分に関係するコードの流れやエンドポイントからの処理フローをたどる「ガイド」（順路・解説・全体図。レビュー依頼ならバグ・懸念・改善の指摘も）を .codebase-guide-out/ガイド/ に生成し、コード読解を補助する。
---

# Codebase Guide

## 目的

リポジトリの内容をブラウザだけで読める静的HTMLへ変換する。
さらに、依頼文に合わせて、読むべきコードを順にたどれる「ガイド」を生成する。

AIが1ファイルずつ本文を読み込んでHTMLを書かない。ファイル列挙、読み込み、HTMLエスケープ、ページ生成、リンク生成、差分の解析、全体図の配置はスクリプトに任せる。AIは、どこを読むかを決め、解説と指摘を書くことに専念する。

## 実行モード

| スキルの引数 | モード |
|---|---|
| 依頼文が無い | 通常生成。リポジトリ全体を `.codebase-guide-out/` に変換する。 |
| 依頼文がある（例: `main...HEAD の差分をレビューしたい`、`POST /templates の処理の流れを知りたい`） | ガイド生成。`.codebase-guide-out/` が無い、または古い場合は、通常生成も自動で行う。 |

## 出力仕様

リポジトリルートに `.codebase-guide-out/` を生成する。

例:

```text
repository/
├─ src/
│  ├─ index.ts
│  └─ app/service.ts
└─ .codebase-guide-out/
   ├─ フォルダーツリー.html
   ├─ .codebase-guide.json   … 通常生成の記録（ファイル一覧と除外設定）
   ├─ src/
   │  ├─ index.ts.html
   │  └─ app/
   │     └─ service.ts.html
   └─ ガイド/
      └─ <ガイド名>/
         ├─ 表紙.html                  … 要約・指摘の一覧・全体図・順路・未確認事項・変更ファイル
         ├─ src/app/service.ts.html    … 注釈付きのコードページ（順路に出てくるファイルだけ）
         ├─ guide.json                 … AIが書く入力
         ├─ guide.brief.md             … 下準備メモ
         └─ guide.meta.json
```

必須条件:

1. 元ファイルの相対ディレクトリ構造を `.codebase-guide-out/` 配下に保持する。
2. 元ファイル名の末尾に `.html` を追加する。`index.ts` は `index.ts.html` とする。
3. `フォルダーツリー.html` はリポジトリ全体の階層を表示し、各ファイル名を対応する変換HTMLへのリンクにする。ガイドがある場合は、ガイドの一覧も表示する。
4. 各コードページはVS Code風のダークUIとし、次を表示する。
   - ファイル名
   - リポジトリルートからの相対パス
   - 行番号
   - コード本文
   - シンタックスハイライト（キーワード、文字列、数値、コメント、関数名等）
   - 左側のExplorer風ツリー（iframeを使わず、各ページに直接埋め込む）
5. Explorerのファイルリンクから別ファイルへ移動できるようにする。
6. シンタックスハイライトは生成時にHTMLへ埋め込み、ブラウザ表示時に外部CDNやnpmパッケージを必要としない。TypeScript/JavaScript、Java/Kotlin、Python、Go、Rust、C/C++/C#、Shell、SQL、JSON、YAML/TOML/INI/Properties、HTML/XML、CSS系、Markdown、GraphQLを少なくとも識別する。
7. `.git/` と生成先 `.codebase-guide-out/` 自身は必ず変換対象から除外する。
8. Gitリポジトリでは、原則として `git ls-files -co --exclude-standard` を利用し、`.gitignore` 等でignoreされたファイルを変換しない。
9. `.gitignore` に書かれていなくても、依存ライブラリ、ビルド成果物、キャッシュ、テスト出力、ローカル状態など、一般にソースコード閲覧対象ではないものをデフォルト除外する。
10. デフォルト除外の代表例は次の通り。
   - 依存: `node_modules/`, `vendor/`, `.venv/`, `venv/`, `env/`, `__pypackages__/`
   - ビルド: `dist/`, `build/`, `out/`, `target/`, `bin/`, `obj/`, `.next/`, `.nuxt/`, `.output/`, `.svelte-kit/`, `.astro/`
   - キャッシュ: `.cache/`, `.parcel-cache/`, `.turbo/`, `.nx/`, `.vite/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `__pycache__/`, `.gradle/`, `.m2/`
   - テスト出力: `coverage/`, `htmlcov/`, `test-results/`, `playwright-report/`, `allure-results/`, `allure-report/`
   - IaC/ローカル状態: `.terraform/`, `.serverless/`, `.aws-sam/`, `cdk.out/`, `terraform.tfstate*`
   - IDE/AIツール: `.vscode/`, `.idea/`, `.vs/`, `.cursor/`, `.continue/`, `.codex/`, `.claude/cache/`
   - その他生成物: `generated/`, `gen/`, `docs/generated/`, `storybook-static/`, `.docusaurus/`, `site/`, `.npm/`, `.pnpm-store/`, `.yarn/cache/`, `.yarn/unplugged/`, `tmp/`, `temp/`, `logs/`
   - 旧バージョン（repository-html-browser）の出力先: `html-code/`
   - ファイル: lockファイル、source map、minified JS/CSS、コンパイル済みバイナリ、アーカイブ、画像・動画・フォント等
11. デフォルト除外を意図的に含めたい場合は `--include-dir <ディレクトリ名>` または `--include-file <ファイル名または相対パス>` を利用する。これらは複数回指定できる。`.git/` と `.codebase-guide-out/` は例外指定でも含めない。
12. ignore済みファイルまで列挙する必要がある場合だけ `--include-ignored` を使う。ただし固定のデフォルト除外は引き続き適用する。
13. Gitが利用できない場合はファイルシステム走査へフォールバックする。この場合も固定のデフォルト除外を適用する。
14. デフォルト除外されていないバイナリファイルが存在した場合は、ツリーから消さず、バイナリ用HTMLページを作り「バイナリのため本文表示対象外」と表示する。
15. シンボリックリンクはリンク先を展開せず、シンボリックリンクとしてページを生成する。
16. 通常生成をやり直しても、`.codebase-guide-out/ガイド/` は消さない。

## 通常生成

### 実行手順

リポジトリルートを現在ディレクトリにして次を実行する。

```bash
node .claude/skills/codebase-guide/scripts/generate-html-code.mjs
```

このスキル自体が別の場所にある場合は、スクリプトの絶対パスを使い、対象リポジトリを `--root` で渡す。

```bash
node /path/to/generate-html-code.mjs --root /path/to/repository
```

必要に応じて並列数を指定する。

```bash
node .claude/skills/codebase-guide/scripts/generate-html-code.mjs --concurrency 32
```

デフォルト除外されたものを個別に含める場合:

```bash
node .claude/skills/codebase-guide/scripts/generate-html-code.mjs \
  --include-dir .vscode \
  --include-file package-lock.json
```

`.gitignore` 等でignoreされたファイルも確認対象にする場合:

```bash
node .claude/skills/codebase-guide/scripts/generate-html-code.mjs --include-ignored
```

### Claude Codeが行うこと

1. 対象リポジトリのルートを確定する。
2. スクリプトを実行する。
3. スクリプト終了コードが0であることを確認する。
4. `.codebase-guide-out/フォルダーツリー.html` が存在することを確認する。
5. スクリプトが出力した件数サマリを確認する。
6. 列挙された対象ファイル数と生成HTML数が一致していることを確認する。
7. 代表として最低3件を検証する。
   - ルート直下のファイル
   - 2階層以上深いファイル
   - 日本語または空白などURLエンコードが必要な名前を含むファイル（存在する場合）
8. 欠落がある場合、AIが手作業でHTMLを補完せず、原因を特定してスクリプトを修正して再生成する。

## ガイド生成

依頼文に合わせて、入口から関係するコードまでの順路、各ステップの解説、全体図を作る。
レビュー依頼の場合は、指摘（バグ・懸念・改善）も加える。

### 役割分担

| 作業 | 担当 |
|---|---|
| 依頼文の解釈（ガイド名、差分の範囲、レビュー依頼かどうか） | AI |
| `.codebase-guide-out/` の有無と鮮度の確認、必要なら通常生成 | `prepare-guide.mjs` |
| 変更ファイル・変更行・変更を含む関数・呼び出し候補・入口の候補の抽出 | `prepare-guide.mjs` |
| 読むコードの選定と、呼び出し関係の確認 | AI（下準備メモの候補を起点に、必要な範囲だけ読む） |
| 順路・解説・指摘・要約を `guide.json` に書く | AI |
| guide.json の検査、アンカーから行番号への変換、差分の行の表示、全体図の配置、HTMLの生成、リンクの検査、フォルダーツリーの更新 | `build-guide.mjs` |

### 手順

1. 依頼文から次を決める。
   - ガイド名: 短く、内容が分かる名前（例: `POST-templates-レビュー`）。
   - 差分の範囲（`--diff`）: 依頼文にコミット・ブランチ・PRの範囲があればそれを使う（`main...HEAD`、`HEAD~1..HEAD`、`<コミット>`）。「今の変更」「未コミットの変更」なら `working`。差分が対象なのに範囲を特定できない場合だけ、ユーザーに確認する。差分が対象でなければ指定しない。PR番号だけが渡された場合は、`gh pr view` などで比較元と比較先を調べて範囲にする。
   - レビュー依頼かどうか: 「レビュー」「指摘」「問題がないか」などを含む依頼はレビュー依頼とする。
2. 下準備を実行する。

   ```bash
   node .claude/skills/codebase-guide/scripts/prepare-guide.mjs \
     --request "<依頼文>" --name "<ガイド名>" [--diff "<範囲>"]
   ```

   - 依頼文が長い場合は、ファイルに書いて `--request-file <ファイル>` で渡す。
   - スキルが別の場所にある場合は、スクリプトの絶対パスを使い、`--root` で対象リポジトリを渡す。
   - 出力（`guide.brief.md` にも保存される）に、変更行、変更を含む関数、呼び出し候補、入口の候補、`guide.json` の場所が出る。
3. 下準備メモの候補を起点に、必要な範囲だけを Read / Grep で読む。全ファイルを順に読まない。呼び出し候補は名前の一致による推定なので、呼び出し関係はコードで確かめる。
4. [guide.json の書式と書き方](references/guide-format.md) を読み、`guide.json` に `title`・`summary`・`steps`・`notes` を書く。`review` は手順1の判断に合わせる。
5. ガイドを生成する。

   ```bash
   node .claude/skills/codebase-guide/scripts/build-guide.mjs --name "<ガイド名>"
   ```

   - guide.json に問題があると、項目ごとの理由を出して終了コード1で終わる（例: アンカーが複数行に一致する、レビュー依頼でないのに指摘がある）。guide.json を直して再実行する。
6. 終了コードが0で、出力の `Links checked` のリンク切れが0件であることを確認する。
7. ユーザーへ、`表紙.html` のパス、ステップ数、指摘の件数（種類別）、未確認事項の件数を伝える。

### 解説と指摘の書き方

詳しくは [guide.json の書式と書き方](references/guide-format.md) に従う。要点は次の通り。

- 指摘はレビュー依頼のとき（`review: true`）だけ書く。レビュー依頼でなければ、解説だけにする。
- 指摘の種類は、指摘（バグ）・指摘（懸念）・指摘（改善）。バグは、特定の入力や状態で誤動作することをコードから示せるものに限る。
- 確かめられないことは推測で埋めず、`unverified`（未確認事項）に書く。
- 常体（だ・である）で、何が・どこで・どうなるかを具体的に書く。

## 禁止事項

- Claudeが各ソースファイル本文を順番に読み、HTMLを1件ずつ手書きしない。
- ガイドのHTMLを手で書いたり直したりしない。変えたい内容は guide.json を直して `build-guide.mjs` で作り直す。見た目を変える場合はスクリプトを直す。
- `find` の結果をそのまま大量にプロンプトへ読み込まない。
- `.git/` 内部オブジェクトを変換しない。
- `.codebase-guide-out/` を再帰的に変換しない。
- ソースコードとして通常確認すべきファイルを安易な拡張子判定だけで除外しない。
- デフォルト除外一覧を変更する場合は、依存物・生成物・キャッシュ等である根拠を持つ。
- デフォルト除外対象ではないバイナリファイルを「存在しなかったこと」にしない。
- レビュー依頼でないのに指摘を書かない。
- 呼び出し関係を名前の一致だけで決めない。確かめられない箇所を、もっともらしい推測でつながない。

## 完了条件

通常生成は、次のすべてを満たした場合のみ完了とする。

- `.codebase-guide-out/` がリポジトリルート直下に存在する。
- `.codebase-guide-out/フォルダーツリー.html` が存在する。
- 対象となった全ファイルに対応する `.html` が存在する。
- 出力側の相対ディレクトリ構造が元リポジトリと一致する。
- `フォルダーツリー.html` の全ファイルリンクが対応ページを指す。
- 対応言語のコードページでシンタックスハイライト用のトークンクラスが生成される。
- 生成処理がエラー0件で終了している。

ガイド生成は、次のすべてを満たした場合のみ完了とする。

- `build-guide.mjs` が終了コード0で終わり、リンク切れが0件である。
- `.codebase-guide-out/ガイド/<ガイド名>/表紙.html` が存在し、`フォルダーツリー.html` のガイド一覧に載っている。
- 順路が依頼の入口（または差分の変更箇所）から始まり、依頼に答えるのに必要なステップを含む。
- レビュー依頼の場合は、指摘の有無を判断したうえで書いている（指摘が無い場合は0件でよい）。
- 確かめられなかった事項を、未確認事項として残している。
