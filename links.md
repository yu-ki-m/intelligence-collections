# Intelligence Collections

## 1. 標準仕様・配布・導入｜Agent Skills仕様

| リンク | 解説 | その他 |
| --- | --- | --- |
| [agentskills/agentskills](https://github.com/agentskills/agentskills)<br>⭐ 25,900 | Agent Skillsの仕様と公式ドキュメント。`SKILL.md`、`scripts/`、`references/`、`assets/`など、Skillを構成する形式を定義する。 | |
| [Agent Skills公式サイト](https://agentskills.io/) | Agent Skillsの仕様、作成方法、対応クライアントを確認する入口。 | |

## 1. 標準仕様・配布・導入｜Agent Plugins仕様

| リンク | 解説 | その他 |
| --- | --- | --- |
| [Agent Plugins](https://agent-plugins.org/) | Agent SkillsとMCPサーバー設定を1つの配布単位へまとめる、ベンダー中立のパッケージ仕様。 | |
| [Agent Plugins Specification](https://agent-plugins.org/specification) | `plugin.json`、`skills/`、MCP設定などの構造と適合条件を定義する仕様本文。 | |

## 1. 標準仕様・配布・導入｜外部ツール接続・エディタ接続の仕様

| リンク | 解説 | その他 |
| --- | --- | --- |
| [modelcontextprotocol/modelcontextprotocol](https://github.com/modelcontextprotocol/modelcontextprotocol)<br>⭐ 9,379 | MCPの仕様、スキーマ、公式ドキュメント。AIエージェントが外部サービスやツールを呼び出す接続方式を定義する。 | |
| [agentclientprotocol/agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol)<br>⭐ 4,369 | Agent Client Protocol（ACP）の仕様。コードエディタとコーディングエージェントの間で、セッションや操作をやり取りする方式を定義する。 | |

## 1. 標準仕様・配布・導入｜Skillの検索・インストール

| リンク | 解説 | その他 |
| --- | --- | --- |
| [vercel-labs/skills](https://github.com/vercel-labs/skills)<br>⭐ 33,099 | `npx skills`を提供するCLI。GitHub、GitLab、ローカルディレクトリなどからSkillを取得し、Claude Code、Codex、Cursorなどへ配置する。 | リポジトリ内のSkillを確認: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --list</code><br>プロジェクトへ導入: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --skill &lt;skill-name&gt;</code><br>ユーザー単位で導入: <code>npx skills add &lt;owner&gt;/&lt;repository&gt; --skill &lt;skill-name&gt; -g</code> |
| [skills.sh](https://skills.sh/) | 公開Agent Skillsを検索し、内容や導入コマンドを確認するカタログ。 | |

## 2. 公式・大規模カタログ

| リンク | 解説 | その他 |
| --- | --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills)<br>⭐ 179,597 | Anthropicが公開するAgent Skillsの実装例。文書、PDF、スライド、表計算、デザイン、技術作業などのSkillとテンプレートを収録する。 | |
| [openai/plugins](https://github.com/openai/plugins)<br>⭐ 7,293 | OpenAIが公開するCodex向けPluginの公式例。Skillだけでなく、アプリ、MCP、エージェント、コマンド、フック、アセットをまとめた構成例を収録する。 | `openai/skills`は廃止済みであり、現在はこのリポジトリが後継。 |
| [github/awesome-copilot](https://github.com/github/awesome-copilot)<br>⭐ 39,683 | GitHub Copilot向けのカスタムエージェント、instructions、Skills、hooks、workflows、pluginsを集めた公式コミュニティカタログ。 | |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)<br>⭐ 31,910 | Vercelが公開するSkill集。React／Next.jsの性能、Webデザイン、アクセシビリティ、文書作成、Vercel運用などを対象とする。 | |
| [cloudflare/skills](https://github.com/cloudflare/skills)<br>⭐ 2,978 | Cloudflareが公開するSkill集。Workers、Agents SDK、Durable Objects、Sandbox、Wrangler、Cloudflare Oneなど、Cloudflare上での開発と運用を対象とする。Plugin形式で導入すると、Cloudflare APIと最新ドキュメントへアクセスするCloudflareのリモートMCPサーバーも同時に設定される。 | Apache-2.0。Claude Codeへ導入: <code>/plugin marketplace add cloudflare/skills</code>、<code>/plugin install cloudflare@cloudflare</code><br>Skillだけを導入: <code>npx skills add https://github.com/cloudflare/skills</code> |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)<br>⭐ 35,187 | 公式チームとコミュニティが公開するAgent Skillsを分野別に探すための大規模カタログ。導入前に、Skill内のスクリプトと外部通信先を個別に確認する。 | |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)<br>⭐ 76,466 | Claude Skills、関連ツール、参考資料を分野別に整理したリンク集。Skill本体ではなくカタログに当たる。 | |
| [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community)<br>⭐ 4,465 | Anthropicの審査を通過したClaude Code／Cowork向けコミュニティプラグインのマーケットプレイス。 | 読み取り専用ミラー。プラグインの提出先は `clau.de/plugin-directory-submission`。 |

## 3. ソフトウェア開発向けSkill集

| リンク | 解説 | その他 |
| --- | --- | --- |
| [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)<br>⭐ 24,025 | 偵察、カバレッジ主導の脆弱性探索、候補検証、機械可読な`findings.json`、独立検証、レポート生成までを行う、多段階セキュリティ監査用Agent Skill。 | `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit` |
| [alibaba/open-code-review](https://github.com/alibaba/open-code-review)<br>⭐ 43,635 | Alibaba製のAIコードレビューCLI（`ocr`）。Alibaba社内の公式AIコードレビュー支援ツールをOSS化したもの。対象ファイルの選定、関連ファイルの束ね、ルール照合、指摘位置の補正を決定的な処理で担い、LLMエージェントが行単位のレビューコメントを生成する。 | Alibaba製（Apache-2.0）。導入: <code>npm install -g @alibaba-group/open-code-review</code><br>変更差分をレビュー: <code>ocr review</code> |
| [akkie76/code-review-skills](https://github.com/akkie76/code-review-skills)<br>⭐ 81 | 書籍『コードレビューの教科書』（技術評論社）の考え方をAIコーディングエージェント向けに独自に翻案した、Codex／Claude Code向けのコードレビューSkill。変更行の外まで挙動を追跡し、すべての指摘に具体的な発生条件と影響を求めることで、スタイルだけの指摘や根拠のない推測を抑える。各指摘には`MUST(Functionality):`のように対応の必要度と観点を付け、日本語または英語で優先順位付きの指摘を出力する。 | MIT。現在はベータ版。Skill名は`evidence-code-review`。<br>Claude Codeへ導入: リポジトリを取得し、<code>cp -R dist/claude-code/evidence-code-review ~/.claude/skills/</code><br>確実に使うときは<code>/evidence-code-review</code>で呼び出す。 |
| [devdotfast/whiteboard](https://github.com/devdotfast/whiteboard)<br>⭐ 2,691 | 人間とコーディングエージェントが同じキャンバス上でソフトウェアを設計・レビューするデスクトップアプリ。Claude CodeやCodexからSDK経由でシーケンス図やER図を描かせ、図やエージェントの作業記録から該当コードへ移動できる。AST解析による意味単位の差分表示と、エージェントが自律的に下した判断を追跡する決定ログを備える。 | MIT。Code - OSSをベースにしている。macOS、Windows、Linux向けのアプリを`dev.fast/install`から入手する。<br>現時点ではアプリ内でファイルを編集できない。匿名のテレメトリーを送信する（コードやプロンプトは含まない）が、無効化できる。 |
| [tester-army/e2e](https://github.com/tester-army/e2e)<br>⭐ 2,554 | Webアプリとモバイルアプリ向けのE2Eテストフレームワーク。自然言語で書いた目標に沿ってエージェントがアプリを操作し、同じテスト内でロケーターとアサーションによって結果を検証する。後続のアサーションで検証されたエージェントの操作は記録され、アプリが変わるまでは次回以降モデルを呼ばずに再生する。WebはPlaywright経由でChromium、Firefox、WebKitに、モバイルはiOS／Androidのシミュレーターとエミュレーターに対応する。 | Apache-2.0。TesterArmy製。導入: <code>npx e2e init</code><br>1.0前のため、マイナーリリース間でもAPIと設定が変わる可能性がある。CLIは匿名の利用状況データを送信する。無効化: <code>npx e2e telemetry disable</code> |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)<br>⭐ 101,034 | 要件定義、計画、実装、テスト、レビュー、リリースまでの工程と品質ゲートを、Claude CodeやCodexなどへ守らせる実務向けSkill集。 | |
| [mattpocock/skills](https://github.com/mattpocock/skills)<br>⭐ 275,764 | `grill-me`や`grill-with-docs`による要件の掘り下げ、用語整理、チケット運用など、開発者が制御権を維持するための小さなSkillを収録する。 | |
| [trailofbits/skills](https://github.com/trailofbits/skills)<br>⭐ 7,359 | Trail of Bitsが公開するセキュリティ向けSkill／Plugin集。コード監査、差分レビュー、静的解析、Semgrep、依存関係、GitHub Actionsなどを対象とする。 | |
| [zhaoxuya520/reverse-skill](https://github.com/zhaoxuya520/reverse-skill)<br>⭐ 39,598 | リバースエンジニアリング、許可を得たペネトレーションテスト、セキュリティ研究向けのSkillルーター集。APK、実行ファイル、フロントエンドJSの暗号化処理、マルウェア、CTFなどの対象に応じて、AIコーディングエージェントを適切な手順と道具（jadx、Frida、IDA、radare2など）へ振り分ける。手元のツールの検出、許可範囲（スコープ）の確認、証拠の記録、レポート作成までの作業手順を備え、作業で得た知見を蓄積して再利用する。 | MIT（同梱の`CTF-Sandbox-Orchestrator/`はGPLv3）。<br>利用は、自分が管理するシステムか、明示的に検査の許可を得たシステムに限られる。<br>READMEや`README_AI.md`にAIエージェント向けの指示が含まれ、ツールを導入するスクリプトも同梱されるため、エージェントに読ませる前に内容を確認する。<br>Java、Node.js 22.12以降、Python 3が必要。 |
| [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)<br>⭐ 154,338 | AIコーディングエージェントが不要な依存関係や抽象化を増やす動作を抑え、既存実装、標準ライブラリ、プラットフォーム標準機能を優先させるルールセット兼Plugin。 | |
| [humanlayer/skills](https://github.com/humanlayer/skills)<br>⭐ 4,917 | Claude Code向けSkill集。図やHTMLで説明する `show-me`、CLAUDE.md改善、React型整理などを収録する。 | |
| [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)<br>⭐ 53,395 | コーディングエージェントの回答を、次の行動から始める、手順を番号化する、脱線や不要な前置き・締めを抑えるなど、ADHDに配慮した実行しやすい出力へ整えるSkill／Plugin。 | `/i-have-adhd`（Codexは`$i-have-adhd`）で明示的に有効化。 |
| [saurabhkumar8112/cyclomatic-complexity-skill](https://github.com/saurabhkumar8112/cyclomatic-complexity-skill)<br>⭐ 404 | 関数の循環的複雑度を計測し、ガード節や関数抽出によって複雑なコードをリファクタリングするClaude Skill。 | |
| [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)<br>⭐ 216,799 | Andrej Karpathy氏の指摘を基に、AIの過剰実装や未確認の思い込みを抑えるCLAUDE.md。 | |

## 4. 業務・調査・図解向けSkill集

| リンク | 解説 | その他 |
| --- | --- | --- |
| [Ted0321/kotetsu-work-ai-skills](https://github.com/Ted0321/kotetsu-work-ai-skills)<br>⭐ 56 | 論点整理、調査結果からの示唆抽出、資料レビュー、企業調査、HTMLレポート作成など、業務を進めるための日本語Skill集。 | |
| [ReScienceLab/opc-skills](https://github.com/ReScienceLab/opc-skills)<br>⭐ 1,842 | 個人開発者や一人会社向けに、需要調査、SEO／GEO、ドメイン探索、ロゴ・バナー制作などをAIへ実行させるSkill集。 | |
| [SeanJ1ang/design-judge-skills](https://github.com/SeanJ1ang/design-judge-skills)<br>⭐ 712 | デザイン賞の公式情報確認、作品評価、応募先選定、申請文作成、提出前確認を、根拠と採点基準を残しながら実行するSkill集。 | |
| [imxv/Pretty-mermaid-skills](https://github.com/imxv/Pretty-mermaid-skills)<br>⭐ 1,511 | MermaidソースからSVG、PNG、ターミナル向け表現をローカル生成するSkill。Mermaidの構文を維持したまま見た目を整える用途に向く。 | |
| [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design)<br>⭐ 43,295 | アーキテクチャ図、状態遷移、シーケンス、ロードマップなどを、HTML＋SVGの編集可能な図として生成するSkill。Mermaid以外の誌面向けレイアウトを作る用途に向く。 | |
| [sagochiko/aws-drawio-diagram-skill](https://github.com/sagochiko/aws-drawio-diagram-skill)<br>⭐ 35 | AWSの構成を箇条書きで伝えるだけで、AWS公式アイコンを使った構成図をdraw.io形式（`.drawio`）で描くClaude Code向けSkill。枠の入れ子、ラベルの位置、線の引き方、色などの描き方をSkill側で定め、タイトルや凡例などの飾りを足さない。既存の`.drawio`へのサービス追加にも対応する。 | Apache-2.0。AWSとdraw.ioの公式Skillではない。<br>Claude Codeへ導入: <code>/plugin marketplace add sagochiko/aws-drawio-diagram-skill</code>、<code>/plugin install aws-drawio-diagram@aws-drawio-diagram-skill</code><br>Python 3が必要。draw.io desktopがあると、PNGへ書き出して描画結果を確認してから渡す。動作確認はmacOSのみで、Windowsでは未確認。 |
| [koala73/worldmonitor](https://github.com/koala73/worldmonitor)<br>⭐ 87,753 | ニュース、地政学、災害、インフラなどの世界情勢を集約するリアルタイム監視ダッシュボード。 | |
| [ferdinandobons/startup-skill](https://github.com/ferdinandobons/startup-skill)<br>⭐ 1,162 | 市場調査、競合分析、価格分析、事業アイデア検証などを実行するスタートアップ向けSkill集。 | |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)<br>⭐ 92,490 | AIが生成するWeb UIから、凡庸な配色・レイアウト・装飾を減らすためのデザイン規則を提供する。 | |
| [plannotator/effective-html](https://github.com/plannotator/effective-html)<br>⭐ 3,528 | AIにHTML形式のワイヤーフレーム、プロトタイプ、計画書、図解を生成させるAgent Skill集。 | |
| [nicobailon/visual-explainer](https://github.com/nicobailon/visual-explainer)<br>⭐ 10,242 | ターミナルのASCII図や大きな表の代わりに、構成図、差分レビュー、計画と実装の照合、プロジェクトの振り返りなどを自己完結型のHTMLページまたはスライドとして生成するAgent Skill。`/diff-review`、`/plan-review`、`/fact-check`などのコマンドと、テーマ切替、PPTX出力、ローカルMCPサーバーを備える。 | MIT。Claude Codeへ導入: <code>/plugin marketplace add nicobailon/visual-explainer</code>、<code>/plugin install visual-explainer@visual-explainer-marketplace</code><br>出力先は既定で<code>~/.agent/diagrams/</code>。 |
| [mathbullet/skills](https://github.com/mathbullet/skills)<br>⭐ 170 | 日本語説明、出典付き調査、論文解説、HTML図解などの出力規則を定義したAgent Skill集。 | |
| [japanese-tech-writing/SKILL](https://gist.github.com/k16shikano/fd287c3133457c4fd8f5601d34aa817d)<br>⭐ 2,088 | 日本語の技術文書・書籍原稿向けの文章規範。段落構成、論証の厳密さ、読み手の負荷、LLMらしい空句、翻訳調の比喩、冗長さなどを点検する。 | Unlicense。 |
| [cognitive-rhythm-writing/SKILL](https://gist.github.com/k16shikano/eb2929f13ed19c97188393d297be8432)<br>⭐ 1,072 | 日本語の説明文に認知リズムを設計する文章規範。観察・逡巡・断定・再観察の切替、文の拍、段落の密度波形、未回収の緊張、問いの回収、駄文の点検などを扱う。 | `japanese-tech-writing/SKILL.md`との併用を前提とする。 |
| [nanaism/yomiyasu](https://github.com/nanaism/yomiyasu)<br>⭐ 1,367 | AIが生成した日本語を、読みやすく情報密度の高い日本語へ推敲するAgent Skill。動作主の復元、非生物主語の解体、比喩動詞の具体的な操作への置き換えなど7つの変換原則を適用し、tech／business／essayのドメイン別に文体を調整する。AIっぽさを検査する`yomiyasu_lint.py`と、推敲前後の意味の変化を確認する`yomiyasu_diff.py`を同梱する。 | MIT。導入: <code>npx skills add nanaism/yomiyasu</code><br>他の日本語校正Skillと同時に有効化すると指示が干渉するため、類似Skillを一時的に無効化して使う。 |
| [coji/natural-japanese](https://github.com/coji/natural-japanese)<br>⭐ 1,863 | 議事録、調査レポート、社内ガイド、企画書、ブログ記事など、仕事の日本語を読みやすく書く・直すためのAgent Skill。書く前に見出しの骨組みを固めて12箇条の文体ルールを適用し、それでも残る定型句、単調な文のリズム、英語の直訳調を形態素解析（sudachipy）による`lint.py`で検出する。直すかどうかの判断は機械に任せず、6軸の推敲基準を満たすまでエージェントが推敲を繰り返す。 | MIT。導入: <code>npx skills add coji/natural-japanese</code><br>書き換えずに自然度（0〜100）だけを測る: <code>/natural-japanese score &lt;ファイル&gt;</code><br>検査スクリプトを単体で使うにはuvが必要。`japanese-tech-writing/SKILL.md`の空句の分類を参考にしている。 |

## 5. Skillの生成・変換・評価

| リンク | 解説 | その他 |
| --- | --- | --- |
| [virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)<br>⭐ 33,612 | PDF、EPUB、DOCX、Markdown、HTMLなどの資料を、章別参照、用語集、パターン、チートシートを備えたAgent Skillへ変換する。 | |
| [microsoft/skill-recorder](https://github.com/microsoft/skill-recorder)<br>⭐ 4,192 | 人間の画面操作と任意の音声説明を記録し、GitHub Copilot CLIで手順を復元して、SkillまたはAutomationへ変換する。 | 解析時には記録データがGitHubのクラウドへ送信されるため、機密情報を録画へ含めない。 |
| [microsoft/waza](https://github.com/microsoft/waza)<br>⭐ 1,391 | Agent Skillの評価スイートを作成し、ベンチマーク、採点、モデル比較、評価要件の充足確認を実行するGo製CLI。 | Windowsへ導入: <code>irm https://raw.githubusercontent.com/microsoft/waza/main/install.ps1 \| iex</code><br>雛形作成: <code>waza init my-project</code>、<code>cd my-project</code>、<code>waza new skill my-skill</code>、<code>waza new eval my-skill</code><br>評価・構造検査: <code>waza run my-skill -v</code>、<code>waza check skills/my-skill</code><br>一時的にPATHを追加: <code>$env:Path += ";$env:LOCALAPPDATA\Microsoft\Waza"</code> |
| [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt)<br>⭐ 18,004 | モデルの重みを変えずに、Skill文書そのものを学習対象として最適化するPython製フレームワーク。実行結果の採点を基に追加・削除・置換の編集を提案し、検証スコアが改善した編集だけを採用して、配布可能な`best_skill.md`を出力する。 | MIT。導入: <code>pip install skillopt</code><br>過去のセッションから夜間にSkillを改善する`skillopt-sleep` CLIも同梱（Claude Code、Codex、Copilot向けの連携ファイルはリポジトリ側にある）。 |

## 6. Cookbook・実装例

| リンク | 解説 | その他 |
| --- | --- | --- |
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks)<br>⭐ 53,178 | Claude API、Claude Agent SDK、Managed Agents、評価、ツール利用などの実装例を収録する。 | <code>patterns/agents/</code>: 直列処理、並列処理、ルーティング、評価・改善ループなどのエージェント設計パターン<br><code>claude_agent_sdk/</code>: エージェント、サブエージェント、動的ワークフロー、ホスティング<br><code>managed_agents/</code>: 継続実行するエージェント、外部サービス連携、セルフホスト型サンドボックス<br><code>skills/</code>: Skills APIとSkill利用の実装例<br><code>evals/</code>、<code>tool_evaluation/</code>: エージェントおよびツールの評価例<br><code>cost_optimization/</code>: 成功率、品質、コストを比較して構成を選ぶ例 |

## 7. AI駆動開発の方法論・ワークフロー

| リンク | 解説 | その他 |
| --- | --- | --- |
| [obra/superpowers](https://github.com/obra/superpowers)<br>⭐ 295,147 | 対話による仕様化、設計承認、実装計画、TDD、サブエージェントによる実装とレビューを組み合わせた、Skillベースのソフトウェア開発方法論。 | |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)<br>⭐ 53,771 | PM、アーキテクト、開発者などの役割を分け、規模に応じて企画、要件、設計、実装の深さを変えるAI駆動開発手法。 | |
| [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)<br>⭐ 4,980 | AWS LabsのAI-Driven Development Life Cycle実装。5フェーズ、33ステージ、複数の専門エージェント、各段階の承認ゲートによって開発工程を制御する。 | |
| [garrytan/gstack](https://github.com/garrytan/gstack)<br>⭐ 135,036 | CEO、エンジニアリングマネージャー、デザイナー、QA、セキュリティ、リリースなどの役割を持つSkillを、企画・レビュー・出荷の工程で使い分ける開発ワークフロー。 | |
| [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)<br>⭐ 10,157 | Discuss、Plan、Execute、Verify、Shipのフェーズを繰り返し、重い調査・計画・実装を新しいコンテキストのサブエージェントへ分離する開発フレームワーク。 | 旧`gsd-build/get-shit-done`はアーカイブ済みで、現在はこのリポジトリへ移転。 |
| [github/spec-kit](https://github.com/github/spec-kit)<br>⭐ 140,084 | constitution、specify、plan、tasks、implementなどの成果物とコマンドを使い、仕様を実装の基準として残すGitHub製ツールキット。 | |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)<br>⭐ 71,029 | 変更単位でproposal、requirements、design、tasksを作成し、実装後に変更記録をアーカイブする仕様駆動開発フレームワーク。 | |
| [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering)<br>⭐ 18,915 | AIエージェントを制御するハーネスの設計を、初学者向けに段階的に解説するチュートリアル。 | |

## 8. 汎用エージェントSDK・実行基盤

| リンク | 解説 | その他 |
| --- | --- | --- |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework)<br>⭐ 13,938 | Python、.NET、Goでエージェントとマルチエージェントワークフローを構築するSDK。直列、並列、引き継ぎ、チェックポイント、Human-in-the-loop、OpenTelemetryなどを扱う。 | |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python)<br>⭐ 29,829 | OpenAIのPython向けAgents SDK。エージェント、ツール、引き継ぎ、ガードレール、セッション、トレーシングを実装する。 | |
| [google/adk-python](https://github.com/google/adk-python)<br>⭐ 21,702 | GoogleのPython向けAgent Development Kit。モデルやデプロイ先を固定せず、エージェント、ツール、ワークフロー、評価を実装する。 | |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph)<br>⭐ 42,704 | 状態を持つ長時間実行ワークフローをグラフとして実装するフレームワーク。中断・再開、人間承認、永続化を必要とする処理に向く。 | |
| [vercel/eve](https://github.com/vercel/eve)<br>⭐ 5,455 | instructions、tools、skills、channels、schedulesをファイルとして管理する、ファイルシステム中心の永続型エージェントフレームワーク。 | 現在はベータ版。 |
| [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)<br>⭐ 251,115 | CLIや各種メッセージングチャネルから利用できる汎用エージェント本体。会話検索、ユーザー情報の継続利用、Skillの生成・更新、スケジュール実行、サブエージェント、複数の実行バックエンドを備える。 | |

## 8. 汎用エージェントSDK・実行基盤｜AIエージェント環境・運用基盤

| リンク | 解説 | その他 |
| --- | --- | --- |
| [odysseus-dev/odysseus](https://github.com/odysseus-dev/odysseus)<br>⭐ 89,305 | AIエージェント、検索、画像生成などを自分の環境で運用するセルフホスト型AIワークスペース。 | |
| [lobehub/lobehub](https://github.com/lobehub/lobehub)<br>⭐ 82,981 | 複数のAIエージェントを登録し、スケジュール実行や作業報告を管理するAIエージェント運用基盤。 | |
| [CherryHQ/cherry-studio](https://github.com/CherryHQ/cherry-studio)<br>⭐ 52,357 | 複数のLLM、チャット、ナレッジベース、AIエージェント、300種類以上のアシスタントを統合するデスクトップアプリ。 | |

## 9. コーディングエージェントの実行・オーケストレーション｜プロジェクト／組織単位の制御

| リンク | 解説 | その他 |
| --- | --- | --- |
| [paperclipai/paperclip](https://github.com/paperclipai/paperclip)<br>⭐ 96,982 | 複数のAIエージェントへ目標と仕事を割り当て、組織図、権限、承認、予算、進捗、監査情報を一元管理するNode.js＋React製のOSS。 | |
| [Untrivial-ai/agent-orchestrator](https://github.com/Untrivial-ai/agent-orchestrator)<br>⭐ 12,726 | タスクごとにブランチとWorktreeを分離し、複数のコーディングエージェント、差分、PR、CI、レビューをKanban形式で管理するローカルデスクトップアプリ。 | |
| [stablyai/orca](https://github.com/stablyai/orca)<br>⭐ 84,742 | Claude Code、Codex、OpenCodeなどをタスク別のWorktree・ターミナル・ブラウザで並列実行するAgent Development Environment。Run、Task、Dispatch、メッセージ、判断ゲートによる構造化オーケストレーションも提供する。 | |

## 9. コーディングエージェントの実行・オーケストレーション｜プロジェクト／組織単位の制御｜stablyai/orca

| リンク | 解説 | その他 |
| --- | --- | --- |
| [Orca Docs](https://www.onorca.dev/docs) | Orcaの公式ドキュメント。 | |
| [Orchestration](https://www.onorca.dev/docs/cli/orchestration) | Orcaのオーケストレーション機能の説明。 | 現時点ではExperimental。 |

## 9. コーディングエージェントの実行・オーケストレーション｜コーディングエージェント

| リンク | 解説 | その他 |
| --- | --- | --- |
| [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)<br>⭐ 89,962 | コード編集、コマンド実行、テスト、問題修正を自律的に進めるOSSのAI開発エージェント。 | |
| [cline/cline](https://github.com/cline/cline)<br>⭐ 69,828 | IDE拡張、CLI、SDKとして利用できる自律型コーディングエージェント。ファイル編集やコマンド実行に対応する。 | |
| [aaif-goose/goose](https://github.com/aaif-goose/goose)<br>⭐ 54,937 | LLMを選択して、コード編集、コマンド実行、テスト、外部ツール連携を行える拡張可能なAIエージェント。 | |

## 9. コーディングエージェントの実行・オーケストレーション｜ターミナル／セッション単位の実行

| リンク | 解説 | その他 |
| --- | --- | --- |
| [herdrdev/herdr](https://github.com/herdrdev/herdr)<br>⭐ 42,179 | 複数のコーディングエージェントを実ターミナル上で継続稼働させるターミナルマルチプレクサ兼バックグラウンドランタイム。各ペインの稼働中・待機中・停止状態を集約し、CLIやスクリプトから操作できる。 | |
| [Herdr Docs](https://herdr.dev/docs/agents/) | 対応するエージェント、ペイン管理、状態検出の説明。 | |
| [Herdr Agent automation](https://herdr.dev/docs/agent-automation/) | スクリプトまたは別のエージェントが、エージェントの起動、状態確認、入力、結果回収を行う方法。 | |

## 9. コーディングエージェントの実行・オーケストレーション｜オーケストレーターのカタログ

| リンク | 解説 | その他 |
| --- | --- | --- |
| [andyrewlee/awesome-agent-orchestrators](https://github.com/andyrewlee/awesome-agent-orchestrators)<br>⭐ 2,092 | エージェントへの仕事の割当、実行場所、実行時刻、成果物の処理を制御するツールとフレームワークの一覧。 | |

## 10. コンテキスト・知識・記憶基盤

| リンク | 解説 | その他 |
| --- | --- | --- |
| [trailhq/Graft](https://github.com/trailhq/Graft)<br>⭐ 9,560 | コードベースの構造、依存関係、変更影響をグラフ化し、Claude CodeやCodexなどへタスクに関係するコード情報を渡すコンテキスト層。 | |
| [semantica-agi/semantica](https://github.com/semantica-agi/semantica)<br>⭐ 13,642 | AIが使用する情報をコンテキストグラフ、知識グラフ、オントロジー、意思決定履歴として保存し、根拠と経路を追跡できるPython基盤。 | |
| [nashsu/llm_wiki](https://github.com/nashsu/llm_wiki/blob/main/README_JA.md)<br>⭐ 20,194 | 文書を取り込み、相互リンクされたWikiと知識グラフを継続更新するデスクトップアプリ。検索、出典参照、MCP、Agent Skillを提供する。 | |
| [Andrej Karpathy: LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) | LLMが資料を読み、正規化されたWikiを増分更新するナレッジ管理パターン。 | `nashsu/llm_wiki`が実装する元の考え方。 |
| [GoogleCloudPlatform/knowledge-catalog — OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)<br>⭐ 9,374 | Open Knowledge Format（OKF）の資料と実装例。AIエージェントへ知識を渡す際の、機械可読な知識パッケージを扱う。 | |
| [Open Knowledge Formatの解説](https://cloud.google.com/blog/ja/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/) | Google CloudによるOKFの目的と利用方法の解説。 | |
| [infiniflow/ragflow](https://github.com/infiniflow/ragflow)<br>⭐ 91,668 | 文書解析、検索、引用付き回答、エージェント機能を提供するRAG基盤。 | |
| [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)<br>⭐ 85,245 | コードベースを解析し、ファイル、関数、依存関係を対話可能なナレッジグラフへ変換する。Codexにも対応する。 | |
| [upstash/context7](https://github.com/upstash/context7)<br>⭐ 62,664 | ライブラリの最新公式ドキュメントを取得し、AIコーディングツールへ渡すMCP対応サービス。 | |
| [MemPalace/mempalace](https://github.com/MemPalace/mempalace)<br>⭐ 59,407 | 会話履歴を要約せず原文のままローカル保存し、階層構造と意味検索によってAIへ過去情報を返す長期記憶基盤。 | |
| [vectorize-io/hindsight](https://github.com/vectorize-io/hindsight)<br>⭐ 45,344 | 会話を思い出すだけでなく、経験から学習することを目指すAIエージェント向けの記憶基盤。retain（記憶の保存）、recall（検索）、reflect（記憶を分析して新しい理解を作る）の3操作を提供する。recallでは、意味検索、キーワード検索（BM25）、エンティティ間の関係をたどるグラフ検索、時間範囲での絞り込みを並列に実行する。記憶はユーザー、エージェント、プロジェクトごとに分離して保存する。MCPエンドポイントも標準で備える。 | MIT。サーバーはDockerやpipで起動し、LLMのAPIキーまたは既存のサブスクリプションを使う。有料のマネージド版（Hindsight Cloud）もある。<br>コーディングエージェントへ導入: <code>npx @vectorize-io/hindsight-coding-agents install claude-code</code>（Gitの履歴と過去のセッションから、リポジトリごとの記憶を自動で作る） |

## 11. 評価・観測・改善

| リンク | 解説 | その他 |
| --- | --- | --- |
| [microsoft/AI-Engineering-Coach](https://github.com/microsoft/AI-Engineering-Coach)<br>⭐ 4,309 | ローカルのAIコーディングセッション履歴を解析し、プロンプト、セッション管理、レビュー、ツール利用、コンテキスト管理の傾向を可視化するVS Code拡張機能。 | Marketplace配布ではないため、利用者がVSIXをビルドする。 |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo)<br>⭐ 25,697 | LLMアプリとエージェントの評価、モデル比較、回帰テスト、レッドチーミングをCLIとCI/CDで実行するOSS。 | |
| [langfuse/langfuse](https://github.com/langfuse/langfuse)<br>⭐ 35,366 | LLMアプリのトレース、プロンプト管理、評価、メトリクスを扱うオープンソースの観測基盤。セルフホストにも対応する。 | |
| [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix)<br>⭐ 11,703 | OpenTelemetryベースで、LLM／エージェントのトレース、評価、実験、問題分析を行うオープンソース基盤。 | |

## 12. 意思決定記録・設計履歴

| リンク | 解説 | その他 |
| --- | --- | --- |
| [architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record)<br>⭐ 17,082 | Architecture Decision Record（ADR）の説明、テンプレート、関連ツールを集めた情報ハブ。ADRは、重要な技術判断、その前提、採用理由、結果を文書として残す。 | |
| [adr/madr](https://github.com/adr/madr)<br>⭐ 2,534 | Markdown Architectural Decision Records（MADR）のテンプレート。ADRをMarkdownで統一して管理する。 | |
| [AIとの対話履歴を資産にするDDR](https://zenn.dev/softbank/articles/ee93e87a9d5dac) | AIとの対話からDesign Decision Record（DDR）を自動記録し、設計判断の理由と変更経緯を残す事例。 | |

## 13. 付帯ツール

| リンク | 解説 | その他 |
| --- | --- | --- |
| [microsoft/coreutils](https://github.com/microsoft/coreutils)<br>⭐ 5,223 | `ls`、`cat`、`grep`、`find`などのUNIX系コマンドをWindows上で提供するMicrosoft管理のプレビュー版。 | PowerShellの同名エイリアスや組み込みコマンドとの競合に注意。導入: <code>winget install Microsoft.Coreutils</code> |
| [vercel-labs/portless](https://github.com/vercel-labs/portless)<br>⭐ 12,643 | `localhost:5173`のようなポート番号を、安定した名前付きローカルURLへ置き換える開発ツール。 | |
| [GitHubSecurityLab/gh-secure](https://github.com/GitHubSecurityLab/gh-secure)<br>⭐ 509 | GitHub Security Labの推奨設定に沿って、リポジトリのセキュリティ機能を有効化するGitHub CLI拡張機能。ブランチ保護、非公開の脆弱性報告、シークレットスキャン、Dependabot、CodeQLによるコードスキャンの5機能を、対話形式または一括で設定する。GitHub Copilot CLIなどのAIアシスタントから呼び出して、現状の確認や不足機能の有効化を任せることもできる。 | MIT。導入: <code>gh extension install GitHubSecurityLab/gh-secure</code><br>現状を確認: <code>gh secure status</code><br>変更内容を事前に確認: <code>gh secure --yes --dry-run</code><br>対象リポジトリの管理者またはmaintain権限が必要。ブランチ保護を有効化すると、既定ブランチへの直接pushができなくなる場合がある。 |
