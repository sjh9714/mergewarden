import { describe, expect, it, vi } from "vitest";

import { analyze, type AnalysisResult } from "@mergewarden/core";
import { loadGitHubAnalysis, type GitHubApi, type RemotePullRequest } from "@mergewarden/github";
import { runCli, type CliDependencies } from "../../cli/src/cli.js";
import { runAction, type ActionContext, type ActionSummary, type OctokitLike } from "../src/run.js";

const BASE_SHA = "base-sha";
const HEAD_SHA = "head-sha";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const POLICY = "version: 1\nmode: block\n";
const BASE_WORKFLOW = `name: CI
'on': pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps: []
`;
const HEAD_WORKFLOW = BASE_WORKFLOW.replace("contents: read", "contents: write");

const remotePullRequest: RemotePullRequest = {
  number: 17,
  title: "Expand workflow permission",
  body: "",
  author: "octocat",
  labels: [],
  draft: false,
  changedFiles: 1,
  head: {
    ref: "agent/change",
    sha: HEAD_SHA,
    repository: { owner: "owner", repo: "project", defaultBranch: "main" },
    fork: false,
  },
  base: {
    ref: "main",
    sha: BASE_SHA,
    repository: { owner: "owner", repo: "project", defaultBranch: "main" },
  },
};

function content(path: string, sha: string): string {
  if (path === "mergewarden.yml" && sha === BASE_SHA) {
    return POLICY;
  }

  if (path === WORKFLOW_PATH && sha === BASE_SHA) {
    return BASE_WORKFLOW;
  }

  if (path === WORKFLOW_PATH && sha === HEAD_SHA) {
    return HEAD_WORKFLOW;
  }

  throw new Error(`Unexpected content request: ${path}@${sha}`);
}

function actionOctokit(): OctokitLike {
  return {
    rest: {
      pulls: {
        listFiles: vi.fn(async () => ({
          data: [
            {
              filename: WORKFLOW_PATH,
              status: "modified",
              additions: 1,
              deletions: 1,
            },
          ],
        })),
      },
      repos: {
        getContent: vi.fn(async (args: { path: string; ref: string }) => ({
          data: {
            type: "file",
            encoding: "base64",
            content: Buffer.from(content(args.path, args.ref), "utf8").toString("base64"),
          },
        })),
      },
    },
  };
}

function cliApi(): GitHubApi {
  return {
    async getPullRequest() {
      return remotePullRequest;
    },
    async listPullRequestFilesPage() {
      return [
        {
          filename: WORKFLOW_PATH,
          status: "modified",
          additions: 1,
          deletions: 1,
        },
      ];
    },
    async getTextFile(_repository, path, sha) {
      return { kind: "found", text: content(path, sha) };
    },
  };
}

function publicContract(result: AnalysisResult) {
  return {
    decision: result.decision,
    status: result.status,
    findings: result.findings.map(({ findingId, ruleId, severity }) => ({
      findingId,
      ruleId,
      severity,
    })),
  };
}

describe("Action and CLI analysis contract", () => {
  it("returns identical finding identities, severities, decision, and status for one PR", async () => {
    const summary: ActionSummary = {
      addRaw() {
        return summary;
      },
      async write() {},
    };
    const actionContext: ActionContext = {
      eventName: "pull_request",
      repo: { owner: "owner", repo: "project" },
      payload: {
        pull_request: {
          number: remotePullRequest.number,
          title: remotePullRequest.title,
          body: remotePullRequest.body,
          changed_files: remotePullRequest.changedFiles,
          user: { login: remotePullRequest.author },
          labels: [],
          draft: false,
          head: {
            ref: remotePullRequest.head.ref,
            sha: remotePullRequest.head.sha,
            repo: {
              full_name: "owner/project",
              name: "project",
              owner: { login: "owner" },
              fork: false,
              default_branch: "main",
            },
          },
          base: {
            ref: remotePullRequest.base.ref,
            sha: remotePullRequest.base.sha,
            repo: {
              full_name: "owner/project",
              name: "project",
              owner: { login: "owner" },
              default_branch: "main",
            },
          },
        },
      },
    };
    const actionResult = await runAction({
      context: actionContext,
      octokit: actionOctokit(),
      getInput: (name) => (name === "fail-on-block" ? "false" : ""),
      setOutput: () => undefined,
      setFailed: () => undefined,
      info: () => undefined,
      notice: () => undefined,
      warning: () => undefined,
      summary,
      writeFile: async () => undefined,
      now: () => new Date("2026-07-10T00:00:00.000Z"),
    });

    const stdout: string[] = [];
    const cliDependencies: CliDependencies = {
      createGitHubApi: () => cliApi(),
      loadGitHubAnalysis,
      analyze,
      now: () => "2026-07-10T00:00:00.000Z",
      environment: { GH_TOKEN: "test-token" },
    };
    const cliExit = await runCli(
      ["scan", "owner/project#17", "--format", "json"],
      {
        stdout: (text) => stdout.push(text),
        stderr: () => undefined,
      },
      cliDependencies,
    );
    const cliResult = JSON.parse(stdout.join("")) as AnalysisResult;

    expect(actionResult).toBeDefined();
    expect(cliExit).toBe(1);
    expect(publicContract(cliResult)).toEqual(publicContract(actionResult!));
  });
});
