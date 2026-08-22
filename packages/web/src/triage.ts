import {
  analyze,
  DEFAULT_CONFIG,
  MERGEWARDEN_VERSION,
  parseContractFromPrBody,
  partitionUniformTriageNotes,
  type AnalysisInput,
} from "@mergewarden/core";
import {
  FetchGitHubApi,
  parseRepositoryTarget,
  type RemoteOpenPullRequest,
  type RemotePullRequest,
  type RepositoryLocator,
} from "@mergewarden/github";

const LIST_LIMIT = 30;
const DETAIL_LIMIT = 10;
const DETAIL_BATCH_SIZE = 3;
const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const FIRST_CONTRIBUTION_ASSOCIATIONS = new Set(["FIRST_TIME_CONTRIBUTOR", "FIRST_TIMER", "NONE"]);
const TEMPLATE_PATHS = [
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/pull_request_template.md",
  "PULL_REQUEST_TEMPLATE.md",
];
const READINESS_RULES = [
  ["triage/no-linked-issue", "no linked issue"],
  ["triage/empty-description", "thin description"],
  ["triage/template-unused", "template unused"],
  ["triage/oversized-change", "oversized"],
] as const;

type PublicTriageApi = Pick<
  FetchGitHubApi,
  "listOpenPullRequests" | "getPullRequest" | "getTextFile"
>;

export interface TriageDependencies {
  api?: PublicTriageApi;
  now?: () => string;
}

export interface PublicTriageRow {
  number: number;
  title: string;
  author: string;
  authorAssociation?: string;
  firstContribution: boolean;
  filesChanged: number;
  linesChanged: number;
  updatedAt: string;
  htmlUrl: string;
  notes: string[];
}

export interface PublicTriageResult {
  target: RepositoryLocator;
  openPullRequests: number;
  externalPullRequests: number;
  trustedPullRequests: number;
  automationPullRequests: number;
  unreadablePullRequests: number[];
  analysisComplete: boolean;
  uniformNotes: string[];
  rows: PublicTriageRow[];
}

async function loadTemplate(
  api: PublicTriageApi,
  pull: RemotePullRequest,
): Promise<string | null | undefined> {
  for (const path of TEMPLATE_PATHS) {
    try {
      const result = await api.getTextFile(pull.base.repository, path, pull.base.sha);
      if (result.kind === "found") {
        return result.text;
      }
    } catch {
      return undefined;
    }
  }

  return null;
}

function analysisInput(
  pull: RemotePullRequest,
  template: string | null | undefined,
  now: string,
): AnalysisInput {
  const config = structuredClone(DEFAULT_CONFIG);
  config.triage.no_linked_issue = "info";

  return {
    repo: {
      owner: pull.base.repository.owner,
      repo: pull.base.repository.repo,
      defaultBranch: pull.base.repository.defaultBranch ?? pull.base.ref,
      baseRef: pull.base.ref,
      baseSha: pull.base.sha,
      headRef: pull.head.ref,
      headSha: pull.head.sha,
    },
    pr: {
      number: pull.number,
      title: pull.title,
      body: pull.body,
      author: pull.author,
      labels: pull.labels,
      branchName: pull.head.ref,
      isFork: pull.head.fork,
      draft: pull.draft,
      ...(pull.authorAssociation ? { authorAssociation: pull.authorAssociation } : {}),
    },
    config,
    contract: parseContractFromPrBody(pull.body),
    changes: {
      files: [],
      totals: {
        filesChanged: pull.changedFiles,
        additions: pull.additions ?? 0,
        deletions: pull.deletions ?? 0,
      },
    },
    reviews: [],
    checks: [],
    ...(template === undefined ? {} : { repoDocs: { pullRequestTemplate: template } }),
    now,
    configSource: "default",
    version: MERGEWARDEN_VERSION,
  };
}

function isTrusted(pull: RemoteOpenPullRequest): boolean {
  return TRUSTED_ASSOCIATIONS.has((pull.authorAssociation ?? "").toUpperCase());
}

export async function triagePublicRepository(
  value: string,
  dependencies: TriageDependencies = {},
): Promise<PublicTriageResult> {
  const target = parseRepositoryTarget(value.trim());
  const api = dependencies.api ?? new FetchGitHubApi();
  const summaries = await api.listOpenPullRequests(target, LIST_LIMIT);
  const excludedAuthors = new Set(
    DEFAULT_CONFIG.triage.exclude_authors.map((author) => author.toLowerCase()),
  );
  const external: RemoteOpenPullRequest[] = [];
  let trustedPullRequests = 0;
  let automationPullRequests = 0;

  for (const pull of summaries) {
    if (excludedAuthors.has(pull.author.toLowerCase())) {
      automationPullRequests += 1;
    } else if (isTrusted(pull)) {
      trustedPullRequests += 1;
    } else {
      external.push(pull);
    }
  }

  const detailed: Array<{ summary: RemoteOpenPullRequest; pull: RemotePullRequest }> = [];
  const unreadablePullRequests: number[] = [];
  const selected = external.slice(0, DETAIL_LIMIT);

  for (let index = 0; index < selected.length; index += DETAIL_BATCH_SIZE) {
    const batch = selected.slice(index, index + DETAIL_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((pull) =>
        api.getPullRequest({ owner: target.owner, repo: target.repo, number: pull.number }),
      ),
    );

    for (const [resultIndex, result] of results.entries()) {
      const summary = batch[resultIndex];
      if (!summary) {
        continue;
      }
      if (result.status === "fulfilled") {
        detailed.push({ summary, pull: result.value });
      } else {
        unreadablePullRequests.push(summary.number);
      }
    }
  }

  const template = detailed[0] ? await loadTemplate(api, detailed[0].pull) : undefined;
  const now = (dependencies.now ?? (() => new Date().toISOString()))();
  const rows: PublicTriageRow[] = [];

  for (const { summary, pull } of detailed) {
    const result = await analyze(analysisInput(pull, template, now));
    const findingIds = new Set(result.findings.map((finding) => finding.ruleId));
    const association = pull.authorAssociation ?? summary.authorAssociation;
    rows.push({
      number: pull.number,
      title: pull.title,
      author: pull.author,
      ...(association ? { authorAssociation: association } : {}),
      firstContribution: FIRST_CONTRIBUTION_ASSOCIATIONS.has((association ?? "").toUpperCase()),
      filesChanged: pull.changedFiles,
      linesChanged: (pull.additions ?? 0) + (pull.deletions ?? 0),
      updatedAt: pull.updatedAt ?? summary.updatedAt,
      htmlUrl: pull.htmlUrl ?? summary.htmlUrl,
      notes: READINESS_RULES.filter(([ruleId]) => findingIds.has(ruleId)).map(([, label]) => label),
    });
  }

  const partitioned = partitionUniformTriageNotes(rows);
  partitioned.rows.sort((left, right) => right.notes.length - left.notes.length);

  return {
    target,
    openPullRequests: summaries.length,
    externalPullRequests: external.length,
    trustedPullRequests,
    automationPullRequests,
    unreadablePullRequests,
    analysisComplete: unreadablePullRequests.length === 0,
    uniformNotes: partitioned.uniform,
    rows: partitioned.rows,
  };
}
