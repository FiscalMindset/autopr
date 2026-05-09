# Graph Report - .  (2026-05-09)

## Corpus Check
- Corpus is ~40,575 words - fits in a single context window. You may not need a graph.

## Summary
- 164 nodes · 259 edges · 15 communities (12 shown, 3 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend Components|Frontend Components]]
- [[_COMMUNITY_Backend Core Logic|Backend Core Logic]]
- [[_COMMUNITY_System Architecture|System Architecture]]
- [[_COMMUNITY_Content Processing|Content Processing]]
- [[_COMMUNITY_Email & Distribution|Email & Distribution]]
- [[_COMMUNITY_AI Content Generation|AI Content Generation]]
- [[_COMMUNITY_UI Widgets|UI Widgets]]
- [[_COMMUNITY_Orchestration|Orchestration]]
- [[_COMMUNITY_WhatsApp Integration|WhatsApp Integration]]
- [[_COMMUNITY_Instagram Integration|Instagram Integration]]

## God Nodes (most connected - your core abstractions)
1. `utc_now_iso()` - 12 edges
2. `build_preview_package()` - 10 edges
3. `write_run_snapshot()` - 8 edges
4. `sync_run_with_kestra()` - 8 edges
5. `trigger_kestra_flow()` - 7 edges
6. `upsert_run_preview()` - 7 edges
7. `fetch_repositories()` - 7 edges
8. `make_run_id()` - 6 edges
9. `read_run_snapshot()` - 6 edges
10. `summarize_kestra_execution()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `github_webhook()` --calls--> `GenerateRequest`  [EXTRACTED]
  backend/main.py → backend/main.py  _Bridges community 1 → community 4_
- `mock_repositories()` --calls--> `utc_now_iso()`  [EXTRACTED]
  backend/main.py → backend/main.py  _Bridges community 3 → community 1_
- `build_preview_package()` --calls--> `utc_now_iso()`  [EXTRACTED]
  backend/main.py → backend/main.py  _Bridges community 3 → community 4_
- `build_preview_package()` --calls--> `generate_posts_with_ai()`  [EXTRACTED]
  backend/main.py → backend/main.py  _Bridges community 5 → community 4_

## Hyperedges (group relationships)
- **Core AutoPR Architecture** — concept_frontend, concept_backend, concept_kestra [EXTRACTED 1.00]
- **GitHub to Kestra Execution Flow** — concept_concept_github, concept_concept_webhook, concept_concept_backend, concept_concept_kestra [EXTRACTED 0.95]
- **Core AutoPR Architecture** — concept_frontend, concept_backend, concept_kestra [EXTRACTED 1.00]
- **GitHub to Kestra Execution Flow** — concept_concept_github, concept_concept_webhook, concept_concept_backend, concept_concept_kestra [EXTRACTED 0.95]

## Communities (15 total, 3 thin omitted)

### Community 0 - "Frontend Components"
Cohesion: 0.05
Nodes (25): actionDefaults, ActionPhase, ActionState, AiGeneration, BackendDefaults, CommitItem, CommitRefPayload, DeliveryStatus (+17 more)

### Community 1 - "Backend Core Logic"
Cohesion: 0.1
Nodes (34): CommitRef, compact_value(), config_defaults(), effective_github_token(), extract_final_summary(), fetch_commits(), fetch_pull_requests(), fetch_repositories() (+26 more)

### Community 2 - "System Architecture"
Cohesion: 0.08
Nodes (27): AutoPR, Backend, Data Storage, Docker, Docker Compose, Executor, FastAPI, Flow (+19 more)

### Community 3 - "Content Processing"
Cohesion: 0.15
Nodes (23): analyze_linkedin_style(), analyze_style_samples(), ensure_storage(), generate_content(), get_run(), health_check(), import_algsoch_style(), list_posts() (+15 more)

### Community 4 - "Email & Distribution"
Cohesion: 0.17
Nodes (12): build_preview_package(), collect_keywords(), compute_delivery_status(), derive_context_bundle(), github_webhook(), pick_raw_update(), Send generated post content via email with professional styling., Send email notification via Gmail SMTP. (+4 more)

### Community 5 - "AI Content Generation"
Cohesion: 0.43
Nodes (7): ai_generation_prompt(), build_post_variants(), extract_json_object(), generate_posts_with_ai(), generate_with_gemini(), generate_with_groq(), normalize_generated_posts()

### Community 6 - "UI Widgets"
Cohesion: 0.4
Nodes (5): ActionCard(), App(), deliveryMeaning(), executionStatusTone(), statusTone()

## Knowledge Gaps
- **27 isolated node(s):** `Send email notification via Gmail SMTP.`, `Send generated post content via email with professional styling.`, `RepoItem`, `CommitItem`, `PullRequestItem` (+22 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `send_email()` connect `Email & Distribution` to `Backend Core Logic`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `send_post_email()` connect `Email & Distribution` to `Backend Core Logic`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `utc_now_iso()` connect `Content Processing` to `Backend Core Logic`, `Email & Distribution`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `Backend` (e.g. with `Data Storage` and `WebHook`) actually correct?**
  _`Backend` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Send email notification via Gmail SMTP.`, `Send generated post content via email with professional styling.`, `RepoItem` to the rest of the system?**
  _27 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Backend Core Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._