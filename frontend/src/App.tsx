import { useEffect, useMemo, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCommitVertical,
  GitPullRequest,
  Globe2,
  ListChecks,
  Loader2,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  Wand2,
  Workflow,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
const KESTRA_UI_URL = import.meta.env.VITE_KESTRA_UI_URL ?? 'http://localhost:8080/ui/';
const DEFAULT_GITHUB_USERNAME = import.meta.env.VITE_DEFAULT_GITHUB_USERNAME ?? 'FiscalMindset';
const DEFAULT_GITHUB_REPO = import.meta.env.VITE_DEFAULT_GITHUB_REPO ?? 'FiscalMindset/autopr';
const DEFAULT_GITHUB_REPO_URL = import.meta.env.VITE_DEFAULT_GITHUB_REPO_URL ?? 'https://github.com/FiscalMindset/autopr.git';
const DEFAULT_AUTHOR = import.meta.env.VITE_DEFAULT_AUTHOR ?? 'Vicky Kumar';

type RepoItem = {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url?: string;
  default_branch?: string;
  language?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  updated_at?: string;
  private?: boolean;
  fork?: boolean;
  topics?: string[];
  owner?: {
    login?: string;
    html_url?: string;
  };
};

type CommitItem = {
  sha: string;
  message: string;
  author_name?: string;
  author_date?: string;
  html_url?: string;
  author_login?: string;
};

type PullRequestItem = {
  number: number;
  title: string;
  state?: string;
  html_url?: string;
  merged_at?: string | null;
  author_login?: string;
};

type RepoRefPayload = {
  owner: string;
  name: string;
  full_name?: string;
  html_url?: string;
  description?: string;
  default_branch?: string;
};

type CommitRefPayload = {
  sha: string;
  message: string;
  author_name?: string;
  author_date?: string;
  html_url?: string;
};

type PullRequestRefPayload = {
  number: number;
  title: string;
  state?: string;
  html_url?: string;
  merged_at?: string | null;
  author_login?: string;
};

type StyleAnalysis = {
  tone: string;
  structure: string;
  hook_style: string;
  technical_depth: string;
  audience: string;
  cta_pattern: string;
  hashtag_pattern: {
    count: number;
    examples: string[];
    style: string;
  };
  sample_count: number;
  summary: string;
  use_for_generation?: boolean;
  source?: string;
  source_urls?: string[];
  style_rules?: string[];
};

type GeneratedPosts = {
  linkedin: string;
  x: string;
  instagram: string;
  whatsapp_dm: string;
};

type DeliveryStatus = Record<string, string>;

type RunTimeline = {
  step: string;
  status: string;
};

type RunRecord = {
  id?: string;
  run_id?: string;
  status?: string;
  timestamp?: string;
  updated_at?: string;
  input_source?: string;
  source?: string;
  project?: string;
  author?: string;
  kestra_execution_id?: string;
  kestra_response?: Record<string, unknown>;
  generated_posts?: GeneratedPosts;
  routing_decision?: {
    platforms: string[];
    recipients: string[];
    reason: string;
    requires_review?: boolean;
  };
  delivery_status?: DeliveryStatus;
  analysis?: Record<string, unknown>;
  style_profile?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  execution_timeline?: RunTimeline[];
  logs?: string[];
  errors?: string[];
  selected_repo?: RepoItem | string;
  selected_commit?: CommitItem | null;
  selected_pr?: PullRequestItem | null;
  error?: string;
  dry_run?: boolean;
};

type PostRecord = {
  run_id: string;
  platform: string;
  content: string;
  timestamp: string;
  status: string;
  dry_run: boolean;
};

type KestraTaskDefinition = {
  id: string;
  type: string;
  plugin?: boolean;
  subflow?: string;
  condition?: string;
  values?: string;
};

type KestraFlowDefinition = {
  namespace: string;
  flow_id: string;
  revision?: number;
  url?: string;
  source_text?: string;
  tasks?: KestraTaskDefinition[];
  plugin_tasks?: KestraTaskDefinition[];
  subflows?: string[];
};

type KestraTaskRun = {
  id?: string;
  task_id: string;
  state?: string;
  value?: string;
  duration?: string;
  outputs?: Record<string, unknown>;
};

type KestraExecutionDetails = {
  execution_id: string;
  flow_id?: string;
  namespace?: string;
  revision?: number;
  state?: string;
  duration?: string;
  url?: string;
  task_runs?: KestraTaskRun[];
  logs?: Array<{
    timestamp?: string;
    level?: string;
    task_id?: string;
    message?: string;
  }>;
};

type ActionPhase = 'idle' | 'loading' | 'success' | 'error';

type ActionState = {
  phase: ActionPhase;
  message: string;
  detail?: string;
  executionId?: string;
};

type Notice = {
  id: number;
  tone: 'info' | 'success' | 'error';
  title: string;
  message: string;
};

type WorkflowPayload = {
  source: 'github_commit' | 'github_pr' | 'manual' | 'github_webhook';
  project: string;
  raw_update?: string;
  author: string;
  goal: string;
  dry_run: boolean;
  selected_repo?: RepoRefPayload;
  selected_commit?: CommitRefPayload;
  selected_pr?: PullRequestRefPayload;
  github_username?: string;
  github_token?: string;
  github_context?: Record<string, unknown>;
  style_analysis?: StyleAnalysis | null;
  use_style_profile?: boolean;
  delivery_webhook_url?: string;
  input_source?: string;
  run_id?: string;
};

const actionDefaults: Record<string, ActionState> = {
  auto: { phase: 'idle', message: 'Ready to run the default AutoPR pipeline.' },
  repos: { phase: 'idle', message: 'Awaiting GitHub credentials.' },
  commits: { phase: 'idle', message: 'Select a repository to fetch commits.' },
  prs: { phase: 'idle', message: 'Optional GitHub pull request context is available after repo selection.' },
  style: { phase: 'idle', message: 'Import Algsoch public social style before generation.' },
  preview: { phase: 'idle', message: 'Generate a preview to inspect content.' },
  kestra: { phase: 'idle', message: 'Kestra is ready to orchestrate a run.' },
  dryRun: { phase: 'idle', message: 'Dry-run delivery is ready.' },
  live: { phase: 'idle', message: 'Live delivery needs an adapter URL.' },
};

const platformMeta = {
  linkedin: { label: 'LinkedIn', icon: Workflow, accent: 'from-cyan-400 to-sky-500' },
  x: { label: 'X', icon: GitBranch, accent: 'from-slate-300 to-slate-500' },
  instagram: { label: 'Instagram', icon: Globe2, accent: 'from-fuchsia-400 to-rose-500' },
  whatsapp_dm: { label: 'WhatsApp / DM', icon: MessageCircle, accent: 'from-emerald-400 to-lime-500' },
} as const;

function formatTime(value?: string) {
  if (!value) {
    return 'now';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusTone(phase: ActionPhase) {
  if (phase === 'success') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (phase === 'error') return 'border-rose-500/30 bg-rose-500/10 text-rose-200';
  if (phase === 'loading') return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  return 'border-white/10 bg-white/5 text-slate-300';
}

function noticeTone(tone: Notice['tone']) {
  if (tone === 'success') return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-100';
  if (tone === 'error') return 'border-rose-500/30 bg-rose-500/15 text-rose-100';
  return 'border-cyan-500/30 bg-cyan-500/15 text-cyan-100';
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string | { message?: string } }>;
    const detail = axiosError.response?.data?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return detail.message || axiosError.message;
    }
    return axiosError.response?.statusText || axiosError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected request failure.';
}

function splitSamples(input: string) {
  return input
    .split(/\n{2,}/)
    .map((sample) => sample.trim())
    .filter(Boolean);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function deliveryMeaning(status?: string) {
  if (!status) return 'No delivery result yet.';
  if (status.includes('dry_run')) return 'Not posted. Saved as copy/paste output.';
  if (status.includes('missing_adapter')) return 'Not posted. Credentials or adapter missing.';
  if (status.includes('live_adapter')) return 'Sent to live adapter. Platform posting depends on that adapter.';
  if (status.includes('sent') || status.includes('posted')) return 'Posted or accepted by platform adapter.';
  return status;
}

function executionStatusTone(state?: string) {
  if (state === 'SUCCESS' || state === 'completed') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100';
  if (state === 'FAILED' || state === 'failed') return 'border-rose-500/20 bg-rose-500/10 text-rose-100';
  if (state === 'RUNNING' || state === 'running') return 'border-amber-500/20 bg-amber-500/10 text-amber-100';
  return 'border-white/10 bg-white/5 text-slate-300';
}

function toRepoRef(repo: RepoItem | null | undefined): RepoRefPayload | undefined {
  if (!repo) return undefined;
  return {
    owner: repo.owner?.login || repo.full_name.split('/')[0] || DEFAULT_GITHUB_USERNAME,
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    default_branch: repo.default_branch,
  };
}

function toCommitRef(commit: CommitItem | null | undefined): CommitRefPayload | undefined {
  if (!commit) return undefined;
  return {
    sha: commit.sha,
    message: commit.message,
    author_name: commit.author_name,
    author_date: commit.author_date,
    html_url: commit.html_url,
  };
}

function toPullRequestRef(pr: PullRequestItem | null | undefined): PullRequestRefPayload | undefined {
  if (!pr) return undefined;
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    html_url: pr.html_url,
    merged_at: pr.merged_at,
    author_login: pr.author_login,
  };
}

function App() {
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestItem[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepoItem | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitItem | null>(null);
  const [selectedPr, setSelectedPr] = useState<PullRequestItem | null>(null);
  const [preview, setPreview] = useState<RunRecord | null>(null);
  const [styleAnalysis, setStyleAnalysis] = useState<StyleAnalysis | null>(null);
  const [styleSamples, setStyleSamples] = useState('');
  const [githubUsername, setGitHubUsername] = useState(DEFAULT_GITHUB_USERNAME);
  const [githubToken, setGitHubToken] = useState('');
  const [author, setAuthor] = useState(DEFAULT_AUTHOR);
  const [project, setProject] = useState(DEFAULT_GITHUB_REPO);
  const [rawUpdate, setRawUpdate] = useState('');
  const [goal, setGoal] = useState('build_in_public');
  const [inputSource, setInputSource] = useState<'github_commit' | 'manual'>('github_commit');
  const [dryRun, setDryRun] = useState(true);
  const [useStyleProfile, setUseStyleProfile] = useState(true);
  const [deliveryWebhookUrl, setDeliveryWebhookUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<keyof GeneratedPosts>('linkedin');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [kestraExecution, setKestraExecution] = useState<KestraExecutionDetails | null>(null);
  const [flowDefinition, setFlowDefinition] = useState<KestraFlowDefinition | null>(null);
  const [orchestrationTab, setOrchestrationTab] = useState<'topology' | 'logs' | 'flow' | 'outputs'>('topology');
  const [actions, setActions] = useState(actionDefaults);
  const [notices, setNotices] = useState<Notice[]>([]);

  const api = useMemo(() => axios.create({ baseURL: API_URL, timeout: 45000 }), []);

  const activePreview = preview;
  const currentGeneratedPosts = activePreview?.generated_posts;
  const currentRouting = activePreview?.routing_decision;
  const currentDelivery = activePreview?.delivery_status;
  const currentLogs = activePreview?.logs || [];
  const currentTimeline = activePreview?.execution_timeline || [];
  const currentExecutionId = activePreview?.kestra_execution_id;
  const currentRunId = activePreview?.run_id || selectedRunId;
  const currentExecutionUrl = kestraExecution?.url || (currentExecutionId ? `${KESTRA_UI_URL.replace(/\/$/, '')}/executions/system.autopr/autopr_main_flow/${currentExecutionId}` : '');

  const metrics = useMemo(() => {
    const platformCount = currentRouting?.platforms?.length ?? 0;
    const deliveryCount = Object.values(currentDelivery || {}).filter((value) => value.includes('dry_run') || value.includes('live') || value.includes('sent')).length;
    return [
      { label: 'Repositories', value: repos.length.toString(), tone: 'from-cyan-400 to-sky-500' },
      { label: 'Commits', value: commits.length.toString(), tone: 'from-emerald-400 to-lime-500' },
      { label: 'GitHub Pulls', value: pullRequests.length.toString(), tone: 'from-fuchsia-400 to-rose-500' },
      { label: 'Selected Platforms', value: platformCount.toString(), tone: 'from-amber-400 to-orange-500' },
      { label: 'Delivery Targets', value: deliveryCount.toString(), tone: 'from-violet-400 to-indigo-500' },
      { label: 'Runs', value: runs.length.toString(), tone: 'from-slate-300 to-slate-500' },
    ];
  }, [commits.length, currentDelivery, currentRouting?.platforms?.length, pullRequests.length, repos.length, runs.length]);

  const contentChart = useMemo(() => {
    if (!currentGeneratedPosts) {
      return [];
    }
    return Object.entries(currentGeneratedPosts).map(([platform, content]) => ({
      platform,
      length: content.length,
      words: countWords(content),
    }));
  }, [currentGeneratedPosts]);

  const setAction = (key: keyof typeof actionDefaults, next: ActionState) => {
    setActions((previous) => ({ ...previous, [key]: next }));
  };

  const pushNotice = (tone: Notice['tone'], title: string, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((previous) => [{ id, tone, title, message }, ...previous].slice(0, 4));
    window.setTimeout(() => {
      setNotices((previous) => previous.filter((notice) => notice.id !== id));
    }, 5200);
  };

  const buildWorkflowPayload = (overrides: Partial<WorkflowPayload> = {}): WorkflowPayload => ({
    source: overrides.source ?? (inputSource === 'github_commit' ? 'github_commit' : 'manual'),
    project: overrides.project ?? selectedRepo?.full_name ?? project,
    raw_update: overrides.raw_update ?? (rawUpdate.trim() || selectedCommit?.message || selectedPr?.title || ''),
    author: overrides.author ?? author,
    goal: overrides.goal ?? goal,
    dry_run: overrides.dry_run ?? dryRun,
    selected_repo: overrides.selected_repo ?? toRepoRef(selectedRepo),
    selected_commit: overrides.selected_commit ?? toCommitRef(selectedCommit),
    selected_pr: overrides.selected_pr ?? toPullRequestRef(selectedPr),
    github_username: overrides.github_username ?? (githubUsername || undefined),
    github_token: overrides.github_token ?? (githubToken || undefined),
    github_context: overrides.github_context ?? {
      repo_count: repos.length,
      commit_count: commits.length,
      github_pull_request_count: pullRequests.length,
      selected_repo: selectedRepo?.full_name ?? null,
      selected_commit: selectedCommit?.sha ?? null,
      selected_pr: selectedPr?.number ?? null,
    },
    style_analysis: overrides.style_analysis ?? (useStyleProfile ? styleAnalysis ?? undefined : undefined),
    use_style_profile: overrides.use_style_profile ?? useStyleProfile,
    delivery_webhook_url: overrides.delivery_webhook_url ?? (deliveryWebhookUrl || undefined),
    input_source: overrides.input_source ?? inputSource,
    run_id: overrides.run_id ?? activePreview?.run_id ?? preview?.run_id,
  });

  const fetchRuns = async () => {
    try {
      const response = await api.get('/runs');
      setRuns(response.data.runs || []);
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Failed to refresh runs.', detail: errorMessage(error) });
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await api.get('/posts');
      setPosts(response.data.posts || []);
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Failed to refresh output files.', detail: errorMessage(error) });
    }
  };

  const loadFlowDefinition = async () => {
    try {
      const response = await api.get('/kestra/flow-definition');
      setFlowDefinition(response.data as KestraFlowDefinition);
    } catch (error) {
      setAction('kestra', { phase: 'error', message: 'Could not load Kestra flow definition.', detail: errorMessage(error) });
    }
  };

  const loadKestraExecution = async (executionId: string) => {
    try {
      const response = await api.get(`/kestra/executions/${executionId}`);
      setKestraExecution(response.data as KestraExecutionDetails);
    } catch (error) {
      setAction('kestra', { phase: 'error', message: 'Could not load Kestra execution.', detail: errorMessage(error) });
    }
  };

  const copyText = async (label: string, text?: string) => {
    if (!text) {
      pushNotice('error', 'Nothing to copy', `${label} is empty.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      pushNotice('success', 'Copied', `${label} copied to clipboard.`);
    } catch (error) {
      pushNotice('error', 'Copy failed', errorMessage(error));
    }
  };

  useEffect(() => {
    const refresh = () => {
      void fetchRuns();
      void fetchPosts();
    };
    const firstRefresh = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 6000);
    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(interval);
    };
    // Polling intentionally owns its first render snapshot; action handlers update the same stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => {
      void loadFlowDefinition();
    }, 0);
    return () => window.clearTimeout(firstLoad);
    // Loaded once to show the actual registered Kestra topology.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRepos = async (options: { username?: string; silent?: boolean; throwOnError?: boolean } = {}) => {
    const username = (options.username ?? githubUsername).trim();
    if (!username) {
      setAction('repos', { phase: 'error', message: 'Enter a GitHub username first.' });
      return [];
    }

    setAction('repos', { phase: 'loading', message: 'POST /api/github/fetch-repos', detail: 'Fetching repositories from GitHub.' });
    try {
      const response = await api.post('/github/fetch-repos', {
        username,
        token: githubToken.trim() || undefined,
        include_forks: true,
        include_private: true,
        pinned_repo: DEFAULT_GITHUB_REPO,
      });
      const items = response.data.items || [];
      setRepos(items);
      setSelectedRepo((previous) => previous ?? items.find((repo: RepoItem) => repo.full_name === DEFAULT_GITHUB_REPO) ?? items[0] ?? null);
      setProject(items.find((repo: RepoItem) => repo.full_name === DEFAULT_GITHUB_REPO)?.full_name || items[0]?.full_name || project);
      setAction('repos', {
        phase: 'success',
        message: response.data.message || `Loaded ${items.length || 0} repositories.`,
        detail: response.data.auth_mode ? `Auth mode: ${response.data.auth_mode}` : undefined,
      });
      if (!options.silent) {
        pushNotice('success', 'Repositories loaded', response.data.message || `Loaded ${items.length} repositories.`);
      }
      return items as RepoItem[];
    } catch (error) {
      setAction('repos', { phase: 'error', message: 'GitHub repositories could not be fetched.', detail: errorMessage(error) });
      pushNotice('error', 'Repository fetch failed', errorMessage(error));
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  };

  const fetchCommits = async (repoOverride?: RepoItem, options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    const repo = repoOverride ?? selectedRepo;
    if (!repo) {
      setAction('commits', { phase: 'error', message: 'Select a repository before fetching commits.' });
      return [];
    }

    setAction('commits', { phase: 'loading', message: 'POST /api/github/fetch-commits', detail: `Loading commits for ${repo.full_name}.` });
    try {
      const response = await api.post('/github/fetch-commits', {
        owner: repo.owner?.login || githubUsername || repo.full_name.split('/')[0],
        repo: repo.name,
        token: githubToken.trim() || undefined,
      });
      const items = response.data.items || [];
      setCommits(items);
      setSelectedCommit((previous) => previous ?? items[0] ?? null);
      if (items[0]?.message) {
        setRawUpdate(items[0].message);
      }
      setAction('commits', { phase: 'success', message: response.data.message || `Loaded ${items.length || 0} commits.` });
      if (!options.silent) {
        pushNotice('success', 'Commits loaded', response.data.message || `Loaded ${items.length} commits.`);
      }
      return items as CommitItem[];
    } catch (error) {
      setAction('commits', { phase: 'error', message: 'Commit fetch failed.', detail: errorMessage(error) });
      pushNotice('error', 'Commit fetch failed', errorMessage(error));
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  };

  const fetchPullRequests = async (repoOverride?: RepoItem, options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    const repo = repoOverride ?? selectedRepo;
    if (!repo) {
      setAction('prs', { phase: 'error', message: 'Select a repository before fetching GitHub pull requests.' });
      return [];
    }

    setAction('prs', { phase: 'loading', message: 'POST /api/github/fetch-prs', detail: `Loading optional GitHub pull request context for ${repo.full_name}.` });
    try {
      const response = await api.post('/github/fetch-prs', {
        owner: repo.owner?.login || githubUsername || repo.full_name.split('/')[0],
        repo: repo.name,
        token: githubToken.trim() || undefined,
      });
      const items = response.data.items || [];
      setPullRequests(items);
      setSelectedPr((previous) => previous ?? items[0] ?? null);
      if (!rawUpdate.trim() && items[0]?.title) {
        setRawUpdate(items[0].title);
      }
      setAction('prs', { phase: 'success', message: response.data.message || `Loaded ${items.length || 0} GitHub pull requests.` });
      if (!options.silent) {
        pushNotice('success', 'GitHub pull requests loaded', response.data.message || `Loaded ${items.length} pull requests as optional context.`);
      }
      return items as PullRequestItem[];
    } catch (error) {
      setAction('prs', { phase: 'error', message: 'GitHub pull request fetch failed.', detail: errorMessage(error) });
      pushNotice('error', 'GitHub pull request fetch failed', errorMessage(error));
      if (options.throwOnError) {
        throw error;
      }
      return [];
    }
  };

  const analyzeStyle = async (samplesOverride?: string[], options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    const samples = samplesOverride ?? splitSamples(styleSamples);
    if (samples.length === 0) {
      setAction('style', { phase: 'error', message: 'Add at least one sample LinkedIn post.' });
      return null;
    }

    setAction('style', { phase: 'loading', message: 'POST /api/linkedin/analyze-style', detail: 'Analyzing tone, hooks, CTA, and hashtags.' });
    try {
      const response = await api.post('/linkedin/analyze-style', {
        sample_posts: samples,
        use_for_generation: true,
      });
      setStyleAnalysis(response.data.analysis);
      setUseStyleProfile(true);
      setAction('style', { phase: 'success', message: response.data.message || 'LinkedIn style analysis completed.' });
      if (!options.silent) {
        pushNotice('success', 'LinkedIn style analyzed', response.data.analysis?.summary || 'Style profile is ready for generation.');
      }
      return response.data.analysis as StyleAnalysis;
    } catch (error) {
      setAction('style', { phase: 'error', message: 'Style analysis failed.', detail: errorMessage(error) });
      pushNotice('error', 'Style analysis failed', errorMessage(error));
      if (options.throwOnError) {
        throw error;
      }
      return null;
    }
  };

  const importAlgsochStyle = async (options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    setAction('style', {
      phase: 'loading',
      message: 'POST /api/social/import-algsoch-style',
      detail: 'Importing public Algsoch LinkedIn style signals for generation.',
    });
    try {
      const response = await api.post('/social/import-algsoch-style', {
        source: 'algsoch_linkedin',
        use_for_generation: true,
      });
      const analysis = response.data.analysis as StyleAnalysis;
      setStyleAnalysis(analysis);
      setUseStyleProfile(true);
      setAction('style', {
        phase: 'success',
        message: response.data.message || 'Algsoch public social style imported.',
        detail: analysis.summary,
      });
      if (!options.silent) {
        pushNotice('success', 'Algsoch style imported', analysis.summary);
      }
      return analysis;
    } catch (error) {
      const message = errorMessage(error);
      setAction('style', { phase: 'error', message: 'Algsoch social style import failed.', detail: message });
      pushNotice('error', 'Algsoch style import failed', message);
      if (options.throwOnError) {
        throw error;
      }
      return null;
    }
  };

  const generatePreview = async (payloadOverride?: WorkflowPayload, options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    const workflowPayload = payloadOverride ?? buildWorkflowPayload();
    setAction('preview', { phase: 'loading', message: 'POST /api/generate', detail: 'Building content preview before orchestration.' });
    try {
      const response = await api.post('/generate', workflowPayload);
      const nextPreview = response.data.preview as RunRecord;
      setPreview(nextPreview);
      setSelectedRunId(nextPreview?.run_id || nextPreview?.id || null);
      setAction('preview', {
        phase: 'success',
        message: response.data.message || 'Preview generated.',
        executionId: nextPreview?.kestra_execution_id,
      });
      if (!options.silent) {
        pushNotice('success', 'Content generated', response.data.message || 'Preview is ready.');
      }
      await fetchRuns();
      return nextPreview;
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Preview generation failed.', detail: errorMessage(error) });
      pushNotice('error', 'Preview generation failed', errorMessage(error));
      if (options.throwOnError) {
        throw error;
      }
      return null;
    }
  };

  const triggerKestra = async (dryRunOverride?: boolean, payloadOverride?: WorkflowPayload, options: { silent?: boolean; throwOnError?: boolean } = {}) => {
    const nextDryRun = typeof dryRunOverride === 'boolean' ? dryRunOverride : dryRun;
    if (!nextDryRun && !(payloadOverride?.delivery_webhook_url || deliveryWebhookUrl).trim()) {
      const message = 'Live mode needs a delivery adapter webhook URL or platform OAuth bridge. Kestra will not be triggered as a fake live run.';
      setAction('live', { phase: 'error', message: 'Live adapter missing.', detail: message });
      setAction('kestra', { phase: 'error', message: 'Kestra live trigger blocked.', detail: message });
      pushNotice('error', 'Live adapter missing', message);
      if (options.throwOnError) {
        throw new Error(message);
      }
      return undefined;
    }
    const workflowPayload = payloadOverride ?? buildWorkflowPayload({ dry_run: nextDryRun, run_id: activePreview?.run_id || preview?.run_id });
    const statusKey = nextDryRun ? 'dryRun' : 'live';
    setDryRun(nextDryRun);
    setAction(statusKey, {
      phase: 'loading',
      message: 'POST /api/kestra/trigger',
      detail: nextDryRun ? 'Triggering a dry-run execution.' : 'Triggering live delivery through the adapter layer.',
    });
    setAction('kestra', { phase: 'loading', message: 'Kestra workflow request in flight.', detail: nextDryRun ? 'Dry-run mode active.' : 'Live mode active.' });
    try {
      const response = await api.post('/kestra/trigger', workflowPayload);
      const executionId = response.data.kestra_execution_id;
      setAction(statusKey, {
        phase: 'success',
        message: response.data.message || 'Kestra workflow accepted.',
        executionId,
      });
      setAction('kestra', {
        phase: 'success',
        message: `Kestra execution started: ${executionId || 'pending id'}`,
        executionId,
      });
      setPreview((previous) => previous ? { ...previous, kestra_execution_id: executionId, status: 'running' } : previous);
      if (!options.silent) {
        pushNotice('success', 'Kestra execution started', executionId || 'Execution accepted by Kestra.');
      }
      if (executionId) {
        void loadKestraExecution(executionId);
      }
      await fetchRuns();
      return executionId as string | undefined;
    } catch (error) {
      const message = errorMessage(error);
      setAction(statusKey, { phase: 'error', message: nextDryRun ? 'Dry-run delivery failed.' : 'Live delivery failed.', detail: message });
      setAction('kestra', { phase: 'error', message: 'Kestra could not be triggered.', detail: message });
      pushNotice('error', 'Kestra trigger failed', message);
      if (options.throwOnError) {
        throw error;
      }
      return undefined;
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const response = await api.get(`/runs/${runId}`);
      setPreview(response.data as RunRecord);
      setSelectedRunId(runId);
      setSelectedPlatform((response.data.generated_posts && Object.keys(response.data.generated_posts)[0]) as keyof GeneratedPosts || 'linkedin');
      if (response.data.kestra_execution_id) {
        void loadKestraExecution(response.data.kestra_execution_id);
      }
      if (response.data.generated_posts?.linkedin) {
        setRawUpdate(response.data.payload?.raw_update as string || rawUpdate);
      }
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Could not load run details.', detail: errorMessage(error) });
      pushNotice('error', 'Run details unavailable', errorMessage(error));
    }
  };

  const runAutoPR = async () => {
    const requestedDryRun = dryRun;
    if (!requestedDryRun && !deliveryWebhookUrl.trim()) {
      const message = 'Live mode needs a delivery adapter webhook URL or platform OAuth bridge. I will not silently dry-run a live request.';
      setAction('auto', { phase: 'error', message: 'Live delivery is not configured.', detail: message });
      setAction('live', { phase: 'error', message: 'Live adapter missing.', detail: message });
      pushNotice('error', 'Live adapter missing', message);
      return;
    }

    setAction('auto', {
      phase: 'loading',
      message: 'Running the full AutoPR pipeline.',
      detail: `Selected repo -> Kestra plugin import -> Algsoch social style -> ${requestedDryRun ? 'dry run' : 'live adapter'}.`,
    });
    pushNotice('info', 'AutoPR started', `Fetching ${selectedRepo?.full_name || DEFAULT_GITHUB_REPO} and preparing an orchestrated ${requestedDryRun ? 'dry run' : 'live adapter run'}.`);

    try {
      let loadedRepos = repos;
      let repo = selectedRepo;
      if (!repo) {
        loadedRepos = await fetchRepos({ username: githubUsername || DEFAULT_GITHUB_USERNAME, silent: true, throwOnError: true });
        repo = loadedRepos.find((item) => item.full_name === project) ?? loadedRepos.find((item) => item.full_name === DEFAULT_GITHUB_REPO) ?? loadedRepos[0] ?? null;
      }
      if (!repo) {
        throw new Error(`No repository selected or returned for ${githubUsername || DEFAULT_GITHUB_USERNAME}.`);
      }

      setSelectedRepo(repo);
      setProject(repo.full_name);

      const loadedCommits = await fetchCommits(repo, { silent: true, throwOnError: true });
      const commit = loadedCommits[0] ?? null;
      const source = commit ? 'github_commit' : 'manual';
      const updateText = commit?.message || `Latest repository activity for ${repo.full_name}`;
      const styleProfile = styleAnalysis ?? await importAlgsochStyle({ silent: true, throwOnError: true });

      setSelectedCommit(commit);
      setSelectedPr(null);
      setInputSource(source);
      setRawUpdate(updateText);

      const workflowPayload = buildWorkflowPayload({
        source,
        project: repo.full_name,
        raw_update: updateText,
        author,
        goal,
        dry_run: requestedDryRun,
        selected_repo: toRepoRef(repo),
        selected_commit: toCommitRef(commit),
        selected_pr: undefined,
        github_username: repo.owner?.login || githubUsername || DEFAULT_GITHUB_USERNAME,
        github_token: githubToken.trim() || undefined,
        github_context: {
          repo_count: loadedRepos.length,
          commit_count: loadedCommits.length,
          public_relations_goal: goal,
          selected_repo: repo.full_name,
          selected_commit: commit?.sha ?? null,
          default_repo_url: DEFAULT_GITHUB_REPO_URL,
          style_source: styleProfile?.source || 'algsoch_linkedin',
        },
        style_analysis: styleProfile,
        use_style_profile: Boolean(styleProfile),
        input_source: source,
      });

      const nextPreview = await generatePreview(workflowPayload, { silent: true, throwOnError: true });
      const executionId = await triggerKestra(requestedDryRun, { ...workflowPayload, run_id: nextPreview?.run_id }, { silent: true, throwOnError: true });

      setAction('auto', {
        phase: 'success',
        message: 'AutoPR pipeline started.',
        detail: `Generated content from ${source.replace('_', ' ')} and triggered Kestra execution ${executionId || 'pending'}.`,
        executionId,
      });
      pushNotice('success', 'AutoPR pipeline started', `Run ${nextPreview?.run_id || 'created'} is now visible in Kestra.`);
    } catch (error) {
      const message = errorMessage(error);
      setAction('auto', { phase: 'error', message: 'AutoPR pipeline failed.', detail: message });
      pushNotice('error', 'AutoPR failed', message);
    }
  };

  useEffect(() => {
    if (!currentRunId || !currentExecutionId || activePreview?.status === 'completed' || activePreview?.status === 'failed') {
      return;
    }

    const firstExecutionLoad = window.setTimeout(() => {
      void loadKestraExecution(currentExecutionId);
    }, 0);
    const interval = window.setInterval(() => {
      void loadRunDetails(currentRunId);
      void fetchPosts();
      void loadKestraExecution(currentExecutionId);
    }, 4000);

    return () => {
      window.clearTimeout(firstExecutionLoad);
      window.clearInterval(interval);
    };
    // The interval is keyed by the active run identity; helper functions are kept out to avoid restarting polling every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreview?.status, currentExecutionId, currentRunId]);

  useEffect(() => {
    if (currentExecutionId && (activePreview?.status === 'completed' || activePreview?.status === 'failed')) {
      const finalLoad = window.setTimeout(() => {
        void loadKestraExecution(currentExecutionId);
      }, 0);
      return () => window.clearTimeout(finalLoad);
    }
    // Keep the final Kestra snapshot visible after polling stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePreview?.status, currentExecutionId]);

  const selectedPlatformContent = currentGeneratedPosts?.[selectedPlatform] || '';

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
      <div className="fixed right-4 top-4 z-50 flex w-[calc(100vw-2rem)] max-w-md flex-col gap-3">
        <AnimatePresence>
          {notices.map((notice) => (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className={`rounded-lg border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl ${noticeTone(notice.tone)}`}
            >
              <div className="flex items-start gap-3">
                {notice.tone === 'success' ? <CheckCircle2 size={18} /> : notice.tone === 'error' ? <XCircle size={18} /> : <Activity size={18} />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{notice.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-200">{notice.message}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-5 md:px-6 xl:px-8">
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-6"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-200/80">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">
                  <Workflow size={14} /> Kestra-powered orchestration
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <Activity size={14} /> GitHub intelligence
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1">
                  <Sparkles size={14} /> Multi-platform content delivery
                </span>
              </div>
              <div>
                <h1 className="bg-gradient-to-r from-white via-cyan-100 to-sky-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl">
                  AutoPR Engine
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
                  AI Content Orchestration & Distribution System. Pull real GitHub repos, inspect commits,
                  analyze LinkedIn style, preview platform content, and push the workflow through Kestra with full visibility.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px] xl:grid-cols-1">
              <button onClick={() => void runAutoPR()} className="group rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-left transition hover:border-emerald-300/60 hover:bg-emerald-400/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">One Click</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-white">
                      {actions.auto.phase === 'loading' ? <Loader2 size={16} className="animate-spin text-emerald-200" /> : <Sparkles size={16} className="text-emerald-200" />} Run AutoPR
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-emerald-200 transition group-hover:translate-x-1" />
                </div>
              </button>
              <a href={KESTRA_UI_URL} target="_blank" rel="noreferrer" className="group rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 transition hover:border-cyan-400/40 hover:bg-slate-950">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Topology</div>
                    <div className="mt-1 flex items-center gap-2 text-sm font-medium text-white">
                      <Workflow size={16} className="text-cyan-300" /> Open Kestra UI
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                </div>
              </a>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Current Execution</div>
                <div className="mt-2 flex items-center gap-3 text-sm text-slate-200">
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 font-mono text-cyan-200">{currentRunId || 'none'}</span>
                  <span className="text-slate-400">{currentExecutionId || 'no Kestra execution yet'}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
            >
              <div className={`h-1.5 w-20 rounded-full bg-gradient-to-r ${metric.tone}`} />
              <div className="mt-4 text-3xl font-semibold text-white">{metric.value}</div>
              <div className="mt-1 text-sm text-slate-400">{metric.label}</div>
            </motion.div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">GitHub Intelligence</h2>
                  <p className="text-sm text-slate-400">Default target: {DEFAULT_GITHUB_REPO}. The main path fetches the latest commit and turns it into platform content.</p>
                </div>
                  <button onClick={() => void fetchRepos()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">
                  {actions.repos.phase === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}
                  Fetch Repos
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">GitHub Username</span>
                  <input
                    value={githubUsername}
                    onChange={(event) => setGitHubUsername(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                    placeholder="octocat"
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2 xl:col-span-1">
                  <span className="text-slate-300">GitHub Token</span>
                  <input
                    value={githubToken}
                    onChange={(event) => setGitHubToken(event.target.value)}
                    type="password"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                    placeholder="ghp_..."
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Public Relations Goal</span>
                  <select value={goal} onChange={(event) => setGoal(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40">
                    <option value="general_update">General update</option>
                    <option value="build_in_public">Build in public</option>
                    <option value="hiring">Hiring / team growth</option>
                    <option value="milestone">Milestone / launch</option>
                    <option value="technical_update">Technical update</option>
                    <option value="team_growth">Team growth</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Input Source</span>
                  <select value={inputSource} onChange={(event) => setInputSource(event.target.value as typeof inputSource)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40">
                    <option value="github_commit">GitHub commit</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-200">Repository Cards</h3>
                    <span className="text-xs text-slate-500">{repos.length} loaded</span>
                  </div>
                  <div className="grid max-h-[420px] gap-3 overflow-auto pr-1 sm:grid-cols-2">
                    {repos.length === 0 ? (
                      <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-500">
                        Fetch repositories to populate the selector grid.
                      </div>
                    ) : (
                      repos.map((repo) => {
                        const isSelected = selectedRepo?.full_name === repo.full_name;
                        return (
                          <button
                            key={repo.full_name}
                            type="button"
                            onClick={() => {
                              setSelectedRepo(repo);
                              setProject(repo.full_name);
                              setCommits([]);
                              setPullRequests([]);
                              setSelectedCommit(null);
                              setSelectedPr(null);
                              setAction('commits', { phase: 'idle', message: `Ready to fetch commits for ${repo.full_name}.` });
                              setAction('prs', { phase: 'idle', message: `Optional GitHub pull request context is ready for ${repo.full_name}.` });
                            }}
                            className={`rounded-2xl border p-4 text-left transition ${isSelected ? 'border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]' : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-950'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                  <GitBranch size={15} className="text-cyan-300" />
                                  {repo.full_name}
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{repo.description || 'No description provided.'}</p>
                              </div>
                              {isSelected && <CheckCircle2 size={16} className="mt-1 text-emerald-300" />}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              <span className="rounded-full border border-white/10 px-2 py-1">{repo.language || 'Unknown language'}</span>
                              <span className="rounded-full border border-white/10 px-2 py-1">★ {repo.stargazers_count ?? 0}</span>
                              <span className="rounded-full border border-white/10 px-2 py-1">Issues {repo.open_issues_count ?? 0}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3">
                    <button onClick={() => void fetchCommits()} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-slate-950">
                      <span className="flex items-center gap-2 text-sm text-white">
                        {actions.commits.phase === 'loading' ? <Loader2 size={16} className="animate-spin text-cyan-300" /> : <GitCommitVertical size={16} className="text-cyan-300" />}
                        Fetch Commits
                      </span>
                      <span className="text-xs text-slate-500">{selectedRepo?.full_name || 'select repo'}</span>
                    </button>
                    <button onClick={() => void fetchPullRequests()} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition hover:border-fuchsia-400/40 hover:bg-slate-950">
                      <span className="flex items-center gap-2 text-sm text-white">
                        {actions.prs.phase === 'loading' ? <Loader2 size={16} className="animate-spin text-fuchsia-300" /> : <GitPullRequest size={16} className="text-fuchsia-300" />}
                        Fetch GitHub Pulls
                      </span>
                      <span className="text-xs text-slate-500">{selectedRepo?.full_name || 'select repo'}</span>
                    </button>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="flex items-center gap-2 font-medium"><GitCommitVertical size={15} className="text-emerald-300" /> Latest Commits</span>
                      <span className="text-xs text-slate-500">{commits.length}</span>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-auto pr-1">
                      {commits.length === 0 ? (
                        <p className="text-sm text-slate-500">No commits loaded yet.</p>
                      ) : (
                        commits.map((commit) => (
                          <button
                            key={commit.sha}
                            type="button"
                            onClick={() => {
                              setSelectedCommit(commit);
                              setRawUpdate(commit.message);
                              setInputSource('github_commit');
                            }}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedCommit?.sha === commit.sha ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-cyan-200">{commit.sha.slice(0, 8)}</span>
                              <span className="text-[11px] text-slate-500">{formatTime(commit.author_date)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-200">{commit.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-200">
                      <span className="flex items-center gap-2 font-medium"><GitPullRequest size={15} className="text-fuchsia-300" /> Optional GitHub Pull Requests</span>
                      <span className="text-xs text-slate-500">{pullRequests.length}</span>
                    </div>
                    <div className="max-h-48 space-y-2 overflow-auto pr-1">
                      {pullRequests.length === 0 ? (
                        <p className="text-sm text-slate-500">No pull requests loaded yet.</p>
                      ) : (
                        pullRequests.map((pr) => (
                          <button
                            key={pr.number}
                            type="button"
                            onClick={() => {
                              setSelectedPr(pr);
                            }}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedPr?.number === pr.number ? 'border-fuchsia-400/40 bg-fuchsia-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-fuchsia-200">Pull #{pr.number}</span>
                              <span className="text-[11px] text-slate-500 capitalize">{pr.state || 'unknown'}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-200">{pr.title}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <ActionCard title="AutoPR Run" state={actions.auto} icon={Sparkles} />
                <ActionCard title="Fetch Repos" state={actions.repos} icon={GitBranch} />
                <ActionCard title="Fetch Commits" state={actions.commits} icon={GitCommitVertical} />
                <ActionCard title="GitHub Pulls" state={actions.prs} icon={GitPullRequest} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">LinkedIn Style Analyzer</h2>
                  <p className="text-sm text-slate-400">Import Algsoch public social style or paste additional posts to override it.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void importAlgsochStyle()} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">
                    {actions.style.phase === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                    Import Algsoch Style
                  </button>
                  <button onClick={() => void analyzeStyle()} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-400/20">
                    {actions.style.phase === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Analyze Pasted Style
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Sample LinkedIn Posts</span>
                  <textarea
                    value={styleSamples}
                    onChange={(event) => setStyleSamples(event.target.value)}
                    className="min-h-[210px] w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-fuchsia-400/40"
                    placeholder={'Paste one or more LinkedIn-style posts here. Separate samples with a blank line.\n\nExample:\nWe shipped a new orchestration pattern today...'}
                  />
                </label>

                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 ${statusTone(actions.style.phase)}`}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {actions.style.phase === 'loading' ? <Loader2 size={16} className="animate-spin" /> : actions.style.phase === 'success' ? <CheckCircle2 size={16} /> : actions.style.phase === 'error' ? <XCircle size={16} /> : <MessageSquareText size={16} />}
                      {actions.style.message}
                    </div>
                    {actions.style.detail && <p className="mt-2 text-xs leading-5 text-slate-300">{actions.style.detail}</p>}
                  </div>

                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                    <span className="flex items-center gap-2"><Users size={16} className="text-cyan-300" /> Use this style for generation</span>
                    <input type="checkbox" checked={useStyleProfile} onChange={(event) => setUseStyleProfile(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                  </label>

                  {styleAnalysis && (
                    <div className="grid gap-3">
                      <StatPill label="Tone" value={styleAnalysis.tone} />
                      <StatPill label="Structure" value={styleAnalysis.structure} />
                      <StatPill label="Hook Style" value={styleAnalysis.hook_style} />
                      <StatPill label="Audience" value={styleAnalysis.audience} />
                      <StatPill label="CTA Pattern" value={styleAnalysis.cta_pattern} />
                      <StatPill label="Hashtags" value={`${styleAnalysis.hashtag_pattern.count} / ${styleAnalysis.hashtag_pattern.style}`} />
                      {styleAnalysis.source && <StatPill label="Source" value={styleAnalysis.source} />}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Generation & Delivery Controls</h2>
                  <p className="text-sm text-slate-400">Preview locally, trigger Kestra, or switch to live adapter mode with a webhook.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 p-1 text-xs">
                  <button onClick={() => setDryRun(true)} className={`rounded-full px-3 py-1.5 transition ${dryRun ? 'bg-cyan-400 text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}>
                    Dry Run
                  </button>
                  <button onClick={() => setDryRun(false)} className={`rounded-full px-3 py-1.5 transition ${!dryRun ? 'bg-rose-400 text-slate-950' : 'text-slate-300 hover:bg-white/5'}`}>
                    Live
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2 text-sm md:col-span-2 xl:col-span-1">
                  <span className="text-slate-300">Project / Repo Name</span>
                  <input value={project} onChange={(event) => setProject(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40" />
                </label>
                <label className="space-y-2 text-sm md:col-span-2 xl:col-span-1">
                  <span className="text-slate-300">Author</span>
                  <input value={author} onChange={(event) => setAuthor(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40" />
                </label>
                <label className="space-y-2 text-sm md:col-span-2 xl:col-span-2">
                  <span className="text-slate-300">Delivery Adapter Webhook URL</span>
                  <input value={deliveryWebhookUrl} onChange={(event) => setDeliveryWebhookUrl(event.target.value)} placeholder="https://hooks.example.com/autopr" className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40" />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <label className="space-y-2 text-sm">
                  <span className="text-slate-300">Raw Update / Manual Input</span>
                  <textarea
                    value={rawUpdate}
                    onChange={(event) => setRawUpdate(event.target.value)}
                    className="min-h-[190px] w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40"
                    placeholder="Paste a commit message, release note, audience brief, or manual update."
                  />
                </label>

                <div className="space-y-3">
                  <ActionCard title="Generate Content" state={actions.preview} icon={Sparkles} />
                  <ActionCard title="Kestra Workflow" state={actions.kestra} icon={Workflow} />
                  <ActionCard title="Dry Run Delivery" state={actions.dryRun} icon={Send} />
                  <ActionCard title="Live Delivery" state={actions.live} icon={Globe2} />
                  <button onClick={() => void generatePreview()} className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">
                    Generate Content
                  </button>
                  <button onClick={() => void triggerKestra(true)} className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20">
                    Trigger Kestra Dry Run
                  </button>
                  <button onClick={() => void triggerKestra(false)} className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-400/20">
                    Trigger Live Adapter
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <div className="flex items-center gap-2"><Bot size={16} className="text-cyan-300" /> Workflow Preview</div>
                  <div className="text-xs text-slate-500">{currentRunId || 'preview not generated yet'}</div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                  {(currentTimeline.length ? currentTimeline : [
                    { step: 'validate_input', status: 'pending' },
                    { step: 'extract_github_context', status: 'pending' },
                    { step: 'linkedin_style_analysis', status: 'pending' },
                    { step: 'parallel_generation', status: 'pending' },
                    { step: 'routing', status: 'pending' },
                    { step: 'delivery', status: 'pending' },
                  ]).map((item) => (
                    <div key={item.step} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.step.replace(/_/g, ' ')}</div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-white">
                        {item.status === 'complete' || item.status === 'saved' ? <CheckCircle2 size={15} className="text-emerald-300" /> : item.status === 'queued' || item.status === 'pending' ? <Clock3 size={15} className="text-amber-300" /> : <AlertCircle size={15} className="text-rose-300" />}
                        <span className="capitalize">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Execution Summary</h2>
                  <p className="text-sm text-slate-400">Shows the current preview, the Kestra execution, and the latest run state.</p>
                </div>
                <button onClick={() => { void fetchRuns(); void fetchPosts(); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:bg-slate-950">
                  <RefreshCw size={16} className={actions.kestra.phase === 'loading' ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryBadge label="Run ID" value={currentRunId || 'pending'} />
                <SummaryBadge label="Execution ID" value={currentExecutionId || 'pending'} />
                <SummaryBadge label="Dry Run" value={String(dryRun)} />
                <SummaryBadge label="Style Analysis" value={styleAnalysis ? 'enabled' : 'off'} />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <ExternalLink size={16} className="text-cyan-300" /> Kestra Direct Links
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Open the real Kestra UI for topology, Gantt, logs, inputs, outputs, and task retries.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={currentExecutionUrl || KESTRA_UI_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      <ExternalLink size={15} /> Execution
                    </a>
                    <a
                      href={flowDefinition?.url || `${KESTRA_UI_URL.replace(/\/$/, '')}/flows/edit/system.autopr/autopr_main_flow`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40"
                    >
                      <FileCode2 size={15} /> Flow
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentExecutionId) void loadKestraExecution(currentExecutionId);
                        void loadFlowDefinition();
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40"
                    >
                      <RefreshCw size={15} /> Sync
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <SummaryBadge label="Kestra State" value={kestraExecution?.state || activePreview?.status || 'not loaded'} />
                  <SummaryBadge label="Flow Revision" value={String(kestraExecution?.revision || flowDefinition?.revision || 'pending')} />
                  <SummaryBadge label="Plugins Visible" value={String(flowDefinition?.plugin_tasks?.length || 0)} />
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2"><BarChart3 size={16} className="text-cyan-300" /> Content Length Analytics</span>
                    <span className="text-xs text-slate-500">characters / words</span>
                  </div>
                  <div className="mt-4 h-56">
                    {contentChart.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={contentChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                          <XAxis dataKey="platform" stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ background: '#020817', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#fff' }} />
                          <Bar dataKey="length" radius={[10, 10, 0, 0]}>
                            {contentChart.map((entry, index) => (
                              <Cell key={`cell-${entry.platform}`} fill={index % 2 === 0 ? '#22d3ee' : '#a855f7'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-slate-500">
                        Generate content to visualize platform output lengths.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2"><Workflow size={16} className="text-fuchsia-300" /> Delivery Status</span>
                    <span className="text-xs text-slate-500">dry-run vs live visibility</span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {Object.entries(currentDelivery || {}).length ? (
                      Object.entries(currentDelivery || {}).map(([platform, status]) => {
                        const meta = platformMeta[platform as keyof typeof platformMeta] || platformMeta.linkedin;
                        const Icon = meta.icon;
                        return (
                          <div key={platform} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-sm text-white">
                                <Icon size={16} className="text-cyan-300" />
                                {meta.label}
                              </div>
                              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-slate-300">{status}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-500">Delivery status will appear after preview or Kestra trigger.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span className="flex items-center gap-2"><MessageSquareText size={16} className="text-cyan-300" /> Generated Content</span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {currentGeneratedPosts && Object.keys(currentGeneratedPosts).map((platform) => (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setSelectedPlatform(platform as keyof GeneratedPosts)}
                        className={`rounded-full px-3 py-1 transition ${selectedPlatform === platform ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                      >
                        {platformMeta[platform as keyof typeof platformMeta]?.label || platform}
                      </button>
                    ))}
                  </div>
                </div>

                {currentGeneratedPosts ? (
                  <AnimatePresence mode="wait">
                    <motion.div key={selectedPlatform} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.25em] text-slate-500">{platformMeta[selectedPlatform]?.label || selectedPlatform}</div>
                          <div className="mt-1 text-sm text-slate-300">{currentRouting?.reason || 'Routing decision pending.'}</div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <span className={`rounded-full border px-3 py-1 text-xs ${executionStatusTone(currentDelivery?.[selectedPlatform])}`}>
                            {currentDelivery?.[selectedPlatform] || 'draft'}
                          </span>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{deliveryMeaning(currentDelivery?.[selectedPlatform])}</span>
                          <button
                            type="button"
                            onClick={() => void copyText(`${platformMeta[selectedPlatform]?.label || selectedPlatform} post`, selectedPlatformContent)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                          >
                            <Copy size={14} /> Copy
                          </button>
                          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{selectedPlatformContent.length} chars</span>
                        </div>
                      </div>
                      <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-slate-100">
{selectedPlatformContent}
                      </pre>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-500">Generate a preview to inspect the platform-specific copy.</div>
                )}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2"><Users size={16} className="text-emerald-300" /> Routing Decision</span>
                    <span className="text-xs text-slate-500">platforms and recipients</span>
                  </div>
                  <div className="mt-3 space-y-3 text-sm text-slate-300">
                    <DetailRow label="Platforms" value={currentRouting?.platforms?.join(', ') || 'pending'} />
                    <DetailRow label="Recipients" value={currentRouting?.recipients?.join(', ') || 'pending'} />
                    <DetailRow label="Reason" value={currentRouting?.reason || 'pending'} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="flex items-center gap-2"><Activity size={16} className="text-amber-300" /> Logs</span>
                    <span className="text-xs text-slate-500">backend preview and Kestra snapshots</span>
                  </div>
                  <div className="mt-3 max-h-56 space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-300">
                    {currentLogs.length ? currentLogs.map((line) => (
                      <div key={line} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 font-mono leading-5 text-slate-300">
                        {line}
                      </div>
                    )) : (
                      <div className="text-sm text-slate-500">No logs yet. Trigger a preview or Kestra execution.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Execution Timeline</h2>
                  <p className="text-sm text-slate-400">Shows the active stage graph for the current preview or latest run.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">{runs.length} runs tracked</span>
              </div>

              <div className="mt-4 space-y-3">
                {(currentTimeline.length ? currentTimeline : [
                  { step: 'validate_input', status: 'pending' },
                  { step: 'extract_github_context', status: 'pending' },
                  { step: 'linkedin_style_analysis', status: 'pending' },
                  { step: 'parallel_generation', status: 'pending' },
                  { step: 'routing', status: 'pending' },
                  { step: 'delivery', status: 'pending' },
                  { step: 'finalize', status: 'pending' },
                ]).map((item, index) => (
                  <div key={item.step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-semibold text-cyan-200">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{item.step.replace(/_/g, ' ')}</div>
                      <div className="text-xs text-slate-500">Kestra task / subflow stage</div>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${item.status === 'complete' || item.status === 'saved' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : item.status === 'queued' || item.status === 'pending' ? 'border-amber-500/20 bg-amber-500/10 text-amber-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-100'}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Kestra Orchestration Console</h2>
                  <p className="text-sm text-slate-400">Frontend mirror of the Kestra topology, plugin tasks, logs, flow definition, and output handoff state.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['topology', 'logs', 'flow', 'outputs'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setOrchestrationTab(tab)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm capitalize transition ${orchestrationTab === tab ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-slate-950/70 text-slate-200 hover:border-cyan-400/40'}`}
                    >
                      {tab === 'topology' ? <ListChecks size={15} /> : tab === 'logs' ? <Activity size={15} /> : tab === 'flow' ? <FileCode2 size={15} /> : <MessageSquareText size={15} />}
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {orchestrationTab === 'topology' && (
                <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span className="flex items-center gap-2"><Workflow size={16} className="text-cyan-300" /> Kestra Plugins Used</span>
                      <span className="text-xs text-slate-500">{flowDefinition?.plugin_tasks?.length || 0} plugin tasks</span>
                    </div>
                    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                      {(flowDefinition?.plugin_tasks || []).map((task) => (
                        <div key={`${task.id}-${task.type}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-sm font-medium text-white">{task.id}</div>
                          <div className="mt-1 break-words font-mono text-xs text-cyan-200">{task.type}</div>
                          {task.subflow && <div className="mt-2 text-xs text-slate-400">Subflow: {task.subflow}</div>}
                        </div>
                      ))}
                      {!flowDefinition?.plugin_tasks?.length && <div className="text-sm text-slate-500">Flow definition not loaded yet.</div>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <span className="flex items-center gap-2"><GitBranch size={16} className="text-fuchsia-300" /> Execution Task Runs</span>
                      <span className={`rounded-full border px-3 py-1 text-xs ${executionStatusTone(kestraExecution?.state)}`}>{kestraExecution?.state || 'not loaded'}</span>
                    </div>
                    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                      {(kestraExecution?.task_runs || []).map((task) => (
                        <div key={task.id || `${task.task_id}-${task.value || ''}`} className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1fr_auto]">
                          <div className="min-w-0">
                            <div className="break-words text-sm font-medium text-white">{task.task_id}{task.value ? ` / ${task.value}` : ''}</div>
                            <div className="mt-1 text-xs text-slate-500">{task.duration || 'duration pending'}</div>
                          </div>
                          <span className={`h-fit rounded-full border px-3 py-1 text-xs ${executionStatusTone(task.state)}`}>{task.state || 'pending'}</span>
                        </div>
                      ))}
                      {!kestraExecution?.task_runs?.length && <div className="text-sm text-slate-500">Start or select a run to load execution tasks.</div>}
                    </div>
                  </div>
                </div>
              )}

              {orchestrationTab === 'logs' && (
                <div className="mt-4 max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  {(kestraExecution?.logs || []).length ? (
                    kestraExecution?.logs?.map((log, index) => (
                      <div key={`${log.timestamp}-${index}`} className="mb-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 font-mono text-xs leading-5 text-slate-300">
                        <span className="text-slate-500">{formatTime(log.timestamp)}</span> <span className="text-cyan-200">{log.level}</span> <span className="text-amber-200">{log.task_id || '-'}</span> {log.message}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No Kestra logs loaded yet. Use Sync after starting a run.</div>
                  )}
                </div>
              )}

              {orchestrationTab === 'flow' && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                    <span>{flowDefinition?.namespace || 'system.autopr'} / {flowDefinition?.flow_id || 'autopr_main_flow'}</span>
                    <button
                      type="button"
                      onClick={() => void copyText('Kestra flow definition', flowDefinition?.source_text)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-400/40"
                    >
                      <Copy size={14} /> Copy Flow
                    </button>
                  </div>
                  <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-slate-200">
{flowDefinition?.source_text || 'Flow definition not loaded yet.'}
                  </pre>
                </div>
              )}

              {orchestrationTab === 'outputs' && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {currentGeneratedPosts ? Object.entries(currentGeneratedPosts).map(([platform, content]) => {
                    const status = currentDelivery?.[platform] || 'draft_generated';
                    return (
                      <div key={platform} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium text-white">{platformMeta[platform as keyof typeof platformMeta]?.label || platform}</div>
                            <div className="mt-1 text-xs text-slate-400">{deliveryMeaning(status)}</div>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-xs ${executionStatusTone(status)}`}>{status}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyText(`${platform} output`, content)}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100 transition hover:bg-cyan-400/20"
                        >
                          <Copy size={14} /> Copy Equivalent Post
                        </button>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-500">Generated platform outputs will appear here.</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Recent Runs</h2>
                    <p className="text-sm text-slate-400">Select a run to inspect its saved output and execution id.</p>
                  </div>
                  <button onClick={() => { void fetchRuns(); }} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:bg-slate-950">
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>

                <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
                  {runs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-500">Runs will appear here after previews or Kestra triggers.</div>
                  ) : (
                    runs.map((run) => {
                      const runId = run.run_id || run.id || 'unknown';
                      const isSelected = selectedRunId === runId;
                      return (
                        <button
                          key={runId}
                          type="button"
                          onClick={() => void loadRunDetails(runId)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-white/10 bg-slate-950/60 hover:border-white/20 hover:bg-slate-950'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                <Workflow size={15} className="text-cyan-300" /> {runId}
                              </div>
                              <div className="text-xs text-slate-500">{run.input_source || run.source || 'unknown source'} • {formatTime(run.updated_at || run.timestamp)}</div>
                              <div className="line-clamp-1 text-sm text-slate-300">{typeof run.payload?.raw_update === 'string' ? run.payload.raw_update : run.project || 'No summary available.'}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-xs text-slate-400">
                              <span className={`rounded-full px-2 py-1 ${run.status === 'running' ? 'bg-amber-400/10 text-amber-100' : run.status === 'failed' ? 'bg-rose-400/10 text-rose-100' : 'bg-emerald-400/10 text-emerald-100'}`}>
                                {run.status || 'unknown'}
                              </span>
                              <span className="font-mono text-[11px]">{run.kestra_execution_id || 'no execution id'}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Local Delivery Files</h2>
                    <p className="text-sm text-slate-400">These are saved from dry runs or live adapter handoffs.</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">{posts.length} files</span>
                </div>

                <div className="mt-4 max-h-[420px] space-y-3 overflow-auto pr-1">
                  {posts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-500">No delivery files yet. Run a dry run to persist platform payloads.</div>
                  ) : (
                    posts.map((post) => (
                      <div key={`${post.run_id}-${post.platform}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-white">
                            <span className="rounded-full border border-white/10 px-2 py-1 text-xs uppercase text-cyan-200">{post.platform}</span>
                            <span className="text-xs text-slate-500">{post.run_id}</span>
                          </div>
                          <span className="text-xs text-slate-500">{formatTime(post.timestamp)}</span>
                        </div>
                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">{post.content}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{post.status} • {deliveryMeaning(post.status)}</span>
                          <span>{post.dry_run ? 'dry_run=true' : 'dry_run=false'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyText(`${post.platform} saved output`, post.content)}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-400/40"
                        >
                          <Copy size={14} /> Copy
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-slate-400 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              AutoPR Engine now exposes real repo fetching, commit-first content generation, public relations routing, LinkedIn style analysis, preview generation, and Kestra execution visibility.
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 size={16} className="text-emerald-300" />
              Dry run defaults on; live delivery requires a webhook adapter.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ActionCard({ title, state, icon: Icon }: { title: string; state: ActionState; icon: React.ComponentType<{ size?: number; className?: string }>; }) {
  return (
    <div className={`rounded-2xl border p-3 ${statusTone(state.phase)}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {state.phase === 'loading' ? <Loader2 size={15} className="animate-spin" /> : state.phase === 'success' ? <CheckCircle2 size={15} /> : state.phase === 'error' ? <XCircle size={15} /> : <Icon size={15} />}
        {title}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-300">{state.message}</div>
      {state.detail && <div className="mt-2 text-xs leading-5 text-slate-400">{state.detail}</div>}
      {state.executionId && <div className="mt-2 font-mono text-[11px] text-cyan-200">{state.executionId}</div>}
    </div>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[75%] text-right text-slate-100">{value}</span>
    </div>
  );
}

export default App;
