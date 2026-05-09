import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, field_validator

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

logger = logging.getLogger("autopr.backend")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")

DATA_DIR = Path(os.getenv("AUTOPR_DATA_DIR", "/data"))
RUNS_DIR = DATA_DIR / "runs"
POSTS_DIR = DATA_DIR / "posts"

KESTRA_API_URL = os.getenv("KESTRA_API_URL", "http://kestra:8080/api/v1").rstrip("/")
KESTRA_UI_URL = os.getenv("KESTRA_UI_URL", "http://localhost:8080/ui").rstrip("/")
KESTRA_NAMESPACE = os.getenv("KESTRA_NAMESPACE", "system.autopr")
KESTRA_FLOW = os.getenv("KESTRA_FLOW", "autopr_main_flow")
GITHUB_API_BASE = os.getenv("GITHUB_API_BASE", "https://api.github.com").rstrip("/")
AUTOPR_MOCK_MODE = os.getenv("AUTOPR_MOCK_MODE", "false").lower() == "true"
DEFAULT_GITHUB_USERNAME = os.getenv("DEFAULT_GITHUB_USERNAME", "FiscalMindset")
DEFAULT_GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or os.getenv("GITHUB_PAT")
DEFAULT_GITHUB_REPO_FULL_NAME = os.getenv("DEFAULT_GITHUB_REPO_FULL_NAME", "FiscalMindset/autopr")
DEFAULT_GITHUB_REPO_URL = os.getenv("DEFAULT_GITHUB_REPO_URL", "https://github.com/FiscalMindset/autopr.git")
DEFAULT_AUTHOR = os.getenv("DEFAULT_AUTHOR", "Vicky Kumar")
AI_PROVIDER = os.getenv("AI_PROVIDER", "auto").strip().lower()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ALGSOCH_LINKEDIN_POST_URL = os.getenv(
    "ALGSOCH_LINKEDIN_POST_URL",
    "https://www.linkedin.com/posts/algsoch_offlineai-androiddev-ondeviceai-activity-7445842556317372416-5zgF",
)
ALGSOCH_LINKEDIN_PROFILE_URL = os.getenv("ALGSOCH_LINKEDIN_PROFILE_URL", "https://in.linkedin.com/in/algsoch")

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
    username: str = Field(default=DEFAULT_GITHUB_USERNAME, min_length=1)
    token: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=30, ge=1, le=100)
    include_forks: bool = True
    include_private: bool = True
    use_mock: bool = False
    pinned_repo: Optional[str] = DEFAULT_GITHUB_REPO_FULL_NAME


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


class SocialStyleImportRequest(BaseModel):
    source: str = Field(default="algsoch_linkedin")
    profile_url: Optional[str] = None
    post_url: Optional[str] = None
    use_for_generation: bool = True


class RepoRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    owner: Union[str, Dict[str, Any]]
    name: str
    full_name: Optional[str] = None
    html_url: Optional[str] = None
    description: Optional[str] = None
    default_branch: Optional[str] = None

    @field_validator("owner", mode="before")
    @classmethod
    def normalize_owner(cls, value):
        if isinstance(value, dict):
            return value.get("login") or value.get("name") or value.get("owner") or ""
        return value


class CommitRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sha: str
    message: str
    author_name: Optional[str] = None
    author_date: Optional[str] = None
    html_url: Optional[str] = None


class PRRef(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: int
    title: str
    state: Optional[str] = None
    html_url: Optional[str] = None
    merged_at: Optional[str] = None
    author_login: Optional[str] = None


class GenerateRequest(BaseModel):
    source: str = Field(pattern="^(github_commit|github_pr|manual|github_webhook)$")
    project: str = Field(default=DEFAULT_GITHUB_REPO_FULL_NAME, min_length=1)
    raw_update: Optional[str] = None
    author: str = Field(default=DEFAULT_AUTHOR, min_length=1)
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
    generated_posts: Optional[Dict[str, str]] = None


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


def parse_github_repo_ref(value: Optional[str]) -> Optional[Dict[str, str]]:
    if not value:
        return None
    cleaned = value.strip()
    if cleaned.startswith("https://github.com/"):
        cleaned = cleaned.removeprefix("https://github.com/")
    elif cleaned.startswith("http://github.com/"):
        cleaned = cleaned.removeprefix("http://github.com/")
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    cleaned = cleaned.strip("/")
    parts = [part for part in cleaned.split("/") if part]
    if len(parts) < 2:
        return None
    return {"owner": parts[0], "repo": parts[1], "full_name": f"{parts[0]}/{parts[1]}"}


def github_headers(token: Optional[str]) -> Dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": os.getenv("GITHUB_API_VERSION", "2022-11-28"),
        "User-Agent": os.getenv("GITHUB_USER_AGENT", "AutoPR-Engine/1.0"),
    }
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


SENSITIVE_KEY_PARTS = ("token", "secret", "api_key", "apikey", "authorization", "password", "oauth")


def mask_sensitive(value: Any) -> Any:
    if isinstance(value, dict):
        masked: Dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key).lower()
            if any(part in key_text for part in SENSITIVE_KEY_PARTS):
                masked[key] = "***configured***" if item else ""
            else:
                masked[key] = mask_sensitive(item)
        return masked
    if isinstance(value, list):
        return [mask_sensitive(item) for item in value]
    return value


def effective_github_token(token: Optional[str] = None) -> Optional[str]:
    return (token or DEFAULT_GITHUB_TOKEN or "").strip() or None


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


def unique_repositories(repos: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    unique: List[Dict[str, Any]] = []
    for repo in repos:
        full_name = repo.get("full_name")
        if not full_name or full_name in seen:
            continue
        seen.add(full_name)
        unique.append(repo)
    return unique


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


def ai_generation_prompt(context: Dict[str, Any]) -> str:
    prompt_payload = {
        "raw_update": context.get("raw_update"),
        "project": context.get("project"),
        "author": context.get("author"),
        "goal": context.get("goal"),
        "github": context.get("github"),
        "analysis": context.get("analysis"),
        "style_profile": context.get("style_profile"),
    }
    return (
        "Create social public-relations content from developer activity. "
        "Here PR means public relations and distribution, not only a GitHub pull request. "
        "Return only valid JSON with exactly these string keys: linkedin, x, instagram, whatsapp_dm. "
        "LinkedIn should be thoughtful and build-in-public. X must be 280 characters or fewer. "
        "Instagram should be caption-ready. WhatsApp/DM should be direct and personal. "
        "Reuse the supplied style profile when present.\n\n"
        f"Input:\n{json.dumps(prompt_payload, ensure_ascii=True, indent=2)}"
    )


def extract_json_object(text: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    fenced = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.IGNORECASE | re.MULTILINE).strip()
    try:
        parsed = json.loads(fenced)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return {}
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def normalize_generated_posts(data: Dict[str, Any], fallback: Dict[str, str]) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for platform in ("linkedin", "x", "instagram", "whatsapp_dm"):
        value = data.get(platform)
        normalized[platform] = str(value).strip() if value else fallback[platform]
    normalized["x"] = normalized["x"][:280]
    return normalized


async def generate_with_groq(context: Dict[str, Any], fallback: Dict[str, str]) -> Dict[str, str]:
    if not GROQ_API_KEY:
        raise RuntimeError("Groq API key is not configured")

    payload = {
        "model": GROQ_MODEL,
        "temperature": 0.55,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "system",
                "content": "You generate precise, platform-specific social content and respond as JSON only.",
            },
            {"role": "user", "content": ai_generation_prompt(context)},
        ],
    }
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()

    content = (((body.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    parsed = extract_json_object(content)
    if not parsed:
        raise RuntimeError("Groq returned non-JSON content")
    return normalize_generated_posts(parsed, fallback)


async def generate_with_gemini(context: Dict[str, Any], fallback: Dict[str, str]) -> Dict[str, str]:
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is not configured")

    model_path = GEMINI_MODEL if GEMINI_MODEL.startswith("models/") else f"models/{GEMINI_MODEL}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": (
                            "You generate precise, platform-specific social content and respond as JSON only.\n\n"
                            f"{ai_generation_prompt(context)}"
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.55,
            "responseMimeType": "application/json",
        },
    }
    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(f"https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent", json=payload, headers=headers)
        response.raise_for_status()
        body = response.json()

    parts = (((body.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
    content = "\n".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
    parsed = extract_json_object(content)
    if not parsed:
        raise RuntimeError("Gemini returned non-JSON content")
    return normalize_generated_posts(parsed, fallback)


async def generate_posts_with_ai(context: Dict[str, Any]) -> tuple[Dict[str, str], Dict[str, Any]]:
    fallback = build_post_variants(context)
    provider_order: List[str] = []
    requested_provider = AI_PROVIDER or "auto"

    if requested_provider in {"auto", "groq"} and GROQ_API_KEY:
        provider_order.append("groq")
    if requested_provider in {"auto", "gemini", "google"} and GEMINI_API_KEY:
        provider_order.append("gemini")

    errors: List[str] = []
    for provider in provider_order:
        try:
            if provider == "groq":
                posts = await generate_with_groq(context, fallback)
                return posts, {
                    "provider": "groq",
                    "model": GROQ_MODEL,
                    "fallback_used": False,
                    "source": "backend_env",
                }
            posts = await generate_with_gemini(context, fallback)
            return posts, {
                "provider": "gemini",
                "model": GEMINI_MODEL,
                "fallback_used": False,
                "source": "backend_env",
            }
        except Exception as exc:
            logger.warning("%s generation failed; falling back if needed: %s", provider, exc)
            errors.append(f"{provider}: {exc.__class__.__name__}: {str(exc)[:180]}")

    return fallback, {
        "provider": "deterministic_fallback",
        "model": "local_rules",
        "fallback_used": True,
        "requested_provider": requested_provider,
        "groq_configured": bool(GROQ_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
        "errors": errors[-3:],
        "source": "backend_rules",
    }


def route_content(context: Dict[str, Any], style_profile: Dict[str, Any]) -> Dict[str, Any]:
    goal = context.get("goal", "general_update")
    analysis = context.get("analysis", {})
    selected_platforms = {"linkedin"}
    recipients = {"community"}
    reason_parts = []

    if goal in {"build_in_public", "technical_update"} or analysis.get("technical_depth") == "high":
        selected_platforms.update({"x", "linkedin", "instagram", "whatsapp_dm"})
        recipients.update({"builders", "mentors", "warm_network"})
        reason_parts.append("technical public-relations update needs broad social copy plus direct-message follow-up")

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


def kestra_execution_url(execution_id: str, flow_id: str = KESTRA_FLOW) -> str:
    return f"{KESTRA_UI_URL}/executions/{KESTRA_NAMESPACE}/{flow_id}/{execution_id}"


def kestra_flow_url(flow_id: str = KESTRA_FLOW) -> str:
    return f"{KESTRA_UI_URL}/flows/edit/{KESTRA_NAMESPACE}/{flow_id}"


def compact_value(value: Any, limit: int = 1200) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value if len(value) <= limit else f"{value[:limit]}... [truncated]"
    if isinstance(value, list):
        return [compact_value(item, limit=limit // 2) for item in value[:8]]
    if isinstance(value, dict):
        return {key: compact_value(item, limit=limit // 2) for key, item in list(value.items())[:12]}
    return str(value)


def flatten_flow_tasks(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    flattened: List[Dict[str, Any]] = []
    for task in tasks:
        task_id = task.get("id")
        task_type = task.get("type", "")
        flattened.append(
            {
                "id": task_id,
                "type": task_type,
                "plugin": task_type.startswith("io.kestra.plugin."),
                "subflow": task.get("flowId"),
                "retry": task.get("retry"),
                "condition": task.get("condition"),
                "values": task.get("values"),
            }
        )
        for branch_key in ("then", "else", "tasks"):
            branch_tasks = task.get(branch_key)
            if isinstance(branch_tasks, list):
                flattened.extend(flatten_flow_tasks(branch_tasks))
    return flattened


def summarize_kestra_execution(execution: Dict[str, Any]) -> Dict[str, Any]:
    task_runs = []
    for task_run in execution.get("taskRunList", []):
        state = task_run.get("state") or {}
        task_runs.append(
            {
                "id": task_run.get("id"),
                "task_id": task_run.get("taskId"),
                "state": state.get("current"),
                "value": task_run.get("value"),
                "start_date": state.get("startDate"),
                "end_date": state.get("endDate"),
                "duration": state.get("duration"),
                "outputs": compact_value(task_run.get("outputs")),
            }
        )

    return {
        "execution_id": execution.get("id"),
        "flow_id": execution.get("flowId"),
        "namespace": execution.get("namespace"),
        "revision": execution.get("flowRevision"),
        "state": (execution.get("state") or {}).get("current"),
        "start_date": (execution.get("state") or {}).get("startDate"),
        "end_date": (execution.get("state") or {}).get("endDate"),
        "duration": (execution.get("state") or {}).get("duration"),
        "inputs": compact_value(mask_sensitive(execution.get("inputs"))),
        "task_runs": task_runs,
        "final_summary": extract_final_summary(execution),
        "url": kestra_execution_url(str(execution.get("id")), str(execution.get("flowId") or KESTRA_FLOW)),
    }


def merge_final_summary(snapshot: Dict[str, Any], final_summary: Dict[str, Any]) -> Dict[str, Any]:
    for key in [
        "generated_posts",
        "routing_decision",
        "delivery_status",
        "analysis",
        "style_profile",
        "execution_timeline",
        "logs",
        "errors",
        "selected_repo",
        "selected_commit",
        "selected_pr",
        "ai_generation",
    ]:
        value = final_summary.get(key)
        if value not in (None, {}, []):
            snapshot[key] = value

    if final_summary.get("status"):
        snapshot["status"] = final_summary["status"]
    if final_summary.get("updated_at"):
        snapshot["updated_at"] = final_summary["updated_at"]
    return snapshot


def extract_final_summary(execution: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for task_run in execution.get("taskRunList", []):
        if task_run.get("taskId") != "finalize":
            continue
        outputs = task_run.get("outputs") or {}
        nested_outputs = outputs.get("outputs") or {}
        final_summary = nested_outputs.get("final_summary")
        return final_summary if isinstance(final_summary, dict) else None
    return None


def update_timeline_status(snapshot: Dict[str, Any], step: str, status: str) -> None:
    timeline = snapshot.get("execution_timeline")
    if not isinstance(timeline, list):
        return
    for item in timeline:
        if isinstance(item, dict) and item.get("step") == step:
            item["status"] = status
            return


async def sync_run_with_kestra(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    execution_id = snapshot.get("kestra_execution_id")
    if not execution_id:
        return snapshot

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{KESTRA_API_URL}/executions/{execution_id}")
            response.raise_for_status()
            execution = response.json()
    except Exception as exc:
        logger.warning("Could not sync Kestra execution %s: %s", execution_id, exc)
        return snapshot

    current_state = ((execution.get("state") or {}).get("current") or "").upper()
    snapshot["kestra_execution_state"] = current_state or None
    final_summary = extract_final_summary(execution)
    if final_summary:
        snapshot = merge_final_summary(snapshot, final_summary)

    if current_state == "SUCCESS":
        snapshot["status"] = "completed"
        update_timeline_status(snapshot, "finalize", "complete")
    elif current_state in {"FAILED", "KILLED", "CANCELLED"}:
        snapshot["status"] = "failed"
        errors = snapshot.get("errors") if isinstance(snapshot.get("errors"), list) else []
        if not errors:
            errors.append(f"Kestra execution ended in {current_state}.")
        snapshot["errors"] = errors
    elif current_state:
        snapshot["status"] = "running"

    snapshot["updated_at"] = utc_now_iso()
    write_run_snapshot(str(snapshot.get("run_id") or snapshot.get("id")), snapshot)
    return snapshot


def summarize_logs(logs: List[Dict[str, Any]]) -> List[str]:
    return [f"{entry['timestamp']} [{entry['level']}] {entry['message']}" for entry in logs]


async def build_preview_package(run_id: str, payload: GenerateRequest) -> Dict[str, Any]:
    context = derive_context_bundle(payload)
    style_profile = payload.style_analysis or {}
    generated_posts, ai_generation = await generate_posts_with_ai(context)
    routing_decision = route_content(context, style_profile if payload.use_style_profile else {})
    delivery_status = compute_delivery_status(payload.dry_run, payload.delivery_webhook_url)

    logs = [
        {"timestamp": utc_now_iso(), "level": "info", "message": f"Accepted {context['input_source']} input for {payload.project}"},
        {
            "timestamp": utc_now_iso(),
            "level": "info",
            "message": f"Generated posts for {', '.join(generated_posts.keys())} using {ai_generation.get('provider')}.",
        },
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
        "ai_generation": ai_generation,
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
    github_token = effective_github_token(payload.get("github_token"))
    sanitized_payload = mask_sensitive(payload)
    inputs = {
        "run_id": run_id,
        "source": payload.get("source") or "manual",
        "project": payload.get("project") or DEFAULT_GITHUB_REPO_FULL_NAME,
        "raw_update": payload.get("raw_update") or "",
        "author": payload.get("author") or DEFAULT_AUTHOR,
        "goal": payload.get("goal") or "general_update",
        "dry_run": str(payload.get("dry_run", True)).lower(),
        "github_username": payload.get("github_username") or DEFAULT_GITHUB_USERNAME,
        "github_token": github_token or "",
        "selected_repo_json": json.dumps(payload.get("selected_repo") or {}, ensure_ascii=True),
        "selected_commit_json": json.dumps(payload.get("selected_commit") or {}, ensure_ascii=True),
        "selected_pr_json": json.dumps(payload.get("selected_pr") or {}, ensure_ascii=True),
        "github_context_json": json.dumps(payload.get("github_context") or {}, ensure_ascii=True),
        "style_analysis_json": json.dumps(payload.get("style_analysis") or {}, ensure_ascii=True),
        "generated_posts_json": json.dumps(payload.get("generated_posts") or {}, ensure_ascii=True),
        "ai_generation_json": json.dumps(payload.get("ai_generation") or {}, ensure_ascii=True),
        "use_style_profile": str(payload.get("use_style_profile", False)).lower(),
        "delivery_webhook_url": payload.get("delivery_webhook_url") or "",
        "input_source": payload.get("input_source") or payload.get("source") or "manual",
        "raw_payload_json": json.dumps(sanitized_payload, ensure_ascii=True),
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
                    "payload": sanitized_payload,
                }
            )
            write_run_snapshot(run_id, snapshot)
            return {"run_id": run_id, "kestra_execution_id": execution_id, "status": "running", "response": body}
        except HTTPException:
            raise
        except httpx.HTTPError as exc:
            logger.exception("Error triggering Kestra for run %s", run_id)
            snapshot = read_run_snapshot(run_id) or {"id": run_id, "payload": sanitized_payload}
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


@app.get("/api/config/defaults")
def config_defaults():
    return {
        "github_username": DEFAULT_GITHUB_USERNAME,
        "github_repo_full_name": DEFAULT_GITHUB_REPO_FULL_NAME,
        "github_repo_url": DEFAULT_GITHUB_REPO_URL,
        "github_token_configured": bool(DEFAULT_GITHUB_TOKEN),
        "project": DEFAULT_GITHUB_REPO_FULL_NAME,
        "author": DEFAULT_AUTHOR,
        "kestra_namespace": KESTRA_NAMESPACE,
        "kestra_flow": KESTRA_FLOW,
        "kestra_ui_url": KESTRA_UI_URL,
        "kestra_flow_url": kestra_flow_url(),
        "ai_provider": AI_PROVIDER,
        "groq_configured": bool(GROQ_API_KEY),
        "groq_model": GROQ_MODEL if GROQ_API_KEY else None,
        "gemini_configured": bool(GEMINI_API_KEY),
        "gemini_model": GEMINI_MODEL if GEMINI_API_KEY else None,
        "mock_mode": AUTOPR_MOCK_MODE,
    }


@app.get("/api/kestra/flow-definition")
async def get_kestra_flow_definition(flow_id: str = KESTRA_FLOW):
    url = f"{KESTRA_API_URL}/flows/{KESTRA_NAMESPACE}/{flow_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            flow = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail={"message": "Kestra flow definition unavailable", "error": str(exc)}) from exc

    tasks = flatten_flow_tasks(flow.get("tasks") or [])
    plugin_tasks = [task for task in tasks if task.get("plugin")]
    subflows = sorted({task["subflow"] for task in tasks if task.get("subflow")})
    return {
        "namespace": KESTRA_NAMESPACE,
        "flow_id": flow_id,
        "revision": flow.get("revision"),
        "description": flow.get("description"),
        "url": kestra_flow_url(flow_id),
        "definition": flow,
        "source_text": json.dumps(flow, indent=2),
        "tasks": tasks,
        "plugin_tasks": plugin_tasks,
        "subflows": subflows,
    }


@app.get("/api/kestra/executions/{execution_id}")
async def get_kestra_execution_details(execution_id: str):
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            execution_response = await client.get(f"{KESTRA_API_URL}/executions/{execution_id}")
            execution_response.raise_for_status()
            execution = execution_response.json()

            logs_response = await client.get(f"{KESTRA_API_URL}/logs/{execution_id}")
            logs = logs_response.json() if logs_response.status_code < 400 else []
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=503, detail={"message": "Kestra execution unavailable", "error": str(exc)}) from exc

    summary = summarize_kestra_execution(execution)
    summary["logs"] = [
        {
            "timestamp": log.get("timestamp"),
            "level": log.get("level"),
            "task_id": log.get("taskId"),
            "message": log.get("message"),
        }
        for log in logs[-200:]
        if isinstance(log, dict)
    ]
    return summary


@app.post("/api/github/fetch-repos")
async def fetch_repositories(req: GitHubReposRequest):
    pinned_ref = parse_github_repo_ref(req.pinned_repo or DEFAULT_GITHUB_REPO_FULL_NAME)
    username = req.username.strip() or (pinned_ref or {}).get("owner") or DEFAULT_GITHUB_USERNAME

    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_repositories(username)
        return {
            "items": items,
            "total_count": len(items),
            "source": "mock",
            "auth_mode": "mock",
            "message": "Mock repositories returned because mock mode is enabled.",
        }

    params = {"page": req.page, "per_page": req.per_page, "sort": "updated", "direction": "desc"}
    token = effective_github_token(req.token)
    repos = await github_api_json(f"/users/{username}/repos", token=token, params=params)
    if not isinstance(repos, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub repositories payload")

    filtered = [repo for repo in repos if req.include_forks or not repo.get("fork")]
    if not req.include_private:
        filtered = [repo for repo in filtered if not repo.get("private")]

    items = [normalize_repo_item(repo) for repo in filtered]

    pinned_item = None
    pinned_error = None
    if pinned_ref:
        try:
            pinned_repo = await github_api_json(f"/repos/{pinned_ref['owner']}/{pinned_ref['repo']}", token=token)
            if isinstance(pinned_repo, dict):
                pinned_item = normalize_repo_item(pinned_repo)
        except HTTPException as exc:
            pinned_error = exc.detail

    if pinned_item:
        items = unique_repositories([pinned_item, *items])

    return {
        "items": items,
        "total_count": len(items),
        "source": "github",
        "auth_mode": "request_token" if req.token else ("backend_env_token" if token else "public"),
        "pinned_repo": pinned_ref.get("full_name") if pinned_ref else None,
        "pinned_repo_loaded": bool(pinned_item),
        "pinned_repo_error": pinned_error,
        "message": f"Fetched {len(items)} repositories for {username}."
        + (f" Pinned {pinned_ref['full_name']} first." if pinned_item and pinned_ref else ""),
    }


@app.post("/api/github/fetch-commits")
async def fetch_commits(req: GitHubItemsRequest):
    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_commits(req.owner, req.repo)
        return {"items": [normalize_commit_item(commit) for commit in items], "total_count": len(items), "source": "mock"}

    params = {"page": req.page, "per_page": req.per_page}
    token = effective_github_token(req.token)
    commits = await github_api_json(f"/repos/{req.owner}/{req.repo}/commits", token=token, params=params)
    if not isinstance(commits, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub commits payload")
    items = [normalize_commit_item(commit) for commit in commits]
    return {
        "items": items,
        "total_count": len(items),
        "source": "github",
        "auth_mode": "request_token" if req.token else ("backend_env_token" if token else "public"),
        "message": f"Fetched {len(items)} commits.",
    }


@app.post("/api/github/fetch-prs")
async def fetch_pull_requests(req: GitHubItemsRequest):
    if req.use_mock or AUTOPR_MOCK_MODE:
        items = mock_pull_requests(req.owner, req.repo)
        return {"items": [normalize_pr_item(pr) for pr in items], "total_count": len(items), "source": "mock"}

    params = {"page": req.page, "per_page": req.per_page, "state": "all", "sort": "updated", "direction": "desc"}
    token = effective_github_token(req.token)
    prs = await github_api_json(f"/repos/{req.owner}/{req.repo}/pulls", token=token, params=params)
    if not isinstance(prs, list):
        raise HTTPException(status_code=502, detail="Unexpected GitHub pull requests payload")
    items = [normalize_pr_item(pr) for pr in prs]
    return {
        "items": items,
        "total_count": len(items),
        "source": "github",
        "auth_mode": "request_token" if req.token else ("backend_env_token" if token else "public"),
        "message": f"Fetched {len(items)} pull requests.",
    }


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


@app.post("/api/social/import-algsoch-style")
async def import_algsoch_style(req: SocialStyleImportRequest):
    profile_url = req.profile_url or ALGSOCH_LINKEDIN_PROFILE_URL
    post_url = req.post_url or ALGSOCH_LINKEDIN_POST_URL
    analysis = {
        "tone": "reflective",
        "structure": "multi-paragraph",
        "hook_style": "insight-led",
        "technical_depth": "high",
        "audience": "builders",
        "cta_pattern": "soft-invite",
        "hashtag_pattern": {
            "count": 5,
            "examples": ["#OfflineAI", "#AndroidDev", "#OnDeviceAI", "#AI", "#BuildInPublic"],
            "style": "focused",
        },
        "sample_count": 2,
        "summary": "Algsoch style: practical build-in-public posts, concrete technical bullets, privacy/offline AI emphasis, and builder-focused hashtags.",
        "use_for_generation": req.use_for_generation,
        "source": req.source,
        "source_urls": [post_url, profile_url],
        "style_rules": [
            "Start with a concrete product/use-case observation instead of hype.",
            "Explain why the implementation matters for real users.",
            "Use short paragraphs and bullet-like benefit lists for technical details.",
            "Prefer build-in-public clarity over marketing language.",
            "Close with focused technical hashtags and community context.",
        ],
    }
    run_id = make_run_id()
    snapshot = {
        "id": run_id,
        "timestamp": utc_now_iso(),
        "source": "algsoch_social_style_import",
        "status": "completed",
        "analysis": analysis,
        "source_urls": analysis["source_urls"],
        "use_for_generation": req.use_for_generation,
    }
    write_run_snapshot(run_id, snapshot)
    return {
        "run_id": run_id,
        "analysis": analysis,
        "source_urls": analysis["source_urls"],
        "message": "Imported Algsoch public social style profile.",
    }


@app.post("/api/generate")
async def generate_content(req: GenerateRequest):
    run_id = req.run_id or make_run_id()
    preview = await build_preview_package(run_id, req)
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
    snapshot = read_run_snapshot(run_id)
    if not snapshot:
        preview = await build_preview_package(run_id, req)
        snapshot = upsert_run_preview(run_id, preview)

    payload = req.model_dump()
    if snapshot.get("generated_posts"):
        payload["generated_posts"] = snapshot.get("generated_posts")
    if snapshot.get("ai_generation"):
        payload["ai_generation"] = snapshot.get("ai_generation")
    result = await trigger_kestra_flow(run_id, payload)
    return {
        "status": "accepted",
        "run_id": run_id,
        "kestra_execution_id": result.get("kestra_execution_id"),
        "message": "Kestra workflow triggered.",
    }


@app.get("/api/runs")
async def list_runs():
    ensure_storage()
    runs: List[Dict[str, Any]] = []
    for file_path in RUNS_DIR.glob("*.json"):
        data = load_json_file(file_path)
        if data:
            if data.get("status") == "running" and data.get("kestra_execution_id"):
                data = await sync_run_with_kestra(data)
            runs.append(data)
    runs.sort(key=lambda item: item.get("updated_at") or item.get("timestamp") or "", reverse=True)
    return {"runs": runs}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    data = read_run_snapshot(run_id)
    if not data:
        raise HTTPException(status_code=404, detail="Run not found")
    return await sync_run_with_kestra(data)


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
    preview = await build_preview_package(run_id, webhook_payload)
    upsert_run_preview(run_id, preview)
    return {"status": "accepted", "run_id": run_id, "message": "GitHub webhook ingested."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
