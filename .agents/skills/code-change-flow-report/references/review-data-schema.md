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
| `overview` | 必須 | コミット全体が何を変え、利用者、業務データ、後続処理へどの結果を生むかを説明する。変更箇所の列挙だけを書かない。 |
| `author` | 任意 | コミット作成者。 |
| `committedAt` | 任意 | コミット日時。 |
| `callerCoverage` | 必須 | 変更対象ごとの探索根拠、検出した呼び出し箇所、掲載フローとの対応を記録する。 |
| `steps` | 必須 | 1段目の処理を実行順に並べた配列。 |

コミットの`overview`は、最初の1〜2文で「つまり何が変わるのか」を説明する。続けて、理解に必要な前提、複数の変更が結果を生む因果関係、外部から確認できる具体例を記載する。具体例は`例えば`で始め、ファイル名、クラス名、メソッド名の列挙だけで説明を終えない。

## ステップ

| フィールド | 必須 | 内容 |
| --- | --- | --- |
| `id` | 必須 | コミット内で重複しないステップID。呼び出し元網羅性検査が参照する。 |
| `flowTitle` | 第1階層の開始ステップで必須 | コミット先頭または`connectFromPrevious: false`のステップに表示するタイトル。後続の第1階層ステップと入れ子には指定しない。 |
| `flowDescription` | 処理フローの開始ステップで必須 | 複数の第1階層ステップまたは入れ子を含む場合に、処理の開始、経路、結果を1〜2文で説明する。単独テーブルには指定しない。 |
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

## 第1階層のタイトル

コミット先頭のステップと`connectFromPrevious: false`を指定したステップが、第1階層の新しい表示単位を開始する。各開始ステップには`flowTitle`を設定する。

開始ステップから次の`connectFromPrevious: false`までに第1階層ステップが複数ある場合、またはその範囲のステップが表示対象の`calls`を持つ場合、生成処理はその表示単位を処理フローとして扱う。処理フローでは`flowDescription`も必須になる。`flowDescription`には、開始契機、経由する主要処理、利用者または後続処理が受け取る結果を記載する。

表示単位が入れ子も接続先も持たない1テーブルだけの場合、生成処理は単独テーブルとして扱う。単独テーブルには`flowTitle`だけを設定し、`flowDescription`を指定しない。

```json
{
  "steps": [
    {
      "id": "order-entry",
      "flowTitle": "注文登録から保存結果を返すフロー",
      "flowDescription": "OrderControllerが注文登録を受け付けてから、OrderServiceとOrderRepositoryが注文を保存し、登録結果を返すまでを示す。",
      "calls": [{ "steps": [{ "id": "order-service", "calls": [] }] }]
    },
    {
      "id": "logging-config",
      "flowTitle": "監査ログの出力レベル設定",
      "connectFromPrevious": false,
      "calls": []
    }
  ]
}
```

## 呼び出し元網羅性

`callerCoverage.version`には`1`を指定する。`targets`には、コミット内の変更メソッド、変更された入口、コードから直接呼び出されない設定値などを登録する。すべての変更ステップIDは、少なくとも1件の`targets[].changedStepIds`に含める。

```json
{
  "callerCoverage": {
    "version": 1,
    "targets": [
      {
        "id": "order-service-create",
        "displayName": "OrderService.create(OrderRequest)",
        "analysisMode": "callers",
        "changedStepIds": ["service-create-from-controller", "service-create-from-job"],
        "evidence": [
          {
            "kind": "semantic",
            "method": "LSP Call Hierarchy",
            "scope": "src",
            "query": "OrderService.create(OrderRequest)",
            "resultSummary": "ControllerとJobの2件を検出した。",
            "callSiteIds": ["controller-call", "job-call"]
          },
          {
            "kind": "text",
            "method": "rg",
            "scope": "src",
            "query": "orderService.create(",
            "resultSummary": "ControllerとJobの2件を検出した。",
            "callSiteIds": ["controller-call", "job-call"]
          }
        ],
        "callSites": [
          {
            "id": "controller-call",
            "callerSymbol": "OrderController.create(OrderRequest)",
            "callerPath": "src/main/java/example/OrderController.java",
            "startLine": 21,
            "endLine": 21,
            "status": "included",
            "entryStepId": "controller-entry",
            "callerStepId": "controller-entry",
            "changedStepId": "service-create-from-controller"
          },
          {
            "id": "job-call",
            "callerSymbol": "OrderJob.execute()",
            "callerPath": "src/main/java/example/OrderJob.java",
            "startLine": 30,
            "endLine": 30,
            "status": "included",
            "entryStepId": "job-entry",
            "callerStepId": "job-entry",
            "changedStepId": "service-create-from-job"
          }
        ]
      }
    ]
  }
}
```

`analysisMode`は次のいずれかにする。

| 値 | 用途 |
| --- | --- |
| `callers` | 別のコードが変更対象を呼び出す。`evidence`へ`semantic`を1件以上、`text`または`framework`を1件以上記録し、検出した呼び出し箇所を`callSites`へ登録する。 |
| `entry-point` | 変更対象自体がController、Listener、Jobなどの入口である。`entryStepId`へ独立フローの先頭ステップを指定する。 |
| `not-applicable` | 設定値やSQL定義など、コードから呼び出される対象ではない。`reason`へ適用外となる理由を記載する。 |

`evidence.kind`は`semantic`、`text`、`framework`、`manual`のいずれかにする。`scope`には、探索したディレクトリ、モジュール、設定ファイルなどの範囲を記載する。各`evidence.callSiteIds`には、その探索で検出した呼び出し箇所IDを記載する。探索結果にあるIDが`callSites`にない場合、または`callSites`のIDを検出した探索根拠がない場合、検証処理はHTML生成を停止する。

`callSites[].status`は次のいずれかにする。

| 値 | 必須項目と動作 |
| --- | --- |
| `included` | `entryStepId`、`callerStepId`、`changedStepId`を指定する。呼び出し元のファイルと行範囲がステップに一致し、変更ステップが呼び出し元の入れ子にあることを検査する。 |
| `excluded` | `callerPath`、行範囲、`reason`を指定する。理由が空の場合は生成を停止する。 |
| `unresolved` | 確定できない対象と`reason`を記載する。1件でも存在する場合は生成を停止する。 |

`callers`では、各`included`へ異なる`changedStepId`を指定する。複数の呼び出し元が同じ変更ステップを共有した場合、検証処理はHTML生成を停止する。

同じ変更対象の`callSites`では、`callerPath`、`startLine`、`endLine`が同じ呼び出し箇所を複数のIDで登録してはならない。検証処理はこの重複も検出し、HTML生成を停止する。

## 入れ子と戻り

```json
{
  "steps": [
    {
      "id": "controller-create-call",
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
      "id": "controller-return",
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

`calls`を持つステップの直後に接続されたステップを置く場合、次ステップの`filePath`は呼び出し元ステップと同じ値にする。次ステップの`startLine`は呼び出し元ステップの`endLine`より後にする。生成前の構造検査はこの2条件を満たさないJSONを拒否する。呼び出し後の文がない場合は次ステップを作らず、生成後の検証で実コード上の根拠を確認する。

最大深度は10,000段である。通常の報告では実コード上の呼び出し関係だけを記載し、表示段数を増やす目的で架空の階層を作らない。
