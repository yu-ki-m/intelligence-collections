# Intelligence Collections

| カテゴリ | リンク | 解説 | その他 |
| --- | --- | --- | --- |
| 1. 標準仕様・配布・導入｜Agent Skills仕様 | [agentskills/agentskills](https://github.com/agentskills/agentskills)<br>⭐ 25,079 | Agent Skillsの仕様と公式ドキュメント。`SKILL.md`、`scripts/`、`references/`、`assets/`など、Skillを構成する形式を定義する。 | |
|  | [Agent Skills公式サイト](https://agentskills.io/) | Agent Skillsの仕様、作成方法、対応クライアントを確認する入口。 | |
| 1. 標準仕様・配布・導入｜Agent Plugins仕様 | [Agent Plugins](https://agent-plugins.org/) | Agent SkillsとMCPサーバー設定を1つの配布単位へまとめる、ベンダー中立のパッケージ仕様。 | |
|  | [Agent Plugins Specification](https://agent-plugins.org/specification) | `plugin.json`、`skills/`、MCP設定などの構造と適合条件を定義する仕様本文。 | |
| 1. 標準仕様・配布・導入｜外部ツール接続・エディタ接続の仕様 | [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol)<br>⭐ 9,145 | MCPの仕様、スキーマ、公式ドキュメント。AIエージェントが外部サービスやツールを呼び出す接続方式を定義する。 | |
|  | [agentclientprotocol/agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol)<br>⭐ 4,166 | Agent Client Protocol（ACP）の仕様。コードエディタとコーディングエージェントの間で、セッションや操作をやり取りする方式を定義する。 | |
| 1. 標準仕様・配布・導入｜Skillの検索・インストール | [vercel-labs/skills](https://github.com/vercel-labs/skills)<br>⭐ 30,501 | `npx skills`を提供するCLI。GitHub、GitLab、ローカルディレクトリなどからSkillを取得し、Claude Code、Codex、Cursorなどへ配置する。 | リポジトリ内のSkillを確認: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --list</code><br>プロジェクトへ導入: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --skill &lt;skill-name&gt;</code><br>ユーザー単位で導入: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --skill &lt;skill-name&gt; -g</code> |
|  | [skills.sh](https://skills.sh/) | 公開Agent Skillsを検索し、内容や導入コマンドを確認するカタログ。 | |
| 2. 公式・大規模カタログ | [anthropics/skills](https://github.com/anthropics/skills)<br>⭐ 174,784 | Anthropicが公開するAgent Skillsの実装例。文書、PDF、スライド、表計算、デザイン、技術作業などのSkillとテンプレートを収録する。 | |
|  | [openai/plugins](https://github.com/openai/plugins)<br>⭐ 5,421 | OpenAIが公開するCodex向けPluginの公式例。Skillだけでなく、アプリ、MCP、エージェント、コマンド、フック、アセットをまとめた構成例を収録する。 | `openai/skills`は廃止済みであり、現在はこのリポジトリが後継。 |
|  | [github/awesome-copilot](https://github.com/github/awesome-copilot)<br>⭐ 38,683 | GitHub Copilot向けのカスタムエージェント、instructions、Skills、hooks、workflows、pluginsを集めた公式コミュニティカタログ。 | |
|  | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)<br>⭐ 30,897 | Vercelが公開するSkill集。React／Next.jsの性能、Webデザイン、アクセシビリティ、文書作成、Vercel運用などを対象とする。 | |
|  | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)<br>⭐ 33,823 | 公式チームとコミュニティが公開するAgent Skillsを分野別に探すための大規模カタログ。導入前に、Skill内のスクリプトと外部通信先を個別に確認する。 | |
|  | [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)<br>⭐ 74,581 | Claude Skills、関連ツール、参考資料を分野別に整理したリンク集。Skill本体ではなくカタログに当たる。 | |
|  | [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community)<br>⭐ 3,510 | Anthropicの審査を通過したClaude Code／Cowork向けコミュニティプラグインのマーケットプレイス。 | 読み取り専用ミラー。プラグインの提出先は `clau.de/plugin-directory-submission`。 |
| 3. ソフトウェア開発向けSkill集 | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)<br>⭐ 92,523 | 要件定義、計画、実装、テスト、レビュー、リリースまでの工程と品質ゲートを、Claude CodeやCodexなどへ守らせる実務向けSkill集。 | |
|  | [mattpocock/skills](https://github.com/mattpocock/skills)<br>⭐ 253,825 | `grill-me`や`grill-with-docs`による要件の掘り下げ、用語整理、チケット運用など、開発者が制御権を維持するための小さなSkillを収録する。 | |
|  | [trailofbits/skills](https://github.com/trailofbits/skills)<br>⭐ 6,980 | Trail of Bitsが公開するセキュリティ向けSkill／Plugin集。コード監査、差分レビュー、静的解析、Semgrep、依存関係、GitHub Actionsなどを対象とする。 | |
|  | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)<br>⭐ 128,776 | AIコーディングエージェントが不要な依存関係や抽象化を増やす動作を抑え、既存実装、標準ライブラリ、プラットフォーム標準機能を優先させるルールセット兼Plugin。 | |
|  | [humanlayer/skills](https://github.com/humanlayer/skills)<br>⭐ 2,971 | Claude Code向けSkill集。図やHTMLで説明する `show-me`、CLAUDE.md改善、React型整理などを収録する。 | |
|  | [saurabhkumar8112/cyclomatic-complexity-skill](https://github.com/saurabhkumar8112/cyclomatic-complexity-skill)<br>⭐ 376 | 関数の循環的複雑度を計測し、ガード節や関数抽出によって複雑なコードをリファクタリングするClaude Skill。 | |
|  | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)<br>⭐ 210,537 | Andrej Karpathy氏の指摘を基に、AIの過剰実装や未確認の思い込みを抑えるCLAUDE.md。 | |
| 4. 業務・調査・図解向けSkill集 | [Ted0321/kotetsu-work-ai-skills](https://github.com/Ted0321/kotetsu-work-ai-skills)<br>⭐ 55 | 論点整理、調査結果からの示唆抽出、資料レビュー、企業調査、HTMLレポート作成など、業務を進めるための日本語Skill集。 | |
|  | [ReScienceLab/opc-skills](https://github.com/ReScienceLab/opc-skills)<br>⭐ 1,763 | 個人開発者や一人会社向けに、需要調査、SEO／GEO、ドメイン探索、ロゴ・バナー制作などをAIへ実行させるSkill集。 | |
|  | [SeanJ1ang/design-judge-skills](https://github.com/SeanJ1ang/design-judge-skills)<br>⭐ 1,021 | デザイン賞の公式情報確認、作品評価、応募先選定、申請文作成、提出前確認を、根拠と採点基準を残しながら実行するSkill集。 | |
|  | [imxv/Pretty-mermaid-skills](https://github.com/imxv/Pretty-mermaid-skills)<br>⭐ 1,186 | MermaidソースからSVG、PNG、ターミナル向け表現をローカル生成するSkill。Mermaidの構文を維持したまま見た目を整える用途に向く。 | |
|  | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)<br>⭐ 32,034 | アーキテクチャ図、状態遷移、シーケンス、ロードマップなどを、HTML＋SVGの編集可能な図として生成するSkill。Mermaid以外の誌面向けレイアウトを作る用途に向く。 | |
|  | [koala73/worldmonitor](https://github.com/koala73/worldmonitor)<br>⭐ 85,680 | ニュース、地政学、災害、インフラなどの世界情勢を集約するリアルタイム監視ダッシュボード。 | |
|  | [ferdinandobons/startup-skill](https://github.com/ferdinandobons/startup-skill)<br>⭐ 889 | 市場調査、競合分析、価格分析、事業アイデア検証などを実行するスタートアップ向けSkill集。 | |
|  | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)<br>⭐ 84,776 | AIが生成するWeb UIから、凡庸な配色・レイアウト・装飾を減らすためのデザイン規則を提供する。 | |
|  | [plannotator/effective-html](https://github.com/plannotator/effective-html)<br>⭐ 2,989 | AIにHTML形式のワイヤーフレーム、プロトタイプ、計画書、図解を生成させるAgent Skill集。 | |
|  | [mathbullet/skills](https://github.com/mathbullet/skills)<br>⭐ 119 | 日本語説明、出典付き調査、論文解説、HTML図解などの出力規則を定義したAgent Skill集。 | |
| 5. Skillの生成・変換・評価 | [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)<br>⭐ 28,757 | PDF、EPUB、DOCX、Markdown、HTMLなどの資料を、章別参照、用語集、パターン、チートシートを備えたAgent Skillへ変換する。 | |
|  | [microsoft/skill-recorder](https://github.com/microsoft/skill-recorder)<br>⭐ 3,856 | 人間の画面操作と任意の音声説明を記録し、GitHub Copilot CLIで手順を復元して、SkillまたはAutomationへ変換する。 | 解析時には記録データがGitHubのクラウドへ送信されるため、機密情報を録画へ含めない。 |
|  | [microsoft/waza](https://github.com/microsoft/waza)<br>⭐ 1,295 | Agent Skillの評価スイートを作成し、ベンチマーク、採点、モデル比較、評価要件の充足確認を実行するGo製CLI。 | Windowsへ導入: <code>irm https://raw.githubusercontent.com/microsoft/waza/main/install.ps1 \| iex</code><br>雛形作成: <code>waza init my-project</code>、<code>cd my-project</code>、<code>waza new skill my-skill</code>、<code>waza new eval my-skill</code><br>評価・構造検査: <code>waza run my-skill -v</code>、<code>waza check skills/my-skill</code><br>一時的にPATHを追加: <code>$env:Path += ";$env:LOCALAPPDATA\Microsoft\Waza"</code> |
| 6. Cookbook・実装例 | [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)<br>⭐ 52,460 | Claude API、Claude Agent SDK、Managed Agents、評価、ツール利用などの実装例を収録する。 | <code>patterns/agents/</code>: 直列処理、並列処理、ルーティング、評価・改善ループなどのエージェント設計パターン<br><code>claude_agent_sdk/</code>: エージェント、サブエージェント、動的ワークフロー、ホスティング<br><code>managed_agents/</code>: 継続実行するエージェント、外部サービス連携、セルフホスト型サンドボックス<br><code>skills/</code>: Skills APIとSkill利用の実装例<br><code>evals/</code>、<code>tool_evaluation/</code>: エージェントおよびツールの評価例<br><code>cost_optimization/</code>: 成功率、品質、コストを比較して構成を選ぶ例 |
| 7. AI駆動開発の方法論・ワークフロー | [obra/superpowers](https://github.com/obra/superpowers)<br>⭐ 282,267 | 対話による仕様化、設計承認、実装計画、TDD、サブエージェントによる実装とレビューを組み合わせた、Skillベースのソフトウェア開発方法論。 | |
|  | [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)<br>⭐ 52,721 | PM、アーキテクト、開発者などの役割を分け、規模に応じて企画、要件、設計、実装の深さを変えるAI駆動開発手法。 | |
|  | [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)<br>⭐ 4,380 | AWS LabsのAI-Driven Development Life Cycle実装。5フェーズ、33ステージ、複数の専門エージェント、各段階の承認ゲートによって開発工程を制御する。 | |
|  | [garrytan/gstack](https://github.com/garrytan/gstack)<br>⭐ 131,668 | CEO、エンジニアリングマネージャー、デザイナー、QA、セキュリティ、リリースなどの役割を持つSkillを、企画・レビュー・出荷の工程で使い分ける開発ワークフロー。 | |
|  | [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)<br>⭐ 9,151 | Discuss、Plan、Execute、Verify、Shipのフェーズを繰り返し、重い調査・計画・実装を新しいコンテキストのサブエージェントへ分離する開発フレームワーク。 | 旧`gsd-build/get-shit-done`はアーカイブ済みで、現在はこのリポジトリへ移転。 |
|  | [github/spec-kit](https://github.com/github/spec-kit)<br>⭐ 133,668 | constitution、specify、plan、tasks、implementなどの成果物とコマンドを使い、仕様を実装の基準として残すGitHub製ツールキット。 | |
|  | [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)<br>⭐ 67,429 | 変更単位でproposal、requirements、design、tasksを作成し、実装後に変更記録をアーカイブする仕様駆動開発フレームワーク。 | |
|  | [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)<br>⭐ 14,867 | AIエージェントを制御するハーネスの設計を、初学者向けに段階的に解説するチュートリアル。 | |
| 8. 汎用エージェントSDK・実行基盤 | [microsoft/agent-framework](https://github.com/microsoft/agent-framework)<br>⭐ 13,352 | Python、.NET、Goでエージェントとマルチエージェントワークフローを構築するSDK。直列、並列、引き継ぎ、チェックポイント、Human-in-the-loop、OpenTelemetryなどを扱う。 | |
|  | [openai/openai-agents-python](https://github.com/openai/openai-agents-python)<br>⭐ 29,220 | OpenAIのPython向けAgents SDK。エージェント、ツール、引き継ぎ、ガードレール、セッション、トレーシングを実装する。 | |
|  | [google/adk-python](https://github.com/google/adk-python)<br>⭐ 21,423 | GoogleのPython向けAgent Development Kit。モデルやデプロイ先を固定せず、エージェント、ツール、ワークフロー、評価を実装する。 | |
|  | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)<br>⭐ 41,127 | 状態を持つ長時間実行ワークフローをグラフとして実装するフレームワーク。中断・再開、人間承認、永続化を必要とする処理に向く。 | |
|  | [vercel/eve](https://github.com/vercel/eve)<br>⭐ 4,987 | instructions、tools、skills、channels、schedulesをファイルとして管理する、ファイルシステム中心の永続型エージェントフレームワーク。 | 現在はベータ版。 |
|  | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)<br>⭐ 242,293 | CLIや各種メッセージングチャネルから利用できる汎用エージェント本体。会話検索、ユーザー情報の継続利用、Skillの生成・更新、スケジュール実行、サブエージェント、複数の実行バックエンドを備える。 | |
| 8. 汎用エージェントSDK・実行基盤｜AIエージェント環境・運用基盤 | [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus)<br>⭐ 86,903 | AIエージェント、検索、画像生成などを自分の環境で運用するセルフホスト型AIワークスペース。 | |
|  | [lobehub/lobehub](https://github.com/lobehub/lobehub)<br>⭐ 82,267 | 複数のAIエージェントを登録し、スケジュール実行や作業報告を管理するAIエージェント運用基盤。 | |
|  | [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)<br>⭐ 51,509 | 複数のLLM、チャット、ナレッジベース、AIエージェント、300種類以上のアシスタントを統合するデスクトップアプリ。 | |
| 9. コーディングエージェントの実行・オーケストレーション｜プロジェクト／組織単位の制御 | [paperclipai/paperclip](https://github.com/paperclipai/paperclip)<br>⭐ 80,084 | 複数のAIエージェントへ目標と仕事を割り当て、組織図、権限、承認、予算、進捗、監査情報を一元管理するNode.js＋React製のOSS。 | |
|  | [Untrivial-ai/agent-orchestrator](https://github.com/Untrivial-ai/agent-orchestrator)<br>⭐ 10,989 | タスクごとにブランチとWorktreeを分離し、複数のコーディングエージェント、差分、PR、CI、レビューをKanban形式で管理するローカルデスクトップアプリ。 | |
|  | [stablyai/orca](https://github.com/stablyai/orca)<br>⭐ 62,563 | Claude Code、Codex、OpenCodeなどをタスク別のWorktree・ターミナル・ブラウザで並列実行するAgent Development Environment。Run、Task、Dispatch、メッセージ、判断ゲートによる構造化オーケストレーションも提供する。 | |
| 9. コーディングエージェントの実行・オーケストレーション｜プロジェクト／組織単位の制御｜stablyai/orca | [Orca Docs](https://www.onorca.dev/docs) | Orcaの公式ドキュメント。 | |
|  | [Orchestration](https://www.onorca.dev/docs/cli/orchestration) | Orcaのオーケストレーション機能の説明。 | 現時点ではExperimental。 |
| 9. コーディングエージェントの実行・オーケストレーション｜コーディングエージェント | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)<br>⭐ 86,336 | コード編集、コマンド実行、テスト、問題修正を自律的に進めるOSSのAI開発エージェント。 | |
|  | [cline/cline](https://github.com/cline/cline)<br>⭐ 67,558 | IDE拡張、CLI、SDKとして利用できる自律型コーディングエージェント。ファイル編集やコマンド実行に対応する。 | |
|  | [aaif-goose/goose](https://github.com/aaif-goose/goose)<br>⭐ 53,959 | LLMを選択して、コード編集、コマンド実行、テスト、外部ツール連携を行える拡張可能なAIエージェント。 | |
| 9. コーディングエージェントの実行・オーケストレーション｜ターミナル／セッション単位の実行 | [herdrdev/herdr](https://github.com/herdrdev/herdr)<br>⭐ 35,682 | 複数のコーディングエージェントを実ターミナル上で継続稼働させるターミナルマルチプレクサ兼バックグラウンドランタイム。各ペインの稼働中・待機中・停止状態を集約し、CLIやスクリプトから操作できる。 | |
| 9. コーディングエージェントの実行・オーケストレーション｜ターミナル／セッション単位の実行｜herdrdev/herdr | [Herdr Docs](https://herdr.dev/docs/agents/) | 対応するエージェント、ペイン管理、状態検出の説明。 | |
|  | [Herdr Agent automation](https://herdr.dev/docs/agent-automation/) | スクリプトまたは別のエージェントが、エージェントの起動、状態確認、入力、結果回収を行う方法。 | |
| 9. コーディングエージェントの実行・オーケストレーション｜オーケストレーターのカタログ | [andyrewlee/awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)<br>⭐ 1,681 | エージェントへの仕事の割当、実行場所、実行時刻、成果物の処理を制御するツールとフレームワークの一覧。 | |
| 10. コンテキスト・知識・記憶基盤 | [trailhq/Graft](https://github.com/trailhq/Graft)<br>⭐ 5,704 | コードベースの構造、依存関係、変更影響をグラフ化し、Claude CodeやCodexなどへタスクに関係するコード情報を渡すコンテキスト層。 | |
|  | [semantica-agi/semantica](https://github.com/semantica-agi/semantica)<br>⭐ 12,143 | AIが使用する情報をコンテキストグラフ、知識グラフ、オントロジー、意思決定履歴として保存し、根拠と経路を追跡できるPython基盤。 | |
|  | [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki/blob/main/README_JA.md)<br>⭐ 17,467 | 文書を取り込み、相互リンクされたWikiと知識グラフを継続更新するデスクトップアプリ。検索、出典参照、MCP、Agent Skillを提供する。 | |
|  | [Andrej Karpathy: LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | LLMが資料を読み、正規化されたWikiを増分更新するナレッジ管理パターン。 | `nashsu/llm_wiki`が実装する元の考え方。 |
|  | [GoogleCloudPlatform/knowledge-catalog — OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)<br>⭐ 9,079 | Open Knowledge Format（OKF）の資料と実装例。AIエージェントへ知識を渡す際の、機械可読な知識パッケージを扱う。 | |
|  | [Open Knowledge Formatの解説](https://cloud.google.com/blog/ja/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/) | Google CloudによるOKFの目的と利用方法の解説。 | |
|  | [infiniflow/ragflow](https://github.com/infiniflow/ragflow)<br>⭐ 90,126 | 文書解析、検索、引用付き回答、エージェント機能を提供するRAG基盤。 | |
|  | [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)<br>⭐ 81,644 | コードベースを解析し、ファイル、関数、依存関係を対話可能なナレッジグラフへ変換する。Codexにも対応する。 | |
|  | [upstash/context7](https://github.com/upstash/context7)<br>⭐ 61,695 | ライブラリの最新公式ドキュメントを取得し、AIコーディングツールへ渡すMCP対応サービス。 | |
|  | [MemPalace/mempalace](https://github.com/MemPalace/mempalace)<br>⭐ 58,875 | 会話履歴を要約せず原文のままローカル保存し、階層構造と意味検索によってAIへ過去情報を返す長期記憶基盤。 | |
| 11. 評価・観測・改善 | [microsoft/AI-Engineering-Coach](https://github.com/microsoft/AI-Engineering-Coach)<br>⭐ 3,752 | ローカルのAIコーディングセッション履歴を解析し、プロンプト、セッション管理、レビュー、ツール利用、コンテキスト管理の傾向を可視化するVS Code拡張機能。 | Marketplace配布ではないため、利用者がVSIXをビルドする。 |
|  | [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo)<br>⭐ 24,858 | LLMアプリとエージェントの評価、モデル比較、回帰テスト、レッドチーミングをCLIとCI/CDで実行するOSS。 | |
|  | [langfuse/langfuse](https://github.com/langfuse/langfuse)<br>⭐ 34,252 | LLMアプリのトレース、プロンプト管理、評価、メトリクスを扱うオープンソースの観測基盤。セルフホストにも対応する。 | |
|  | [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix)<br>⭐ 11,342 | OpenTelemetryベースで、LLM／エージェントのトレース、評価、実験、問題分析を行うオープンソース基盤。 | |
| 12. 意思決定記録・設計履歴 | [architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record)<br>⭐ 16,839 | Architecture Decision Record（ADR）の説明、テンプレート、関連ツールを集めた情報ハブ。ADRは、重要な技術判断、その前提、採用理由、結果を文書として残す。 | |
|  | [adr/madr](https://github.com/adr/madr)<br>⭐ 2,452 | Markdown Architectural Decision Records（MADR）のテンプレート。ADRをMarkdownで統一して管理する。 | |
|  | [AIとの対話履歴を資産にするDDR](https://zenn.dev/softbank/articles/ee93e87a9d5dac) | AIとの対話からDesign Decision Record（DDR）を自動記録し、設計判断の理由と変更経緯を残す事例。 | |
| 13. 付帯ツール | [microsoft/coreutils](https://github.com/microsoft/coreutils)<br>⭐ 5,139 | `ls`、`cat`、`grep`、`find`などのUNIX系コマンドをWindows上で提供するMicrosoft管理のプレビュー版。 | PowerShellの同名エイリアスや組み込みコマンドとの競合に注意。導入: <code>winget install Microsoft.Coreutils</code> |
|  | [vercel-labs/portless](https://github.com/vercel-labs/portless)<br>⭐ 12,180 | `localhost:5173`のようなポート番号を、安定した名前付きローカルURLへ置き換える開発ツール。 | |
