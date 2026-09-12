# JSON仕様

## 最上位

```json
{
  "title": "コード変更比較表",
  "commits": []
}
```

`commits`の各要素が1つのコミットタブになる。複数コミットを1要素へまとめない。

## コミット

| フィールド | 必須 | 内容 |
| --- | --- | --- |
| `hash` | 必須 | 表示するコミットID。短縮IDでもよい。 |
| `message` | 必須 | コミットメッセージ。 |
| `author` | 任意 | コミット作成者。 |
| `committedAt` | 任意 | コミット日時。 |
| `steps` | 必須 | 1段目の処理を実行順に並べた配列。 |

## ステップ

| フィールド | 必須 | 内容 |
| --- | --- | --- |
| `filePath` | 必須 | リポジトリルートからの相対パス。 |
| `startLine` | 必須 | コード断片の開始行。原則として対象コミット側の行番号。 |
| `endLine` | 必須 | コード断片の終了行。 |
| `language` | 必須 | Shikiが解釈する言語名。例: `java`, `typescript`, `xml`。 |
| `beforeCode` | 必須 | 親コミット側のコード。純粋な追加では空文字を使用できる。 |
| `afterCode` | 必須 | 対象コミット側のコード。純粋な削除では空文字を使用できる。 |
| `overview` | 必須 | 変更内容、または未変更コードの役割を1〜2文で記載する。未変更ステップでは変更有無を記載しない。 |
| `reason` | 必須 | 変更ステップでは変更理由を記載する。未変更ステップでは`変更なし`だけを記載する。 |
| `specification` | 必須 | 対象コミット適用後の処理が持つ意味、意味を成立させる因果関係、具体的な結果を記載する。コードの呼び出し順だけを記載しない。 |
| `remarks` | 必須 | 用語、前提、影響範囲、対象外を記載する。 |
| `calls` | 必須 | このステップが呼び出す処理フローの配列。呼び出しがなければ`[]`。 |
| `connectFromPrevious` | 1段目のみ任意 | `false`の場合、直前の1段目と線で接続しない。省略時は接続する。 |

未変更ステップでは`beforeCode`と`afterCode`へ同じコードを設定し、`reason`へ`変更なし`を設定する。生成処理は同一行を着色せず、変更行だけを赤または緑で表示する。

`specification`の最初の文では、メソッド呼び出しを記載せず、その処理が持つ意味を説明する。後続の文に`例えば`を含め、具体的な入力と観測できる結果を示す。検証処理は、この2条件を満たさないJSONを拒否する。

## 入れ子と戻り

```json
{
  "steps": [
    {
      "filePath": "OrderController.java",
      "startLine": 18,
      "endLine": 21,
      "language": "java",
      "beforeCode": "OrderResponse response = orderService.create(request);",
      "afterCode": "OrderResponse response = orderService.create(request);",
      "overview": "OrderControllerはHTTPリクエストを受け取り、注文データをOrderServiceへ渡す入口である。",
      "reason": "変更なし",
      "specification": "この処理は、API利用者が送った注文を業務処理へ渡し、登録結果が確定するまで応答を保留する入口である。OrderControllerがOrderServiceの完了を待つため、保存前の注文を成功として返さない。例えば、保存処理が失敗した場合、OrderControllerは成功レスポンスを返さず、既存の例外処理へ制御を渡す。",
      "remarks": "Controllerとは、この処理ではHTTPリクエストを受け取るクラスを指す。",
      "calls": [
        {
          "steps": []
        }
      ]
    },
    {
      "filePath": "OrderController.java",
      "startLine": 23,
      "endLine": 24,
      "language": "java",
      "beforeCode": "return ResponseEntity.ok(response);",
      "afterCode": "return ResponseEntity.ok(response);",
      "overview": "OrderControllerはOrderServiceの登録結果をHTTPレスポンスとしてAPI利用者へ返す。",
      "reason": "変更なし",
      "specification": "この処理は、登録が完了した注文だけを成功結果としてAPI利用者へ返す。OrderControllerが業務処理の完了後にレスポンスを作るため、利用者が成功応答を受け取った時点では注文の登録が完了している。例えば、注文ID1001の登録が完了すると、利用者は成功ステータスと注文ID1001を含む本文を受け取る。",
      "remarks": "HTTPレスポンスとは、サーバーがAPI利用者へ返すステータスと本文を指す。",
      "calls": []
    }
  ]
}
```

呼び出し元メソッドの`return`は、呼び出し先を記載する上段へ入れない。呼び出し先の`steps`を閉じた後、親階層の次ステップとして記載する。

最大深度は10,000段である。通常の報告では実コード上の呼び出し関係だけを記載し、表示段数を増やす目的で架空の階層を作らない。
