import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("autopr.backend")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")

DATA_DIR = Path(os.getenv("AUTOPR_DATA_DIR", "/data"))
RUNS_DIR = DATA_DIR / "runs"
POSTS_DIR = DATA_DIR / "posts"

KESTRA_API_URL = os.getenv("KESTRA_API_URL", "http://kestra:8080/api/v1").rstrip("/")
KESTRA_NAMESPACE = os.getenv("KESTRA_NAMESPACE", "system.autopr")
KESTRA_FLOW = os.getenv("KESTRA_FLOW", "autopr_main_flow")
GITHUB_API_BASE = os.getenv("GITHUB_API_BASE", "https://api.github.com").rstrip("/")
AUTOPR_MOCK_MODE = os.getenv("AUTOPR_MOCK_MODE", "false").lower() == "true"

allowed_origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()]

app = FastAPI(title="AutoPR Engine Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    started_at = datetime.now(timezone.utc)
    try:
        response = await call_next(request)
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
        logger.info("%s %s -> %s (%sms)", request.method, request.url.path, response.status_code, duration_ms)
        return response
    except Exception:
        logger.exception("Request failed: %s %s", request.method, request.url.path)
        raise


class GitHubReposRequest(BaseModel):
    username: str = Field(min_length=1)
    token: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=12, ge=1, le=100)
    include_forks: bool = True
    include_private: bool = True
    use_mock: bool = False


class GitHubItemsRequest(BaseModel):
    owner: str = Field(min_length=1)
    repo: str = Field(min_length=1)
    token: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=25, ge=1, le=100)
    use_mock: bool = False


class StyleAnalysisRequest(BaseModel):
    sample_posts: Union[str, Sequence[str]]
    use_for_generation: bool = False

    @field_validator("sample_posts")
    @classmethod
    def validate_sample_posts(cls, value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("sample_posts cannot be empty")
        if isinstance(value, Sequence) and not isinstance(value, str) and not list(value):
            raise ValueError("sample_posts cannot be empty")
        return value


class RepoRef(BaseModel):
    owner: str
    name: str
    full_name: Optional[str] = None
    html_url: Optional[str] = None
    description: Optional[str] = None
    default_branch: Optional[str] = None


class CommitRef(BaseModel):
    sha: str
    message: str
    author_name: Optional[str] = None
    author_date: Optional[str] = None
    html_url: Optional[str] = None


class PRRef(BaseModel):
    number: int
    title: str
    state: Optional[str] = None
    html_url: Optional[str] = None
    merged_at: Optional[str] = None
    author_login: Optional[str] = None


class GenerateRequest(BaseModel):
    source: str = Field(pattern="^(github_commit|github_pr|manual|github_webhook)$")
    project: str = Field(min_length=1)
    raw_update: Optional[str] = None
    author: str = Field(min_length=1)
    goal: str = Field(default="general_update")
    dry_run: bool = True
    run_id: Optional[str] = None
    selected_repo: Optional[RepoRef] = None
    selected_commit: Optional[CommitRef] = None
    selected_pr: Optional[PRRef] = None
    github_username: Optional[str] = None
    github_token: Optional[str] = None
    github_context: Optional[Dict[str, Any]] = None
    style_analysis: Optional[Dict[str, Any]] = None
    use_style_profile: bool = False
    delivery_webhook_url: Optional[str] = None
    input_source: Optional[str] = None


class KestraTriggerRequest(GenerateRequest):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def ensure_storage() -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    POSTS_DIR.mkdir(parents=True, exist_ok=True)


def load_json_file(file_path: Path) -> Optional[Dict[str, Any]]:
    if not file_path.exists():
        return None
    try:
        return json.loads(file_path.read_text())
    except json.JSONDecodeError:
        return None


def save_json_file(file_path: Path, payload: Dict[str, Any]) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True))


def make_run_id() -> str:
    return f"run_{uuid.uuid4().hex[:8]}"


def github_headers(token: Optional[str]) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": os.getenv("GITHUB_API_VERSION", "2022-11-28"),
        "User-Agent": os.getenv("GITHUB_USER_AGENT", "AutoPR-Engine/1.0"),
    }
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


def mock_repositories(username: str) -> List[Dict[str, Any]]:
    return [
        {
            "id": 1,
            "name": "autopr-engine",
            "full_name": f"{username}/autopr-engine",
            "html_url": f"https://github.com/{username}/autopr-engine",
            "description": "Kestra-powered AI content orchestration dashboard",
            "default_branch": "main",
            "language": "TypeScript",
            "stargazers_count": 42,
            "forks_count": 3,
            "open_issues_count": 1,
            "updated_at": utc_now_iso(),
            "private": False,
            "fork": False,
            "topics": ["kestra", "automation", "ai"],
        },
        {
            "id": 2,
            "name": "release-notes-bot",
            "full_name": f"{username}/release-notes-bot",
            "html_url": f"https://github.com/{username}/release-notes-bot",
            "description": "Pull request and commit to social post pipeline",
            "default_branch": "main",
            "language": "Python",
            "stargazers_count": 18,
            "forks_count": 1,
            "open_issues_count": 0,
            "updated_at": utc_now_iso(),
            "private": False,
            "fork": False,
            "topics": ["github", "kestra", "linkedin"],
        },
    ]


def mock_commits(owner: str, repo: str) -> List[Dict[str, Any]]:
    return [
        {
            "sha": uuid.uuid4().hex[:12],
            "commit": {
                "message": "feat(content): add multi-platform delivery summary",
                "author": {"name": "AutoPR Bot", "date": utc_now_iso()},
            },
            "author": {"login": owner},
            "html_url": f"https://github.com/{owner}/{repo}/commit/mock",
        },
        {
            "sha": uuid.uuid4().hex[:12],
            "commit": {
                "message": "fix(kestra): add retry-aware delivery branch",
                "author": {"name": "AutoPR Bot", "date": utc_now_iso()},
            },
            "author": {"login": owner},
            "html_url": f"https://github.com/{owner}/{repo}/commit/mock-2",
        },
    ]


def mock_pull_requests(owner: str, repo: str) -> List[Dict[str, Any]]:
    return [
        {
            "number": 17,
            "title": "Add auto content delivery summary cards",
            "state": "open",
            "html_url": f"https://github.com/{owner}/{repo}/pull/17",
            "merged_at": None,
            "user": {"login": owner},
        },
        {
            "number": 12,
            "title": "Improve GitHub repo ingestion and auth handling",
            "state": "closed",
            "html_url": f"https://github.com/{owner}/{repo}/pull/12",
            "merged_at": utc_now_iso(),
            "user": {"login": owner},
        },
    ]


async def github_api_json(path: str, token: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> Any:
    async with httpx.AsyncClient(base_url=GITHUB_API_BASE, headers=github_headers(token), timeout=20.0) as client:
        response = await client.get(path, params=params)
        if response.status_code >= 400:
            message = "GitHub API request failed"
            try:
                body = response.json()
                message = body.get("message", message)
            except Exception:
                message = response.text or message
            if response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0":
                message = "GitHub rate limit exceeded. Provide a token or retry later."
            raise HTTPException(status_code=response.status_code, detail=message)
        return response.json()


def normalize_repo_item(repo: Dict[str, Any]) -> Dict[str, Any]:
    owner = repo.get("owner") or {}
    return {
        "id": repo.get("id"),
        "name": repo.get("name"),
        "full_name": repo.get("full_name") or f"{owner.get('login', '')}/{repo.get('name', '')}".strip("/"),
        "description": repo.get("description"),
        "html_url": repo.get("html_url"),
        "default_branch": repo.get("default_branch"),
        "language": repo.get("language"),
        "stargazers_count": repo.get("stargazers_count", 0),
        "forks_count": repo.get("forks_count", 0),
        "open_issues_count": repo.get("open_issues_count", 0),
        "updated_at": repo.get("updated_at"),
        "private": repo.get("private", False),
        "fork": repo.get("fork", False),
        "topics": repo.get("topics", []),
        "owner": {
            "login": owner.get("login"),
            "html_url": owner.get("html_url"),
        },
    }


def normalize_commit_item(commit: Dict[str, Any]) -> Dict[str, Any]:
    commit_data = commit.get("commit", {})
    author = commit_data.get("author", {})
    return {
        "sha": commit.get("sha"),
        "message": commit_data.get("message", ""),
        "author_name": author.get("name"),
        "author_date": author.get("date"),
        "html_url": commit.get("html_url"),
        "author_login": (commit.get("author") or {}).get("login"),
    }


def normalize_pr_item(pr: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "number": pr.get("number"),
        "title": pr.get("title"),
        "state": pr.get("state"),
        "html_url": pr.get("html_url"),
        "merged_at": pr.get("merged_at"),
        "author_login": (pr.get("user") or {}).get("login"),
    }


def collect_keywords(text: str) -> List[str]:
    stop_words = {"the", "and", "for", "with", "that", "this", "from", "into", "our", "are", "was", "were", "has", "have", "will", "you", "your", "about", "just", "added", "fixed", "improved"}
    words = [word.strip(".,:;!?()[]{}\"'").lower() for word in text.split()]
    return [word for word in words if len(word) > 3 and word not in stop_words][:8]


def pick_raw_update(payload: GenerateRequest) -> str:
    if payload.raw_update and payload.raw_update.strip():
        return payload.raw_update.strip()
    if payload.selected_commit and payload.selected_commit.message:
        return payload.selected_commit.message.strip()
    if payload.selected_pr and payload.selected_pr.title:
        return payload.selected_pr.title.strip()
    if payload.github_context:
        summary = payload.github_context.get("summary") or payload.github_context.get("raw_update")
        if summary:
            return str(summary).strip()
    return f"Update applied to repository {payload.project}"


def derive_context_bundle(payload: GenerateRequest) -> Dict[str, Any]:
    raw_update = pick_raw_update(payload)
    repo = payload.selected_repo.model_dump() if payload.selected_repo else None
    commit = payload.selected_commit.model_dump() if payload.selected_commit else None
    pr = payload.selected_pr.model_dump() if payload.selected_pr else None
    text_lower = raw_update.lower()
    keywords = collect_keywords(raw_update)
    technical_signals = [term for term in ["fix", "refactor", "api", "ui", "kestra", "workflow", "delivery", "auth", "github", "release"] if term in text_lower]
    audience = "builders"
    if any(term in text_lower for term in ["hire", "recruit", "team", "interview"]):
        audience = "recruiters"
    elif any(term in text_lower for term in ["launch", "shipped", "released", "release"]):
        audience = "founders"

    style = payload.style_analysis or {}
    tone = style.get("tone") or ("technical" if technical_signals else "professional")
    hook_style = style.get("hook_style") or ("insight-led" if technical_signals else "story-led")
    technical_depth = style.get("technical_depth") or ("high" if technical_signals else "medium")

    return {
        "raw_update": raw_update,
        "input_source": payload.input_source or payload.source,
        "project": payload.project,
        "author": payload.author,
        "goal": payload.goal,
        "github": {
            "username": payload.github_username,
            "repo": repo,
            "commit": commit,
            "pull_request": pr,
            "context": payload.github_context or {},
        },
        "analysis": {
            "keywords": keywords,
            "tone": tone,
            "hook_style": hook_style,
            "technical_depth": technical_depth,
            "audience": audience,
            "signals": technical_signals,
        },
        "style_profile": style,
        "dry_run": payload.dry_run,
        "delivery_webhook_url": payload.delivery_webhook_url,
    }


def build_post_variants(context: Dict[str, Any]) -> Dict[str, str]:
    raw_update = context["raw_update"]
    keywords = context["analysis"].get("keywords", [])
    style = context.get("style_profile", {}) or {}
    hook = style.get("hook_line") or f"Shipping a meaningful update: {raw_update}"
    hashtag_suffix = " ".join(f"#{keyword.replace('-', '')[:24].title()}" for keyword in keywords[:3])
    focus_phrase = context["analysis"].get("audience", "builders")

    linkedin = (
        f"{hook}\n\n"
        f"This release tightens the orchestration loop across GitHub context, Kestra execution visibility, and content delivery.\n\n"
        f"Why it matters: the system now turns commits and PRs into structured distribution plans with explicit dry-run vs live delivery state.\n\n"
        f"{hashtag_suffix or '#BuildInPublic #Automation #Kestra'}"
    )

    x_post = (
        f"{raw_update} — now wired into an orchestrated delivery pipeline.\n"
        f"GitHub signal in, Kestra topology out, delivery status visible. #BuildInPublic #Automation"
    )[:280]

    instagram = (
        f"Behind the scenes update: {raw_update}.\n\n"
        f"We’re turning repo activity into a full content workflow with analysis, routing, and delivery tracking.\n\n"
        f"{hashtag_suffix or '#Tech #Startup #Workflow'}"
    )

    whatsapp_dm = (
        f"Quick update for {focus_phrase}: {raw_update}.\n"
        f"The system now traces the full path from GitHub input to content generation and delivery status."
    )

    return {
        "linkedin": linkedin,
        "x": x_post,
        "instagram": instagram,
        "whatsapp_dm": whatsapp_dm,
    }


def route_content(context: Dict[str, Any], style_profile: Dict[str, Any]) -> Dict[str, Any]:
    goal = context.get("goal", "general_update")
    analysis = context.get("analysis", {})
    selected_platforms = {"linkedin"}
    recipients = {"community"}
    reason_parts = []

    if goal in {"build_in_public", "technical_update"} or analysis.get("technical_depth") == "high":
        selected_platforms.update({"x", "linkedin"})
        recipients.update({"builders", "mentors"})
        reason_parts.append("technical build-in-public update")

    if goal in {"hiring", "team_growth"} or analysis.get("audience") == "recruiters":
        selected_platforms.update({"linkedin", "whatsapp_dm"})
        recipients.update({"recruiters", "team"})
        reason_parts.append("audience includes recruiters or team leads")

    if style_profile.get("cta_pattern") == "question-led":
        recipients.add("engaged_followers")
        reason_parts.append("style uses question-led CTA")

    if goal in {"launch", "milestone"}:
        selected_platforms.update({"linkedin", "x", "instagram"})
        reason_parts.append("milestone content benefits from broader reach")

    if not reason_parts:
        reason_parts.append("defaulting to LinkedIn for the primary announcement")

    selected_platforms = [platform for platform in ["linkedin", "x", "instagram", "whatsapp_dm"] if platform in selected_platforms]
    recipients_list = sorted(recipients)

    return {
        "platforms": selected_platforms,
        "recipients": recipients_list,
        "reason": "; ".join(reason_parts),
        "requires_review": analysis.get("technical_depth") == "low" and goal == "general_update",
    }


def compute_delivery_status(dry_run: bool, webhook_url: Optional[str]) -> Dict[str, str]:
    if dry_run:
        return {
            "linkedin": "dry_run_saved",
            "x": "dry_run_saved",
            "instagram": "dry_run_saved",
            "whatsapp_dm": "dry_run_saved",
        }
    if webhook_url:
        return {
            "linkedin": "live_adapter_ready",
            "x": "live_adapter_ready",
            "instagram": "live_adapter_ready",
            "whatsapp_dm": "live_adapter_ready",
        }
    return {
        "linkedin": "missing_adapter_credentials",
        "x": "missing_adapter_credentials",
        "instagram": "missing_adapter_credentials",
        "whatsapp_dm": "missing_adapter_credentials",
    }


def write_run_snapshot(run_id: str, payload: Dict[str, Any]) -> Path:
    ensure_storage()
    file_path = RUNS_DIR / f"{run_id}.json"
    save_json_file(file_path, payload)
    return file_path


def read_run_snapshot(run_id: str) -> Optional[Dict[str, Any]]:
    return load_json_file(RUNS_DIR / f"{run_id}.json")


def summarize_logs(logs: List[Dict[str, Any]]) -> List[str]:
    return [f"{entry['timestamp']} [{entry['level']}] {entry['message']}" for entry in logs]


def build_preview_package(run_id: str, payload: GenerateRequest) -> Dict[str, Any]:
    context = derive_context_bundle(payload)
    style_profile = payload.style_analysis or {}
    generated_posts = build_post_variants(context)
    routing_decision = route_content(context, style_profile if payload.use_style_profile else {})
    delivery_status = compute_delivery_status(payload.dry_run, payload.delivery_webhook_url)

    logs = [
        {"timestamp": utc_now_iso(), "level": "info", "message": f"Accepted {context['input_source']} input for {payload.project}"},
        {"timestamp": utc_now_iso(), "level": "info", "message": f"Generated posts for {', '.join(generated_posts.keys())}"},
        {"timestamp": utc_now_iso(), "level": "info", "message": f"Routing decision targets {', '.join(routing_decision['platforms'])}"},
    ]
    if payload.dry_run:
        logs.append({"timestamp": utc_now_iso(), "level": "info", "message": "Dry run enabled; delivery will be saved locally."})
    else:
        logs.append({"timestamp": utc_now_iso(), "level": "warning", "message": "Live mode requested; webhook adapter required for posting."})

    timeline = [
        {"step": "validate_input", "status": "complete"},
        {"step": "extract_github_context", "status": "complete" if context.get("github") else "skipped"},
        {"step": "linkedin_style_analysis", "status": "complete" if payload.style_analysis else "skipped"},
        {"step": "parallel_generation", "status": "complete"},
        {"step": "routing", "status": "complete"},
        {"step": "delivery", "status": "queued" if not payload.dry_run else "saved"},
        {"step": "finalize", "status": "pending"},
    ]

    preview = {
        "run_id": run_id,
        "kestra_execution_id": None,
        "dry_run": payload.dry_run,
        "input_source": context["input_source"],
        "selected_repo": context.get("github", {}).get("repo") or payload.project,
        "selected_commit": context.get("github", {}).get("commit"),
        "selected_pr": context.get("github", {}).get("pull_request"),
        "generated_posts": generated_posts,
        "routing_decision": routing_decision,
        "delivery_status": delivery_status,
        "analysis": context.get("analysis", {}),
        "style_profile": style_profile,
        "execution_timeline": timeline,
        "logs": summarize_logs(logs),
        "errors": [],
        "status": "draft_generated",
        "payload": context,
        "created_at": utc_now_iso(),
        "updated_at": utc_now_iso(),
    }
    return preview


def normalize_sample_posts(sample_posts: Union[str, Sequence[str]]) -> List[str]:
    if isinstance(sample_posts, str):
        pieces = [piece.strip() for piece in sample_posts.splitlines() if piece.strip()]
        return pieces if pieces else [sample_posts.strip()]
    return [piece.strip() for piece in sample_posts if str(piece).strip()]


def analyze_style_samples(sample_posts: List[str]) -> Dict[str, Any]:
    joined = "\n".join(sample_posts)
    lower = joined.lower()
    word_count = len(joined.split())
    line_breaks = joined.count("\n")
    hashtags = [token for token in joined.split() if token.startswith("#")]
    question_count = joined.count("?")

    if any(marker in lower for marker in ["behind the scenes", "day in the life", "what we learned"]):
        hook_style = "story-led"
    elif any(marker in lower for marker in ["shipping", "released", "launched"]):
        hook_style = "announcement-led"
    else:
        hook_style = "insight-led"

    tone = "professional"
    if any(marker in lower for marker in ["excited", "thrilled", "love", "awesome"]):
        tone = "energetic"
    elif any(marker in lower for marker in ["lessons", "learned", "analysis", "deep dive"]):
        tone = "reflective"

    technical_depth = "high" if any(marker in lower for marker in ["api", "infra", "kestra", "workflow", "pipeline", "retry", "docker", "http"]) else "medium"
    audience = "builders"
    if any(marker in lower for marker in ["recruit", "hiring", "team", "mentor"]):
        audience = "recruiters"
    elif any(marker in lower for marker in ["founder", "startup", "launch"]):
        audience = "founders"

    cta_pattern = "question-led" if question_count else "soft-invite"
    hashtag_pattern = {
        "count": len(hashtags),
        "examples": hashtags[:5],
        "style": "dense" if len(hashtags) >= 5 else "light",
    }

    structure = "multi-paragraph" if line_breaks >= 2 else ("single-paragraph" if word_count > 70 else "compact")

    return {
        "tone": tone,
        "structure": structure,
        "hook_style": hook_style,
        "technical_depth": technical_depth,
        "audience": audience,
        "cta_pattern": cta_pattern,
        "hashtag_pattern": hashtag_pattern,
        "sample_count": len(sample_posts),
        "summary": f"{tone} / {hook_style} / {technical_depth}",
        "use_for_generation": True,
    }


async def trigger_kestra_flow(run_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    url = f"{KESTRA_API_URL}/executions/{KESTRA_NAMESPACE}/{KESTRA_FLOW}"
    inputs = {
        "run_id": run_id,
        "source": payload.get("source", "manual"),
        "project": payload.get("project", "unknown"),
        "raw_update": payload.get("raw_update", ""),
        "author": payload.get("author", "unknown"),
        "goal": payload.get("goal", "general_update"),
        "dry_run": str(payload.get("dry_run", True)).lower(),
        "github_username": payload.get("github_username", ""),
        "github_token": payload.get("github_token", ""),
        "selected_repo_json": json.dumps(payload.get("selected_repo") or {}, ensure_ascii=True),
        "selected_commit_json": json.dumps(payload.get("selected_commit") or {}, ensure_ascii=True),
        "selected_pr_json": json.dumps(payload.get("selected_pr") or {}, ensure_ascii=True),
        "github_context_json": json.dumps(payload.get("github_context") or {}, ensure_ascii=True),
        "style_analysis_json": json.dumps(payload.get("style_analysis") or {}, ensure_ascii=True),
        "use_style_profile": str(payload.get("use_style_profile", False)).lower(),
        "delivery_webhook_url": payload.get("delivery_webhook_url", ""),
        "input_source": payload.get("input_source") or payload.get("source", "manual"),
        "raw_payload_json": json.dumps(payload, ensure_ascii=True),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(url, files={key: (None, str(value)) for key, value in inputs.items()})
            if response.status_code >= 400:
                detail = response.text
                try:
                    detail = response.json()
                except Exception:
                    pass
                raise HTTPException(status_code=502, detail={"message": "Failed to trigger Kestra", "details": detail})

            try:
                body = response.json()
            except Exception:
                body = {"raw": response.text}

            execution_id = body.get("id") or body.get("executionId") or body.get("execution_id")
            snapshot = read_run_snapshot(run_id) or {}
            snapshot.update(
                {
                    "id": run_id,
                    "kestra_execution_id": execution_id,
                    "status": "running",
                    "triggered_at": utc_now_iso(),
                    "updated_at": utc_now_iso(),
                    "kestra_response": body,
                    "payload": payload,
                }
            )
            write_run_snapshot(run_id, snapshot)
            return {"run_id": run_id, "kestra_execution_id": execution_id, "status": "running", "response": body}
        except HTTPException:
            raise
        except httpx.HTTPError as exc:
            logger.exception("Error triggering Kestra for run %s", run_id)
            snapshot = read_run_snapshot(run_id) or {"id": run_id, "payload": payload}
            snapshot.update(
                {
                    "status": "failed",
                    "error": str(exc),
                    "updated_at": utc_now_iso(),
                }
            )
            write_run_snapshot(run_id, snapshot)
            raise HTTPException(status_code=503, detail={"message": "Kestra is unreachable", "error": str(exc)})


def upsert_run_preview(run_id: str, preview: Dict[str, Any]) -> Dict[str, Any]:
    snapshot = read_run_snapshot(run_id) or {}
    snapshot.update(preview)
    snapshot["id"] = run_id
    snapshot["updated_at"] = utc_now_iso()
    write_run_snapshot(run_id, snapshot)
    return snapshot


@app.get("/health")
def health_check():
    ensure_storage()
    return {
        "status": "ok",
        "timestamp": utc_now_iso(),
        "kestra_api_url": KESTRA_API_URL,
        "mock_mode": AUTOPR_MOCK_MODE,
    }


@app.post("/api/github/fetch-repos")
async def fetch_repositories(req: GitHubReposRequest):
    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_repositories(req.username)
        return {
            "items": items,
            "total_count": len(items),
            "source": "mock",
            "auth_mode": "mock",
            "message": "Mock repositories returned because mock mode is enabled.",
        }

    params = {"page": req.page, "per_page": req.per_page, "sort": "updated", "direction": "desc"}
    repos = await github_api_json(f"/users/{req.username}/repos", token=req.token, params=params)
    if not isinstance(repos, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub repositories payload")

    filtered = [repo for repo in repos if req.include_forks or not repo.get("fork")]
    if not req.include_private:
        filtered = [repo for repo in filtered if not repo.get("private")]

    items = [normalize_repo_item(repo) for repo in filtered]
    return {
        "items": items,
        "total_count": len(items),
        "source": "github",
        "auth_mode": "token" if req.token else "public",
        "message": f"Fetched {len(items)} repositories for {req.username}.",
    }


@app.post("/api/github/fetch-commits")
async def fetch_commits(req: GitHubItemsRequest):
    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_commits(req.owner, req.repo)
        return {"items": [normalize_commit_item(commit) for commit in items], "total_count": len(items), "source": "mock"}

    params = {"page": req.page, "per_page": req.per_page}
    commits = await github_api_json(f"/repos/{req.owner}/{req.repo}/commits", token=req.token, params=params)
    if not isinstance(commits, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub commits payload")
    items = [normalize_commit_item(commit) for commit in commits]
    return {"items": items, "total_count": len(items), "source": "github", "message": f"Fetched {len(items)} commits."}


@app.post("/api/github/fetch-prs")
async def fetch_pull_requests(req: GitHubItemsRequest):
    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_pull_requests(req.owner, req.repo)
        return {"items": [normalize_pr_item(pr) for pr in items], "total_count": len(items), "source": "mock"}

    params = {"page": req.page, "per_page": req.per_page, "state": "all", "sort": "updated", "direction": "desc"}
    prs = await github_api_json(f"/repos/{req.owner}/{req.repo}/pulls", token=req.token, params=params)
    if not isinstance(prs, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub pull requests payload")
    items = [normalize_pr_item(pr) for pr in prs]
    return {"items": items, "total_count": len(items), "source": "github", "message": f"Fetched {len(items)} pull requests."}


@app.post("/api/linkedin/analyze-style")
async def analyze_linkedin_style(req: StyleAnalysisRequest):
    sample_posts = normalize_sample_posts(req.sample_posts)
    analysis = analyze_style_samples(sample_posts)
    run_id = make_run_id()
    snapshot = {
        "id": run_id,
        "timestamp": utc_now_iso(),
        "source": "linkedin_style_analysis",
        "status": "completed",
        "sample_posts": sample_posts,
        "analysis": analysis,
        "use_for_generation": req.use_for_generation,
    }
    write_run_snapshot(run_id, snapshot)
    return {
        "run_id": run_id,
        "analysis": analysis,
        "use_for_generation": req.use_for_generation,
        "message": "LinkedIn style analysis completed.",
    }


@app.post("/api/generate")
async def generate_content(req: GenerateRequest):
    run_id = req.run_id or make_run_id()
    preview = build_preview_package(run_id, req)
    stored = upsert_run_preview(run_id, preview)
    return {
        "status": "draft_generated",
        "run_id": run_id,
        "message": "Content preview generated and saved locally.",
        "preview": stored,
    }


@app.post("/api/kestra/trigger")
async def trigger_kestra(req: KestraTriggerRequest):
    run_id = req.run_id or make_run_id()
    if not read_run_snapshot(run_id):
        preview = build_preview_package(run_id, req)
        upsert_run_preview(run_id, preview)

    payload = req.model_dump()
    result = await trigger_kestra_flow(run_id, payload)
    return {
        "status": "accepted",
        "run_id": run_id,
        "kestra_execution_id": result.get("kestra_execution_id"),
        "message": "Kestra workflow triggered.",
    }


@app.get("/api/runs")
def list_runs():
    ensure_storage()
    runs: List[Dict[str, Any]] = []
    for file_path in RUNS_DIR.glob("*.json"):
        data = load_json_file(file_path)
        if data:
            runs.append(data)
    runs.sort(key=lambda item: item.get("updated_at") or item.get("timestamp") or "", reverse=True)
    return {"runs": runs}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    data = read_run_snapshot(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Run not found")
    return data


@app.get("/api/posts")
def list_posts():
    ensure_storage()
    posts: List[Dict[str, Any]] = []
    for file_path in POSTS_DIR.glob("*.json"):
        data = load_json_file(file_path)
        if data:
            posts.append(data)
    posts.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
    return {"posts": posts}


@app.post("/api/github-webhook")
async def github_webhook(request: Request):
    payload = await request.json()
    commits = payload.get("commits", [])
    repository = payload.get("repository", {})
    run_id = make_run_id()

    if commits:
        raw_update = " | ".join(commit.get("message", "") for commit in commits if commit.get("message"))
        author = (commits[0].get("author") or {}).get("name") or "GitHub Webhook"
    else:
        raw_update = repository.get("description") or "Repository update received"
        author = "GitHub Webhook"

    webhook_payload = GenerateRequest(
        source="github_webhook",
        project=repository.get("full_name") or repository.get("name") or "Unknown",
        raw_update=raw_update,
        author=author,
        goal="build_in_public",
        dry_run=True,
        github_context={"webhook": payload},
        input_source="github_webhook",
    )
    preview = build_preview_package(run_id, webhook_payload)
    upsert_run_preview(run_id, preview)
    return {"status": "accepted", "run_id": run_id, "message": "GitHub webhook ingested."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
