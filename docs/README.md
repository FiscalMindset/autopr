# AutoPR Engine 🚀

**AI Content Orchestration & Distribution System**

Transform GitHub commits and project updates into beautifully crafted social media posts—automatically. **AutoPR Engine** is a production-grade orchestration system built on **Kestra** that analyzes raw input, generates platform-specific content using AI, and routes it to LinkedIn, Twitter/X, Instagram, WhatsApp, and email—all through declarative workflows, no backend server required.

## 🎯 What It Does

**Input** → GitHub commit, project note, or manual update  
**Process** → Kestra workflow orchestrates analysis, AI generation, intelligent routing  
**Output** → Platform-specific posts delivered to 5+ channels simultaneously

```
GitHub Commit / Manual Input
    ↓
[Analyze Context] — GitHub API, repo history, commit metadata
    ↓
[Generate Content] — AI creates LinkedIn, Twitter/X, Instagram, WhatsApp versions
    ↓
[Route & Deliver] — Email + social media distribution
    ↓
[Archive & Report] — Track all runs with full audit trail
```

## ✨ What's New (May 2026)

### 🎯 Core Features
1. **GitHub Webhook Auto-Trigger** — Automatically starts Kestra execution on commits (no polling)
2. **Multi-Platform Content Generation** — Parallel AI generation optimized for each platform's tone and constraints
3. **Gmail Email Notifications** — Styled HTML emails with full post preview and attribution
4. **Interactive Dashboard** — React frontend with live run tracking, tab auto-scroll, and direct Kestra links
5. **Production-Ready Deployment** — Render.com guide (~$8-17/month) with full monitoring
6. **Knowledge Graph Analysis** — Automatic relationship extraction from your codebase (15 communities detected)

## 🌟 The Pitch

**Problem:** Developers waste hours writing release notes and social media updates after shipping features—repetitive, error-prone, and disconnected from actual code changes.

**Solution:** One-click orchestration. Throw a GitHub commit or project note at AutoPR Engine. Kestra handles everything: context analysis, AI generation, multi-platform formatting, and delivery. No backend server. No tedious manual posting.

**Impact:** Maintain a consistent developer voice across all platforms while staying focused on code, not marketing.

---

## 🚀 Quick Start (Choose Your Path)

### Path A: Pure Kestra (Recommended) — 5 minutes
**No backend server. No Python installation. Pure workflow orchestration.**

→ [KESTRA_QUICK_START.md](KESTRA_QUICK_START.md) — Start Kestra, upload flows, run a test execution.

**After setup:** Verify everything works with the checklist:  
→ [KESTRA_VERIFY.md](KESTRA_VERIFY.md)

---

### Path B: Full Stack (With Backend) — 15 minutes
**Includes optional FastAPI backend, React dashboard, and local development environment.**

→ [QUICKSTART.md](QUICKSTART.md) — Docker Compose setup for all components.

---

### Path C: Deep Dive (Advanced)
**Complete architecture, secrets management, Kestra-native auth, production tuning.**

→ [KESTRA_ONLY_SETUP.md](KESTRA_ONLY_SETUP.md) — Comprehensive reference guide for every knob and lever.

---

## 📚 Documentation Map

| Document | For Whom | Time |
|----------|----------|------|
| [KESTRA_QUICK_START.md](KESTRA_QUICK_START.md) | First time users | 5 min |
| [KESTRA_VERIFY.md](KESTRA_VERIFY.md) | Verification after setup | 10 min |
| [QUICKSTART.md](QUICKSTART.md) | Full stack dev | 15 min |
| [KESTRA_ONLY_SETUP.md](KESTRA_ONLY_SETUP.md) | Production deployment, deep reference | 45 min |
| [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) | Architecture decisions, why Kestra | 20 min |
| [FINAL_SUMMARY.md](FINAL_SUMMARY.md) | Technical comparison, approach rationale | 15 min |
| [DEPLOYMENT_RENDER.md](DEPLOYMENT_RENDER.md) | Deploy to production ($8-17/month) | 30 min |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | Test payloads and sample data | 10 min |
| [CREDENTIALS.md](CREDENTIALS.md) | GitHub, Gmail, API keys setup | 15 min |

## 🏗 Architecture

### Two Deployment Options

**Option 1: Kestra-Only (Recommended for Production)** ✅
```
┌─────────────────────────────────────────────┐
│  GitHub Webhook / Manual Input              │
└────────────┬────────────────────────────────┘
             │
      ┌──────▼──────────┐
      │  Kestra (All-in-One)         │
      ├──────────────────┤
      │ • HTTP Triggers  │ ◄────── Webhooks
      │ • Workflows      │
      │ • Task Executor  │
      │ • Secrets Mgmt   │
      │ • Mail Plugin    │
      │ • Postgres DB    │
      └──────┬───────────┘
             │
     ┌───────┴────────────────┬──────────────┐
     │                        │              │
  LinkedIn  Twitter/X  Instagram/WhatsApp  Email
```

**Option 2: Full Stack (With Optional Backend)**
```
┌─────────────────────────────────────────────┐
│  GitHub Webhook / React Frontend Input      │
└────────────┬────────────────────────────────┘
             │ HTTP API
      ┌──────▼──────────┐
      │  FastAPI        │ (Optional UI layer)
      │  Backend        │
      └────────┬────────┘
               │
      ┌────────▼──────────┐
      │  Kestra           │ (Core orchestration)
      │  Orchestrator     │
      └────────┬──────────┘
             (workflows same as above)
```

### Component Breakdown

| Component | Purpose | Technology | Required? |
|-----------|---------|------------|-----------|
| **Kestra** | Orchestration, workflow execution, task scheduling | Docker Compose + PostgreSQL | ✅ Yes |
| **GitHub API Integration** | Fetch commits, PRs, repo context | HTTP Plugin in Kestra | ✅ Yes |
| **AI Generation** | Create platform-specific content | Groq / Gemini (LLM APIs) | ✅ Yes |
| **FastAPI Backend** | Optional UI proxy, additional routes | Python FastAPI | ❌ No |
| **React Frontend** | Interactive dashboard (optional) | React + Vite | ❌ No |
| **Email Service** | Deliver notifications | Gmail SMTP or Kestra Mail Plugin | ✅ Yes |
| **Social Delivery** | Post to platforms | Manual/scheduled, or external APIs | Depends |

### Data Flow

```
Input Processing
  ├─ GitHub context (commits, PR, repo, author)
  ├─ Manual input (project, description, goal)
  └─ Style profile (past posts for tone matching)
        │
        ▼
Analysis Phase
  ├─ Extract key information
  ├─ Analyze existing style from GitHub
  └─ Generate content strategy
        │
        ▼
Parallel Generation (4 branches simultaneously)
  ├─ LinkedIn Post (professional, detailed, 2,000 char limit)
  ├─ Twitter/X Post (concise, hashtags, engagement, 280 char limit)
  ├─ Instagram Caption (creative, emojis, story-focused)
  └─ WhatsApp Message (casual, quick update)
        │
        ▼
Routing & Review
  ├─ Check if manual review needed
  ├─ Log to JSON (with full metadata)
  └─ Store in archive
        │
        ▼
Delivery
  ├─ Email notification (HTML-styled preview)
  ├─ Save to dashboard (for frontend viewing)
  └─ [Optional] Push to social platforms directly
```

## 🛠 Setup & Execution

### Option A: Pure Kestra (No Backend)

**Step 1: Start Kestra**
```bash
docker compose up -d kestra postgres
```
Kestra runs at: **http://localhost:8080**

**Step 2: Upload Flows**
- Go to Kestra UI → **Flows → Add**
- Upload files from `flows/` directory
- OR mount them as a volume (see `KESTRA_QUICK_START.md`)

**Step 3: Configure Secrets** (in Kestra UI)
- `github_token` — GitHub personal access token
- `groq_api_key` — Groq API key (for LLM)
- `gmail_address` + `gmail_password` — Gmail app password (2FA required)

**Step 4: Trigger a Run**
- Via GitHub webhook (set up in repo settings)
- Or manually in Kestra UI: **Execute** → fill inputs → **Run**

### Option B: Full Stack (With Backend + Frontend)

**Start everything:**
```bash
docker compose up -d
```

This starts:
- **Kestra UI**: http://localhost:8080
- **FastAPI Backend**: http://localhost:8000/docs (Swagger)
- **React Frontend**: http://localhost:3000

**Setup:**
- Use frontend to trigger generation or directly use Kestra UI
- Backend reads credentials from `.env` file
- See `QUICKSTART.md` for detailed backend setup

---

## ⚙️ Configuration Guide

### Environment Variables

**Kestra Secrets** (preferred, encrypted):
```
github_token        = "ghp_xxxx..."  # GitHub PAT
groq_api_key        = "gsk_xxxx..."  # Groq API key
gemini_api_key      = "AI..."        # Google Gemini API key (alternative)
gmail_address       = "your@gmail.com"
gmail_password      = "app_password" # 16-char app password for Gmail 2FA
```

**Backend .env** (if using FastAPI):
```bash
GMAIL=your@gmail.com
gmail_password=app_password

GITHUB_TOKEN=ghp_xxx
GROQ_API_KEY=gsk_xxx

KESTRA_API_URL=http://kestra:8080/api/v1
KESTRA_NAMESPACE=system.autopr
KESTRA_FLOW=autopr_main_flow
```

See [CREDENTIALS.md](CREDENTIALS.md) for step-by-step setup.

### GitHub Webhook Setup

1. Go to your GitHub repo → **Settings → Webhooks**
2. **Add webhook:**
   - Payload URL: `http://your-kestra-instance/api/v1/webhooks/github`
   - Content type: `application/json`
   - Events: `Pushes`, `Pull requests`
   - Active: ✅ Check

3. Kestra automatically triggers `autopr_main_flow` on each webhook event

---

## 📊 What the Graph Revealed

The knowledge graph analysis found:

- **15 communities** across code, docs, and workflows
- **164 nodes** (functions, concepts, components)
- **259 edges** (relationships, calls, references)
- **God nodes** (most central): `build_preview_package()`, `sync_run_with_kestra()`, `utc_now_iso()`
- **Surprising connections**: GitHub webhooks directly couple to generation (no intermediary), timestamps bridge 5+ communities

→ See [graphify-out/GRAPH_REPORT.md](../graphify-out/GRAPH_REPORT.md) for full analysis.

---

## 🔧 Troubleshooting

### "Email not found" or "Email not configured"

**Cause:** Gmail credentials not set or backend not restarted.

**Fix:**
1. Set `gmail` and `gmail_password` in `backend/.env` or environment
2. Create a Gmail app password (2FA required):
   - Google Account → Security → App passwords → Create password for "Mail"
   - Use the 16-char password, not your account password
3. Restart backend: `docker compose restart backend`
4. Test email in frontend, or manually POST to `/api/email` endpoint

See [CREDENTIALS.md](CREDENTIALS.md#gmail-setup) for details.

### Kestra Flows Not Loading

**Fix:**
- Kestra mounts flows from `./flows/` directory (see `docker-compose.yml`)
- If flows don't appear in UI, check volume mount:
  ```bash
  docker compose exec kestra ls -la /var/lib/kestra/flows/
  ```
- Or upload manually via **Flows → Add** in Kestra UI

### GitHub Webhook Not Triggering

**Check:**
1. Webhook is active in GitHub repo settings
2. Kestra is accessible from GitHub (requires public IP or ngrok tunnel for local)
3. View webhook delivery history in GitHub repo settings

For local testing, use a tool like **ngrok** to expose Kestra:
```bash
ngrok http 8080
# Then set GitHub webhook to: https://your-ngrok-url/api/v1/webhooks/github
```

---

## 📖 Learning Resources

- **Kestra Academy**: https://academy.kestra.io/ (Free course with giveaway)
- **Official Docs**: https://kestra.io/docs/
- **GitHub**: https://github.com/kestra-io/kestra

---

## 📝 Important Notes & Clarifications

### "Is this really no backend code?"

**The Truth:** 
- **Core orchestration = 100% Kestra** ✅ No backend needed
- **Optional FastAPI layer** for convenience (UI proxy, additional routes)
- **You can skip the backend entirely** and use Kestra UI directly

If you want pure Kestra with no Python backend at all:
1. Skip `docker compose up backend`
2. Use Kestra UI to trigger workflows
3. Frontend can call Kestra API directly (CORS allowed)

See [KESTRA_ONLY_SETUP.md](KESTRA_ONLY_SETUP.md) for a completely backend-free approach.

---

## 🎓 What You'll Learn

By building and deploying AutoPR Engine, you'll master:

✅ **Workflow Orchestration** — Kestra fundamentals, task dependencies, parallel execution  
✅ **Event-Driven Architecture** — GitHub webhooks, HTTP triggers, async processing  
✅ **Secrets Management** — Encrypted credential handling, RBAC, audit trails  
✅ **AI Integration** — LLM APIs, prompt engineering, content generation pipelines  
✅ **API Integration** — GitHub API, Gmail SMTP, REST endpoints  
✅ **Production DevOps** — Docker Compose, networking, monitoring, deployment  
✅ **Full-Stack Development** — From orchestration layer through delivery channels

## ✅ Quick Verification

After setup, test that everything works:

**1. Kestra is running:**
```bash
curl http://localhost:8080/api/v1/namespaces/system.autopr
# Should return 200 with namespace details
```

**2. Flows are loaded:**
- Go to http://localhost:8080 → **Flows**
- Should see `autopr_main_flow`, `send_notifications`, `webhook_receiver`

**3. Test a run (manual):**
- Kestra UI → **autopr_main_flow** → **Execute**
- Fill in: `run_id`, `source`, `project`, `raw_update`
- Click **Execute**
- Monitor in **Topology** or **Gantt** tab

**4. Test email (optional, if backend is running):**
```bash
curl -X POST http://localhost:8000/api/email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Test",
    "body": "This is a test email",
    "recipient": "your@email.com"
  }'
# Should see 200 + success message
```

---

## 📦 Project Structure

```
kestra_learning/
├── flows/                          # Kestra YAML workflows
│   ├── autopr_main_flow.yml       # Main orchestration flow
│   ├── send_notifications.yml     # Email delivery subflow
│   ├── webhook_receiver.yml       # GitHub webhook handler
│   └── subflows/                  # Reusable task libraries
├── backend/                        # Optional FastAPI backend
│   ├── main.py                    # API endpoints
│   ├── requirements.txt           # Python dependencies
│   └── Dockerfile                 # Container build
├── frontend/                       # React + Vite dashboard
│   ├── src/                       # React components
│   ├── package.json               # Node dependencies
│   └── Dockerfile                 # Container build
├── data/                          # Runtime data (mounts in Docker)
│   ├── runs/                      # Execution logs
│   └── posts/                     # Generated content archives
├── docs/                          # Documentation
│   ├── README.md                  # This file
│   ├── KESTRA_QUICK_START.md     # 5-min setup guide
│   ├── QUICKSTART.md             # Full stack setup
│   ├── KESTRA_ONLY_SETUP.md      # Complete reference
│   ├── CREDENTIALS.md            # API key setup
│   ├── DEMO_SCRIPT.md            # Test payloads
│   └── DEPLOYMENT_RENDER.md      # Production guide
├── docker-compose.yml             # Container orchestration
└── graphify-out/                  # Knowledge graph outputs
    ├── graph.html                 # Interactive visualization
    ├── graph.json                 # Raw graph data
    └── GRAPH_REPORT.md           # Analysis report
```

---

## 🚀 Next Steps

1. **Choose your path:** Kestra-only or full stack?
2. **Follow the guide:** Start with Quick Start or KESTRA_QUICK_START.md
3. **Configure credentials:** See CREDENTIALS.md for GitHub, Gmail, API keys
4. **Run a test:** Trigger via webhook or manual execution
5. **Monitor:** Use Kestra UI for logs and metrics
6. **Deploy:** See DEPLOYMENT_RENDER.md for production

---

## 🎓 Join the Kestra Academy

Completed the Kestra course and learned workflow orchestration? Share your experience!

Post about your learning journey using **#KestraAcademy** and **#WeMakeDevs** for a chance to win in the giveaway.

See [social.md](../social.md) for examples of what to share.

---

## 📄 License & Attribution

Built as part of **Kestra Academy** learning challenge.  
Open source. Contributions welcome.

**Author:** Vicky Kumar (@algsoch)

---

## 💬 Questions?

- **Kestra Issues:** https://github.com/kestra-io/kestra/issues
- **This Project:** Check the documentation files above
- **Kestra Academy:** https://academy.kestra.io/

---

**Ready to orchestrate?** Start with [KESTRA_QUICK_START.md](KESTRA_QUICK_START.md) — takes 5 minutes. ⚡

## Contributing
If you want to remove the backend entirely and run purely in Kestra, you would need to replace webhook and SMTP capabilities with external services that can invoke Kestra directly (e.g., use a cloud function or webhook proxy), and move any UI/data API into a static store or Kestra-accessible endpoint.

## 💡 Why Kestra?
Kestra is used here because it excels at:
- Handling complex subflows and nested logic.
- Executing python scripts safely using robust runners.
- Parallel processing (generating 4 platform posts at once).
- Conditional branching (Routing based on analysis).
- Total observability through the topology UI and execution logs.
