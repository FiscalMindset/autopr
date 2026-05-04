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
  GitBranch,
  GitCommitVertical,
  GitPullRequest,
  Globe2,
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

type ActionPhase = 'idle' | 'loading' | 'success' | 'error';

type ActionState = {
  phase: ActionPhase;
  message: string;
  detail?: string;
  executionId?: string;
};

type WorkflowPayload = {
  source: 'github_commit' | 'github_pr' | 'manual' | 'github_webhook';
  project: string;
  raw_update?: string;
  author: string;
  goal: string;
  dry_run: boolean;
  selected_repo?: RepoItem;
  selected_commit?: CommitItem;
  selected_pr?: PullRequestItem;
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
  repos: { phase: 'idle', message: 'Awaiting GitHub credentials.' },
  commits: { phase: 'idle', message: 'Select a repository to fetch commits.' },
  prs: { phase: 'idle', message: 'Select a repository to fetch pull requests.' },
  style: { phase: 'idle', message: 'Paste LinkedIn samples to analyze style.' },
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
  const [githubUsername, setGitHubUsername] = useState('');
  const [githubToken, setGitHubToken] = useState('');
  const [author, setAuthor] = useState('Vicky Kumar');
  const [project, setProject] = useState('autopr-engine');
  const [rawUpdate, setRawUpdate] = useState('');
  const [goal, setGoal] = useState('build_in_public');
  const [inputSource, setInputSource] = useState<'github_commit' | 'github_pr' | 'manual'>('github_commit');
  const [dryRun, setDryRun] = useState(true);
  const [useStyleProfile, setUseStyleProfile] = useState(true);
  const [deliveryWebhookUrl, setDeliveryWebhookUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<keyof GeneratedPosts>('linkedin');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [actions, setActions] = useState(actionDefaults);

  const api = useMemo(() => axios.create({ baseURL: API_URL, timeout: 45000 }), []);

  const activePreview = preview;
  const currentGeneratedPosts = activePreview?.generated_posts;
  const currentRouting = activePreview?.routing_decision;
  const currentDelivery = activePreview?.delivery_status;
  const currentLogs = activePreview?.logs || [];
  const currentTimeline = activePreview?.execution_timeline || [];
  const currentExecutionId = activePreview?.kestra_execution_id;
  const currentRunId = activePreview?.run_id || selectedRunId;

  const metrics = useMemo(() => {
    const platformCount = currentRouting?.platforms?.length ?? 0;
    const deliveryCount = Object.values(currentDelivery || {}).filter((value) => value.includes('dry_run') || value.includes('live') || value.includes('sent')).length;
    return [
      { label: 'Repositories', value: repos.length.toString(), tone: 'from-cyan-400 to-sky-500' },
      { label: 'Commits', value: commits.length.toString(), tone: 'from-emerald-400 to-lime-500' },
      { label: 'PRs', value: pullRequests.length.toString(), tone: 'from-fuchsia-400 to-rose-500' },
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

  const buildWorkflowPayload = (overrides: Partial<WorkflowPayload> = {}): WorkflowPayload => ({
    source: overrides.source ?? (inputSource === 'github_pr' ? 'github_pr' : inputSource === 'github_commit' ? 'github_commit' : 'manual'),
    project: overrides.project ?? selectedRepo?.full_name ?? project,
    raw_update: overrides.raw_update ?? rawUpdate.trim() ?? selectedCommit?.message ?? selectedPr?.title ?? '',
    author: overrides.author ?? author,
    goal: overrides.goal ?? goal,
    dry_run: overrides.dry_run ?? dryRun,
    selected_repo: overrides.selected_repo ?? selectedRepo ?? undefined,
    selected_commit: overrides.selected_commit ?? selectedCommit ?? undefined,
    selected_pr: overrides.selected_pr ?? selectedPr ?? undefined,
    github_username: overrides.github_username ?? (githubUsername || undefined),
    github_token: overrides.github_token ?? (githubToken || undefined),
    github_context: overrides.github_context ?? {
      repo_count: repos.length,
      commit_count: commits.length,
      pr_count: pullRequests.length,
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

  useEffect(() => {
    void fetchRuns();
    void fetchPosts();
    const interval = window.setInterval(() => {
      void fetchRuns();
      void fetchPosts();
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  const fetchRepos = async () => {
    if (!githubUsername.trim()) {
      setAction('repos', { phase: 'error', message: 'Enter a GitHub username first.' });
      return;
    }

    setAction('repos', { phase: 'loading', message: 'POST /api/github/fetch-repos', detail: 'Fetching repositories from GitHub.' });
    try {
      const response = await api.post('/github/fetch-repos', {
        username: githubUsername.trim(),
        token: githubToken.trim() || undefined,
        include_forks: true,
        include_private: true,
      });
      setRepos(response.data.items || []);
      setSelectedRepo((previous) => previous ?? response.data.items?.[0] ?? null);
      setProject(response.data.items?.[0]?.full_name || project);
      setAction('repos', {
        phase: 'success',
        message: response.data.message || `Loaded ${response.data.items?.length || 0} repositories.`,
        detail: response.data.auth_mode ? `Auth mode: ${response.data.auth_mode}` : undefined,
      });
    } catch (error) {
      setAction('repos', { phase: 'error', message: 'GitHub repositories could not be fetched.', detail: errorMessage(error) });
    }
  };

  const fetchCommits = async () => {
    if (!selectedRepo) {
      setAction('commits', { phase: 'error', message: 'Select a repository before fetching commits.' });
      return;
    }

    setAction('commits', { phase: 'loading', message: 'POST /api/github/fetch-commits', detail: `Loading commits for ${selectedRepo.full_name}.` });
    try {
      const response = await api.post('/github/fetch-commits', {
        owner: selectedRepo.owner?.login || githubUsername || selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        token: githubToken.trim() || undefined,
      });
      setCommits(response.data.items || []);
      setSelectedCommit((previous) => previous ?? response.data.items?.[0] ?? null);
      if (response.data.items?.[0]?.message) {
        setRawUpdate(response.data.items[0].message);
      }
      setAction('commits', { phase: 'success', message: response.data.message || `Loaded ${response.data.items?.length || 0} commits.` });
    } catch (error) {
      setAction('commits', { phase: 'error', message: 'Commit fetch failed.', detail: errorMessage(error) });
    }
  };

  const fetchPullRequests = async () => {
    if (!selectedRepo) {
      setAction('prs', { phase: 'error', message: 'Select a repository before fetching PRs.' });
      return;
    }

    setAction('prs', { phase: 'loading', message: 'POST /api/github/fetch-prs', detail: `Loading pull requests for ${selectedRepo.full_name}.` });
    try {
      const response = await api.post('/github/fetch-prs', {
        owner: selectedRepo.owner?.login || githubUsername || selectedRepo.full_name.split('/')[0],
        repo: selectedRepo.name,
        token: githubToken.trim() || undefined,
      });
      setPullRequests(response.data.items || []);
      setSelectedPr((previous) => previous ?? response.data.items?.[0] ?? null);
      if (!rawUpdate.trim() && response.data.items?.[0]?.title) {
        setRawUpdate(response.data.items[0].title);
      }
      setAction('prs', { phase: 'success', message: response.data.message || `Loaded ${response.data.items?.length || 0} PRs.` });
    } catch (error) {
      setAction('prs', { phase: 'error', message: 'Pull request fetch failed.', detail: errorMessage(error) });
    }
  };

  const analyzeStyle = async () => {
    const samples = splitSamples(styleSamples);
    if (samples.length === 0) {
      setAction('style', { phase: 'error', message: 'Add at least one sample LinkedIn post.' });
      return;
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
    } catch (error) {
      setAction('style', { phase: 'error', message: 'Style analysis failed.', detail: errorMessage(error) });
    }
  };

  const generatePreview = async () => {
    const workflowPayload = buildWorkflowPayload();
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
      await fetchRuns();
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Preview generation failed.', detail: errorMessage(error) });
    }
  };

  const triggerKestra = async (dryRunOverride?: boolean) => {
    const nextDryRun = typeof dryRunOverride === 'boolean' ? dryRunOverride : dryRun;
    const workflowPayload = buildWorkflowPayload({ dry_run: nextDryRun, run_id: activePreview?.run_id || preview?.run_id });
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
      await fetchRuns();
    } catch (error) {
      const message = errorMessage(error);
      setAction(statusKey, { phase: 'error', message: nextDryRun ? 'Dry-run delivery failed.' : 'Live delivery failed.', detail: message });
      setAction('kestra', { phase: 'error', message: 'Kestra could not be triggered.', detail: message });
    }
  };

  const loadRunDetails = async (runId: string) => {
    try {
      const response = await api.get(`/runs/${runId}`);
      setPreview(response.data as RunRecord);
      setSelectedRunId(runId);
      setSelectedPlatform((response.data.generated_posts && Object.keys(response.data.generated_posts)[0]) as keyof GeneratedPosts || 'linkedin');
      if (response.data.generated_posts?.linkedin) {
        setRawUpdate(response.data.payload?.raw_update as string || rawUpdate);
      }
    } catch (error) {
      setAction('preview', { phase: 'error', message: 'Could not load run details.', detail: errorMessage(error) });
    }
  };

  const selectedPlatformContent = currentGeneratedPosts?.[selectedPlatform] || '';

  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100">
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
                  AI Content Orchestration & Distribution System. Pull real GitHub repos, inspect commits and pull requests,
                  analyze LinkedIn style, preview platform content, and push the workflow through Kestra with full visibility.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px] xl:grid-cols-1">
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
                  <p className="text-sm text-slate-400">Fetch real repos, commits, and pull requests through the backend proxy.</p>
                </div>
                  <button onClick={fetchRepos} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">
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
                  <span className="text-slate-300">Goal</span>
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
                    <option value="github_pr">GitHub PR</option>
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
                              <span className="rounded-full border border-white/10 px-2 py-1">PRs {repo.open_issues_count ?? 0}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3">
                    <button onClick={fetchCommits} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-slate-950">
                      <span className="flex items-center gap-2 text-sm text-white">
                        {actions.commits.phase === 'loading' ? <Loader2 size={16} className="animate-spin text-cyan-300" /> : <GitCommitVertical size={16} className="text-cyan-300" />}
                        Fetch Commits
                      </span>
                      <span className="text-xs text-slate-500">{selectedRepo?.full_name || 'select repo'}</span>
                    </button>
                    <button onClick={fetchPullRequests} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-left transition hover:border-fuchsia-400/40 hover:bg-slate-950">
                      <span className="flex items-center gap-2 text-sm text-white">
                        {actions.prs.phase === 'loading' ? <Loader2 size={16} className="animate-spin text-fuchsia-300" /> : <GitPullRequest size={16} className="text-fuchsia-300" />}
                        Fetch PRs
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
                      <span className="flex items-center gap-2 font-medium"><GitPullRequest size={15} className="text-fuchsia-300" /> Latest PRs</span>
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
                              setRawUpdate(pr.title);
                              setInputSource('github_pr');
                            }}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedPr?.number === pr.number ? 'border-fuchsia-400/40 bg-fuchsia-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs text-fuchsia-200">PR #{pr.number}</span>
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
                <ActionCard title="Fetch Repos" state={actions.repos} icon={GitBranch} />
                <ActionCard title="Fetch Commits" state={actions.commits} icon={GitCommitVertical} />
                <ActionCard title="Fetch PRs" state={actions.prs} icon={GitPullRequest} />
                <ActionCard title="Kestra Trigger" state={actions.kestra} icon={Workflow} />
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">LinkedIn Style Analyzer</h2>
                  <p className="text-sm text-slate-400">Paste one or more sample posts and reuse the resulting profile for generation.</p>
                </div>
                <button onClick={analyzeStyle} className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-4 py-2 text-sm font-medium text-fuchsia-100 transition hover:bg-fuchsia-400/20">
                  {actions.style.phase === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  Analyze Style
                </button>
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
                    placeholder="Paste a commit message, PR summary, or a manual update."
                  />
                </label>

                <div className="space-y-3">
                  <ActionCard title="Generate Content" state={actions.preview} icon={Sparkles} />
                  <ActionCard title="Dry Run Delivery" state={actions.dryRun} icon={Send} />
                  <ActionCard title="Live Delivery" state={actions.live} icon={Globe2} />
                  <button onClick={generatePreview} className="w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/20">
                    Generate Content
                  </button>
                  <button onClick={() => triggerKestra(true)} className="w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20">
                    Trigger Kestra Workflow
                  </button>
                  <button onClick={() => triggerKestra(true)} className="w-full rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-400/20">
                    Dry Run Delivery
                  </button>
                  <button onClick={() => triggerKestra(false)} className="w-full rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-400/20">
                    Live Delivery
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
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{selectedPlatformContent.length} chars</span>
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
                          <span>{post.status}</span>
                          <span>{post.dry_run ? 'dry_run=true' : 'dry_run=false'}</span>
                        </div>
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
              AutoPR Engine now exposes real repo fetching, commit and PR selection, LinkedIn style analysis, preview generation, and Kestra execution visibility.
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
