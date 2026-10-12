# スキル一覧

このディレクトリに収録している13種類のスキルについて、用途・主な成果物・依頼例をまとめています。詳細な実行手順、入力条件、検証方法は、各リンク先の `SKILL.md` を参照してください。

## 一覧

| 分類 | スキル | 主な用途 | 主な成果物 |
| --- | --- | --- | --- |
| 着手前検討 | [pre-task-dialogue](pre-task-dialogue/SKILL.md) | タスク着手前に対話と読み取り調査で目的・影響範囲・成立条件・代替案・リスクを検討する | 根拠付き実施事項一覧、依存関係、リスク・未確定事項、着手可否 |
| 要件・仕様分析 | [analyze-requirements-and-specs](analyze-requirements-and-specs/SKILL.md) | 既存機能の改善・拡張や新機能追加に向け、現行仕様の目的と影響を調べて要件・仕様へ整理する | 要件・仕様一覧のMarkdown／HTML、検証用JSON |
| 業務・システム設計 | [business-model-to-system-spec](business-model-to-system-spec/SKILL.md) | 現状業務を分析し、将来の業務モデルを比較して実装可能なシステム仕様を作る | AS-IS分析、TO-BE比較、システム仕様、根拠・追跡用台帳 |
| 業務モデル設計 | [system-driven-business-model](system-driven-business-model/SKILL.md) | 既存システムの実装能力を起点に、KPI・責任分界・業務プロセスを設計する | 能力マップ、業務モデル、KPI、運用・検証資料 |
| 市場・成長戦略 | [category-creation-growth-marketing](category-creation-growth-marketing/SKILL.md) | 未開拓領域の探索から市場定義、製品の普及、成長、競争への備えまで検討する | 戦略分析のMarkdown、図解付きHTMLレポート |
| SaaS事業レビュー | [saas-business-owner-accountability-review](saas-business-owner-accountability-review/.claude/skills/saas-business-owner-accountability-review/SKILL.md) | 事業計画・KPI・意思決定に残る説明不足や矛盾を経営視点で検出する | 重要論点、確認質問、必要な証拠、判断事項 |
| AWS構成設計 | [aws-architecture-pattern-svg](aws-architecture-pattern-svg/SKILL.md) | AWSサービス間の経路や境界を明示した構成パターンを図解する | 編集可能なSVG構成図、技術解説 |
| 画面モックアップ | [capture-screen-mockup](capture-screen-mockup/SKILL.md) | 操作中の既存Web画面を単一HTMLへ保存し、UI変更や注釈を加えた画面案を作る | 原本・画面案・注釈付きのHTML／PNG、変更記録JSON |
| コード閲覧・読解 | [codebase-guide](codebase-guide/SKILL.md) | リポジトリをHTML化し、必要に応じて読む順番や処理フローの解説を付ける | コード閲覧HTML、定義リンク、読解・レビューガイド |
| コード閲覧 | [repository-html-browser](repository-html-browser/SKILL.md) | リポジトリをディレクトリ構造ごと静的HTMLへ変換する | フォルダーツリーと各ファイルの閲覧HTML |
| 変更影響分析 | [diff-decision-trees](diff-decision-trees/SKILL.md) | Git差分から変更前後の条件と最終結果を調べ、判定決定木にする | 日本語HTML、調査モデル、テストケース |
| コードレビュー | [code-change-review-checklist](code-change-review-checklist/SKILL.md) | コード変更フローを重要度順に確認し、レビューの進捗を記録する | フローレポート、確認済みチェック・重要度付きHTML |
| 汎用HTML出力 | [universal-html-output](universal-html-output/SKILL.md) | 文章・コード・差分・データなどを目的に合うHTMLにまとめる | HTML成果物、生成用JSON |
