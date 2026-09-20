---
name: code-change-review-checklist
description: "code-change-flow-report が出力したコード変更フローのレポート(review-data.json とHTML)に、テーブルごとの「確認済み」チェックボックスと、人が見なかった場合のリスク点数(0〜10)を重ね、リスクの高い順に確認できる別のHTMLを出力する。コード変更フローのレポートを人が1つずつ確認してレビューしたい、どのテーブルから見るべきか優先度を付けたい、レビューの見落としを防ぎたい場合に使用する。レポート自体の生成や、Gitの差分だけからのリスク分析には使用しない。"
---

# コード変更レビュー確認リスト

`code-change-flow-report`が出力したレポートの各テーブル(コードの断片)に、次の2つを付けた別のHTMLを作る。

- **確認済みチェックボックス**: 人が1つずつ確認したかを記録する。
- **リスク点数(0〜10)**: 人がそのテーブルを見なかった場合に、問題を見逃すリスク。高い順に確認できる。

元のレポートは変更しない。出力は元のHTMLに部品を差し込んだ別ファイルで、差し込み部分を除くと元のHTMLと一致することをスクリプトが検査する。

点数は調査担当の判断であり、低い点数は「人が見なくてよい」ことを保証しない。最終回答でもこの前提を守る。

## 前提

次の2つが必要である。

- `review-data.json`: `code-change-flow-report`がHTML生成の入力に使うJSON。
- 生成済みのレポートHTML(テンプレート版`2026.09.13.3`)。

`review-data.json`がない場合、HTMLから復元しない。ユーザーへ場所を確認するか、`code-change-flow-report`を再実行する。HTMLがない場合も同様に、`code-change-flow-report`で生成する。

### 入力が揃わない場合の扱い

実際の作業では、入力が「揃っているが使えない」ことがある。次の表で決め、決めた内容を最終回答の「入力の扱い」に書く。

| 状況 | 扱い |
|---|---|
| 対象を「直近N件のコミット」と指定されたが、`review-data.json`がそれより多いコミットを含む | 指定に合うコミット分だけの入力を使う。`code-change-flow-report`の作業ディレクトリ(例: `.agent-work/<レポート名>/<コミット>/review.json`)に、コミット単位の検証済み入力があればそれを使う。なければ`code-change-flow-report`で作り直す。`list-review-units.mjs --commit`は表示を絞るだけで、`validate-risk-scores.mjs`と`build-checklist-report.mjs`は入力内の全テーブルを要求するため、絞る代わりにならない。 |
| `review-data.json`の更新日時が、コミット単位の入力(`review.json`)より古い、または内容が食い違う | 新しく検証済みの方を入力にし、古い方は変更しない。食い違いの内容(ステップ数など)を最終回答に書く。 |
| レポートHTMLがない | 入力にする`review.json`から`code-change-flow-report/scripts/generate-report.sh`で生成する。**入力は元の場所のまま**渡す(`orchestration`の証跡ファイルのパスが、入力ファイルからの相対パスで書かれているため。scratchpadなどへコピーすると`cannot read evidence artifact`で失敗する)。出力先だけ別の場所にする。 |
| 生成スクリプトが`orchestration`の欠落などで失敗する | 証跡や`orchestration`を補って作らない。作業ディレクトリに完全な入力がないか探し、なければユーザーへ`code-change-flow-report`の再実行を頼む。 |
| 元のHTMLのテンプレート版が`2026.09.13.3`以外 | 停止する。`assets/templates/`と`scripts/build-checklist-report.mjs`の差し込み位置を確認してから対応版を追加する。 |

作業用のファイルは、対象リポジトリの作業ディレクトリ配下(例: 入力と同じ`.agent-work/…/out/`)かscratchpadに置く。Windowsでは、Git Bashの`/tmp`をNodeが読めない(`C:\tmp`を探す)ため使わない。

## 必ず読む資料

- 採点の前に [リスク点数の付け方](references/risk-scoring.md) を読む。
- 採点を書く前に [採点パターン集](references/scoring-patterns.md) を読む。点数・category・reason・checkPointsの型があり、`assets/example/`に検証を通る全パターンの見本がある。
- 最終回答は [最終回答の雛形](assets/final-answer.template.md) に沿って書く。

## 部品(テンプレート)

出力HTMLに差し込む部品は、スクリプトに埋め込まず`assets/templates/`に置いている。出力の見た目や文言を変える時は、スクリプトではなくここを直す。

| ファイル | 内容 |
|---|---|
| `style.css` | 差し込むスタイル |
| `script.js` | チェックの保存、進捗、ジャンプなどの動作 |
| `bar.html` | 各テーブルの直前に入るバー(確認済み、点数、帯、category、reason、確認すること) |
| `points.html` / `point-item.html` | バーの「確認すること」の一覧(checkPointsが空なら出さない) |
| `panel.html` / `queue-item.html` | 上部のパネル(進捗、未確認件数、優先度順の一覧) |

書式は`{{name}}`(エスケープして埋め込む)と`{{{name}}}`(生のHTML)。`*.html`は行頭・行末の空白と改行を除いて1行にするため、1つのタグの属性は同じ行に書く。描画の関数は`scripts/checklist-render.mjs`にあり、本番の生成と見本の生成が同じ関数を使う。

**見本は2種類ある。役割が違うので混同しない。**

| 見本 | 何が分かるか |
|---|---|
| `assets/example/flow-report/report.checklist.html` | **レポート全体の完成形。** `code-change-flow-report`が実際に生成したレポート(入れ子の流れ、接続線、独立フロー、解説、変更前後の比較、差分色、コミットタブ)に、チェックリストを重ねたもの。元のレポートの文脈がどう残るかの基準。土台は同じフォルダの`report.html`、入力は`review-data.json`と`orchestration-artifacts/`、採点は`risk-scores.json`。 |
| `assets/template-catalog.html` | **部品(バーとパネル)だけの一覧。** 全パターン(0〜10点、4つの帯、確認点0〜3件、確認済みの状態、特殊文字のエスケープ)を並べる。レポート本体の文脈は含まない。 |

`verify-templates.mjs`は、完成形を本番と同じ`build-checklist-report.mjs`で作り直し、元のレポートの構造(コミット、フローの入れ子と接続線、解説、変更前後の比較、差分色)が1つも失われていないことと、全テーブルにバーが付くことを検査する。元のレポートの構造を変える変更(スクリプトやテンプレートの修正)は、この検査で止まる。

`flow-report/`の`report.html`は`code-change-flow-report`(`scripts/generate-report.sh`)の出力で、`review-data.json`とその証跡は同スキルの見本を写したものである。元のレポートのテンプレート版が上がった場合は、同スキルで`report.html`を作り直し、採点を合わせてから再生成する。

部品や見本を直したら、次で再生成して検査する。

```bash
node <skill-root>/scripts/verify-templates.mjs --write-catalog
node <skill-root>/scripts/verify-templates.mjs
```

## 実行手順

1. 入力を確定する。`review-data.json`と元のHTMLのパス、出力先(元のHTMLとは別のファイル名。既定は`<元のHTML名>.checklist.html`)、作業用のディレクトリ(`risk-scores.json`を置く場所)を決める。
2. 採点の雛形を作る。全テーブルを1件ずつ含み、`score`などが空になる。

```bash
node <skill-root>/scripts/list-review-units.mjs <review-data.json> --skeleton <risk-scores.json>
```

3. 採点対象を確認する。標準出力に、各テーブルの位置、変更の有無、備考の指摘分類、呼び出し元の数が出る。説明とコードも見る場合は`--with-code`を付ける。コミットを絞る場合は`--commit <hash>`を付ける。

```bash
node <skill-root>/scripts/list-review-units.mjs <review-data.json> --with-code
```

4. `risk-scores.json`の各テーブルへ、`score`(0〜10の整数)、`category`、`reason`、`checkPoints`を書く。基準は`risk-scoring.md`に従い、書き方は`scoring-patterns.md`と`assets/example/risk-scores.example.json`の型に合わせる。変更のあるテーブルは、変更前後のコード、`reason`(変更理由)、備考の`[バグ]`・`[懸念点]`・`[考慮漏れ]`、`callerCount`を根拠にする。変更のないテーブルは、変更箇所の理解に必要な文脈として低い点数にする。テーブルが多い(30件を超える)場合に限り、コミット単位で採点を並列化してよい。その場合も全員が`risk-scoring.md`を読み、統合後に点数の分布を見直す。
5. 採点を検証する。欠落、重複、範囲外、基準との不整合があれば、原因を直して再実行する。

```bash
node <skill-root>/scripts/validate-risk-scores.mjs --self-test
node <skill-root>/scripts/validate-risk-scores.mjs <review-data.json> <risk-scores.json>
```

6. 部品を検査してから、チェックリスト付きHTMLを生成する。

```bash
node <skill-root>/scripts/verify-templates.mjs
node <skill-root>/scripts/build-checklist-report.mjs <review-data.json> <risk-scores.json> <元のHTML> <出力するHTML>
```

7. 出力に`Template verification passed`と`Checklist verification passed`が表示されたことを確認する。表示されない場合は完成扱いにしない。
8. 出力したHTMLをブラウザで直接開き、上部のパネルに全テーブルが点数の高い順に並ぶこと、各テーブルの上に点数とチェックボックスがあること、チェックで進捗が変わることを確認する。確認のためにサーバーを起動しない。ブラウザで開けない場合(パスに全角文字を含む、ブラウザの制限など)は、確認していないことを最終回答に書き、ユーザーへ開いて確認するよう頼む。見た目の見本は`assets/template-catalog.html`で代替できるが、実際の出力の確認にはならない。
9. 最終回答は [最終回答の雛形](assets/final-answer.template.md) に沿って書く。雛形の必須の節(出力先、結果、検証、注意)を省かない。入力を差し替えた・絞った・作り直した場合は「入力の扱い」を書く。

## 完了条件

- 元のHTMLを変更していない(出力先が別ファイルである)。
- 全テーブルに、0〜10の整数の点数、`category`、`reason`がある。3以上のテーブルには`checkPoints`がある。
- 検証スクリプトが`Risk score self-test passed`と`Risk score validation passed`を出力している。
- `verify-templates.mjs`が`Template verification passed`を出力している(部品、見本、カタログが整合している)。
- 生成スクリプトが`Checklist verification passed`を出力し、テーブル数が元のレポートと一致している。
- 出力が外部ファイルやサーバーを必要としない単体のHTMLである。
- サーバープロセスを起動しておらず、ポートを待ち受けていない。

## 制約

- 対象リポジトリのソースコード、Git履歴、リモートを変更しない。
- 元のレポートHTMLと`review-data.json`を編集しない。
- 点数をブラウザ上で再計算しない。点数は`risk-scores.json`だけが正本である。
- 確認済みの状態は、そのブラウザの`localStorage`にだけ保存される。別の端末や別のブラウザへは共有されない。この点をユーザーへ尋ねられたときに説明する。
- 元のレポートのテンプレート版が`2026.09.13.3`以外の場合、スクリプトは停止する。テンプレートが更新された場合は、`scripts/build-checklist-report.mjs`の対応版と差し込み位置、`assets/templates/`のクラス名やCSS変数(元のレポートの`:root`に依存する)を確認してから更新する。
- 出力の見た目や文言を変える時は、`assets/templates/`を直し、`verify-templates.mjs --write-catalog`でカタログを再生成する。スクリプト内へHTMLやCSSを直接書き足さない。
