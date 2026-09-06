# Link

## skills

- https://github.com/anthropics/skills
  
- https://github.com/mattpocock/skills  
  grillingを含む開発作業の進め方をエージェントに教えるスキル集

- https://github.com/virgiliojr94/book-to-skill  

- https://github.com/imxv/Pretty-mermaid-skills  
  
- https://github.com/mattpocock/skills  

- https://github.com/cathrynlavery/diagram-design    

- https://github.com/Ted0321/kotetsu-work-ai-skills    
  仕事が前に進むAIスキルを配るリポジトリ  

- https://github.com/ReScienceLab/opc-skills  
  個人開発者向けに、需要調査・SEO・ドメイン探索・画像制作などをAIへ実行させる Agent Skill集

- https://github.com/DietrichGebert/ponytail  
  Ponytailは、AIコーディングエージェントの 過剰実装を抑制するためのルールセット兼プラグイン  

- https://github.com/SeanJ1ang/design-judge-skills  
  デザイン賞の調査・作品評価・応募先選定・申請文作成・提出前確認を、AIエージェントに実行させるスキル集

## cookbooks
- https://github.com/anthropics/claude-cookbooks  
    ```
    patterns/agents	エージェント設計パターン
    claude_agent_sdk	Claude Agent SDKの実装
    managed_agents	クラウド上で管理するエージェント
    skills	Skills APIの使用例
    evals・tool_evaluation	エージェントとツールの評価
    observability	実行状況の観測
    cost_optimization	品質・コスト・成功率の比較
    ```
    
## フレームワーク

- https://github.com/bmad-code-org/BMAD-METHOD    
  BMAD(Breakthrough Method for Agile AI-Driven Development )    
 
- https://github.com/obra/superpowers    
  superpowers
  
- https://github.com/awslabs/aidlc-workflows  
  AI駆動開発ライフサイクル（AI-DLC）

- https://github.com/paperclipai/paperclip  
  複数のAIエージェントへ仕事を割り当て、実行・承認・予算・進捗を一元管理するOSS

## ツール

- https://github.com/microsoft/waza  
  Agent Skillを作成し、テスト・採点・モデル比較・品質改善まで行う Skill向け評価CLI／フレームワーク です
  ```
  $env:Path += ";C:\Users\yu_ki\AppData\Local\Microsoft\Waza"
  ```
  - 評価を実行する
    ```
    waza run my-skill -v -o results.json
    ```
  - Skillの構造や評価定義を検査する場合
    ```
    copilot login
    waza models
    waza run my-skill --executor copilot-sdk --model <表示されたモデルID> -v -o results.json
    ```
  
- https://github.com/microsoft/skill-recorder  
  人間の画面操作を録画し、その手順をAIエージェント用のSkillへ変換するツール  

- https://github.com/nashsu/llm_wiki/blob/main/README_JA.md  
  LLM Wiki

- https://github.com/semantica-agi/semantica  
  AIエージェントが利用する情報を「文脈グラフ・知識グラフ・意思決定履歴」として保存・検索・説明するPython基盤  
  
## VS Code拡張機能  

- https://github.com/microsoft/AI-Engineering-Coach  
  ローカルセッション履歴を解析し、AIを使った開発方法を採点・改善するVS Code拡張機能
## IDE/Terminal

- https://github.com/Untrivial-ai/agent-orchestrator  
  複数のコーディングAIを並列実行し、Worktree・PR・CI・レビューまで一元管理するデスクトップ型Agent IDE
- Orca
- Herdr

## 付帯ツール  
- https://github.com/microsoft/coreutils   
  ls, catをWindwosで動かすためのツール  
  `winget install Microsoft.Coreutils` ※管理者権限  
  
## そのほか  

- https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f  
  LLM Wiki (LLM Knowledge Base)    
  Andrej Karpathy提唱のナレッジ管理手法

- https://cloud.google.com/blog/ja/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/  
  Google製LLM Wikiの標準化（Open Knowledge Format（OKF））    
  - https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf    
  
- https://agent-plugins.org/  
  スキルやMCPサーバ設定の共通
  
- https://github.com/architecture-decision-record/architecture-decision-record  
  Architecture decision record (ADR)    
  アーキテクチャ決定レコード(ADR)は、重要なアーキテクチャの決定とその文脈、結果を記録する文書。   
  例:マイクロサービス採用、認証方式、DB選定、マルチリージョン構成  

- https://github.com/adr/madr    
  Markdown Architectural Decision Records(MADR)

- https://zenn.dev/softbank/articles/ee93e87a9d5dac
  Design Decision Record  
  Zenn(AIとの対話履歴を資産にする。DDR（Design Decision Record）自動記録の仕組み)

  
