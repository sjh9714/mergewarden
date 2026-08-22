import {
  analyze as analyzeInput,
  MERGEWARDEN_VERSION,
  type AnalysisResult,
} from "@mergewarden/core";
import {
  FetchGitHubApi,
  loadGitHubAnalysis,
  parsePullRequestTarget,
  type GitHubAnalysisInput,
  type GitHubApi,
  type PullRequestLocator,
} from "@mergewarden/github";

interface ScanDependencies {
  createApi: () => GitHubApi;
  load: typeof loadGitHubAnalysis;
  analyze: typeof analyzeInput;
  now: () => string;
}

export interface PublicScanResult {
  target: PullRequestLocator;
  input: GitHubAnalysisInput;
  result: AnalysisResult;
}

const defaultDependencies: ScanDependencies = {
  createApi: () => new FetchGitHubApi(),
  load: loadGitHubAnalysis,
  analyze: analyzeInput,
  now: () => new Date().toISOString(),
};

export async function scanPublicPullRequest(
  value: string,
  dependencies: ScanDependencies = defaultDependencies,
): Promise<PublicScanResult> {
  const target = parsePullRequestTarget(value.trim());
  const input = await dependencies.load(dependencies.createApi(), target, {
    configPath: "mergewarden.yml",
    now: dependencies.now(),
    engineVersion: MERGEWARDEN_VERSION,
    runtimeRef: `mergewarden-web@${MERGEWARDEN_VERSION}`,
    retry: { maxAttempts: 1, maxTotalDelayMs: 0 },
  });

  return { target, input, result: await dependencies.analyze(input) };
}
