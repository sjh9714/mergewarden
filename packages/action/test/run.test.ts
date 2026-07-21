import { describe, expect, it, vi } from "vitest";

import {
  runAction,
  type ActionContext,
  type ActionRuntime,
  type OctokitLike,
  type PullFile,
} from "../src/run.js";
import { writeTextFile } from "../src/fileWriter.js";
import { MERGEWARDEN_VERSION } from "../src/version.js";

const BASE_SHA = "base-sha";
const HEAD_SHA = "head-sha";

function encodeContent(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

function contentResponse(text: string) {
  return {
    data: {
      type: "file",
      encoding: "base64",
      content: encodeContent(text),
    },
  };
}

function githubApiError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function validContractBody() {
  return [
    "<!-- mergewarden-contract",
    "version: 1",
    "agent: codex",
    "task: workflow hardening",
    "allowed_paths:",
    '  - ".github/workflows/**"',
    "-->",
  ].join("\n");
}

function prContext(
  overrides: Partial<ActionContext["payload"]["pull_request"]> = {},
): ActionContext {
  return {
    eventName: "pull_request",
    repo: {
      owner: "sjh9714",
      repo: "mergewarden",
    },
    payload: {
      pull_request: {
        number: 5,
        title: "Tighten workflow permissions",
        body: validContractBody(),
        changed_files: 1,
        user: {
          login: "codex",
        },
        labels: [{ name: "ai" }],
        draft: false,
        head: {
          ref: "codex/workflow",
          sha: HEAD_SHA,
          repo: {
            fork: false,
          },
        },
        base: {
          ref: "main",
          sha: BASE_SHA,
          repo: {
            default_branch: "main",
          },
        },
        ...overrides,
      },
    },
  };
}

function workflowFile(overrides: Partial<PullFile> = {}): PullFile {
  return {
    filename: ".github/workflows/release.yml",
    status: "modified",
    additions: 8,
    deletions: 1,
    patch: "",
    ...overrides,
  };
}

interface IssueComment {
  id: number;
  body?: string | null;
  user?: {
    login?: string | null;
    type?: string | null;
  } | null;
  performed_via_github_app?: {
    slug?: string | null;
  } | null;
}

interface TestOctokit extends OctokitLike {
  readonly changedFileCount: number;
}

function createOctokit(options: {
  files?: PullFile[];
  contents?: Record<string, string>;
  rawContents?: Record<string, unknown>;
  errors?: Record<string, unknown>;
  comments?: IssueComment[];
  commentErrors?: {
    list?: Error;
    create?: Error;
    update?: Error;
  };
}): TestOctokit {
  const files = options.files ?? [];
  const contents = options.contents ?? {};
  const rawContents = options.rawContents ?? {};
  const errors = options.errors ?? {};
  const comments = options.comments ?? [];
  const commentErrors = options.commentErrors ?? {};

  const listFiles = vi.fn(async () => ({ data: files }));
  const getPullRequest = vi.fn(async () => ({ data: { changed_files: files.length } }));
  const getContent = vi.fn(async ({ path, ref }: { path: string; ref: string }) => {
    const key = `${ref}:${path}`;

    if (errors[key]) {
      throw errors[key];
    }

    if (key in rawContents) {
      return { data: rawContents[key] };
    }

    const content = contents[key];

    if (content === undefined) {
      throw new Error(`missing ${key}`);
    }

    return contentResponse(content);
  });

  const listComments = vi.fn(async () => {
    if (commentErrors.list) {
      throw commentErrors.list;
    }

    return { data: comments };
  });
  const createComment = vi.fn(async () => {
    if (commentErrors.create) {
      throw commentErrors.create;
    }

    return { data: {} };
  });
  const updateComment = vi.fn(async () => {
    if (commentErrors.update) {
      throw commentErrors.update;
    }

    return { data: {} };
  });

  return {
    changedFileCount: files.length,
    paginate: vi.fn(async (method, args) => {
      const response = await method(args);
      return response.data;
    }),
    rest: {
      pulls: {
        get: getPullRequest,
        listFiles,
      },
      repos: {
        getContent,
      },
      issues: {
        listComments,
        createComment,
        updateComment,
      },
    },
  };
}

function createHarness(
  options: {
    context?: ActionContext;
    octokit?: OctokitLike;
    inputs?: Record<string, string>;
  } = {},
) {
  const inputs = {
    config: "mergewarden.yml",
    mode: "",
    comment: "false",
    "fail-on-block": "true",
    "report-json": "mergewarden-report.json",
    "report-markdown": "mergewarden-report.md",
    "github-token": "token",
    ...options.inputs,
  };
  const outputs = new Map<string, string>();
  const failures: string[] = [];
  const infos: string[] = [];
  const notices: string[] = [];
  const warnings: string[] = [];
  const writtenFiles = new Map<string, string>();
  let summaryText = "";
  const octokit = options.octokit ?? createOctokit({});
  const changedFileCount =
    "changedFileCount" in octokit && typeof octokit.changedFileCount === "number"
      ? octokit.changedFileCount
      : 0;

  const runtime = {
    context: options.context ?? prContext({ changed_files: changedFileCount }),
    octokit,
    getInput: vi.fn((name: string) => inputs[name] ?? ""),
    setOutput: vi.fn((name: string, value: string | number | boolean) => {
      outputs.set(name, String(value));
    }),
    setFailed: vi.fn((message: string | Error) => {
      failures.push(message instanceof Error ? message.message : message);
    }),
    info: vi.fn((message: string) => {
      infos.push(message);
    }),
    notice: vi.fn((message: string) => {
      notices.push(message);
    }),
    warning: vi.fn((message: string) => {
      warnings.push(message);
    }),
    summary: {
      addRaw: vi.fn((content: string) => {
        summaryText += content;
        return runtime.summary;
      }),
      write: vi.fn(async () => undefined),
    },
    writeFile: vi.fn(async (path: string, content: string) => {
      writtenFiles.set(path, content);
    }),
    now: () => new Date("2026-06-13T00:00:00.000Z"),
  } satisfies ActionRuntime & { warning(message: string): void };

  return {
    failures,
    infos,
    notices,
    outputs,
    runtime,
    summaryText: () => summaryText,
    warnings,
    writtenFiles,
  };
}

describe("runAction", () => {
  it("fails clearly outside pull_request events", async () => {
    const harness = createHarness({
      context: {
        eventName: "push",
        repo: { owner: "sjh9714", repo: "mergewarden" },
        payload: {},
      },
    });

    await runAction(harness.runtime);

    expect(harness.failures).toEqual(["MergeWarden can only run on pull_request events."]);
  });

  it("builds analysis input from PR APIs, writes reports, and fails on block by default", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]:
          "version: 1\nmode: block\nagent_detection:\n  labels:\n    - ai\n",
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: read\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: [
          "'on':",
          "  pull_request_target:",
          "permissions:",
          "  contents: write",
          "jobs:",
          "  test:",
          "    steps:",
          "      - uses: actions/checkout@v4",
          "        with:",
          "          ref: ${{ github.event.pull_request.head.sha }}",
        ].join("\n"),
      },
    });
    const harness = createHarness({ octokit });

    const result = await runAction(harness.runtime);

    expect(result?.decision).toBe("block");
    expect(result?.findings.map((finding) => finding.ruleId)).not.toContain("contract/missing");
    expect(result?.findings.map((finding) => finding.ruleId)).not.toContain("contract/invalid");
    expect(harness.outputs.get("decision")).toBe("block");
    expect(harness.outputs.get("status")).toBe("blocked");
    expect(harness.outputs.get("analysis-complete")).toBe("true");
    expect(harness.outputs.get("error-count")).toBe(String(result?.summary.errorCount));
    expect(harness.outputs.get("warning-count")).toBe(String(result?.summary.warnCount));
    expect(harness.outputs.get("info-count")).toBe(String(result?.summary.infoCount));
    expect(harness.outputs.get("waived-count")).toBe("0");
    expect(harness.outputs.get("expected-file-count")).toBe("1");
    expect(harness.outputs.get("analyzed-file-count")).toBe("1");
    expect(harness.outputs.get("risk-score")).toBe(String(result?.riskScore));
    expect(harness.outputs.get("report-json")).toBe("mergewarden-report.json");
    expect(harness.outputs.get("report-markdown")).toBe("mergewarden-report.md");
    const jsonReport = JSON.parse(harness.writtenFiles.get("mergewarden-report.json") ?? "{}");

    expect(jsonReport).toMatchObject({
      decision: "block",
      metadata: {
        configSource: "base-branch",
        version: MERGEWARDEN_VERSION,
      },
    });
    expect(jsonReport.findings[0].findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(harness.writtenFiles.get("mergewarden-report.md")).toContain(
      "workflow/permission-escalation",
    );
    expect(harness.summaryText()).toContain("# MergeWarden: BLOCKED");
    expect(harness.infos.join("\n")).toContain("MergeWarden: BLOCKED");
    expect(harness.infos.join("\n")).toContain("Decision: block");
    expect(harness.infos.join("\n")).not.toContain("Risk score:");
    expect(harness.infos.join("\n")).toContain("Findings:");
    expect(harness.infos.join("\n")).toMatch(
      /- error agf_[0-9a-f]{16} workflow\/permission-escalation \.github\/workflows\/release\.yml/,
    );
    expect(harness.failures).toEqual(["MergeWarden blocked this pull request."]);
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "mergewarden.yml",
        owner: "sjh9714",
        repo: "mergewarden",
        ref: BASE_SHA,
      }),
    );
  });

  it("uses built-in defaults when base-branch config is missing", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: read\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: write\n",
      },
      errors: {
        [`${BASE_SHA}:mergewarden.yml`]: githubApiError(404, "Not Found"),
      },
    });
    const harness = createHarness({ octokit });

    const result = await runAction(harness.runtime);
    const jsonReport = JSON.parse(harness.writtenFiles.get("mergewarden-report.json") ?? "{}");

    expect(result?.metadata.configSource).toBe("default");
    expect(result?.decision).toBe("warn");
    expect(result?.findings.map((finding) => finding.ruleId)).toContain(
      "workflow/permission-escalation",
    );
    expect(jsonReport.metadata.configSource).toBe("default");
    expect(harness.outputs.get("decision")).toBe("warn");
    expect(harness.summaryText()).toContain("# MergeWarden: NEEDS REVIEW");
    expect(harness.summaryText()).toContain("- Policy source: built-in default");
    expect(harness.failures).toEqual([]);
    expect(harness.warnings).toEqual([
      "MergeWarden could not load mergewarden.yml from the base branch; using built-in default policy.",
    ]);
  });

  it("applies mode overrides when using built-in defaults", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: read\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: write\n",
      },
      errors: {
        [`${BASE_SHA}:mergewarden.yml`]: githubApiError(404, "Not Found"),
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        mode: "observe",
      },
    });

    const result = await runAction(harness.runtime);

    expect(result?.metadata.configSource).toBe("default");
    expect(result?.decision).toBe("pass");
    expect(result?.findings.map((finding) => finding.ruleId)).toContain(
      "workflow/permission-escalation",
    );
    expect(harness.outputs.get("decision")).toBe("pass");
    expect(harness.failures).toEqual([]);
    expect(harness.warnings).toEqual([
      "MergeWarden could not load mergewarden.yml from the base branch; using built-in default policy.",
    ]);
  });

  it.each([
    [403, "Forbidden"],
    [429, "Rate limit exceeded"],
    [500, "Internal Server Error"],
  ])("fails fast for config fetch status %s", async (status, message) => {
    const octokit = createOctokit({
      files: [workflowFile()],
      errors: {
        [`${BASE_SHA}:mergewarden.yml`]: githubApiError(status, message),
      },
    });
    const harness = createHarness({ octokit });

    await runAction(harness.runtime);

    expect(harness.failures[0]).toContain(message);
    expect(harness.outputs.size).toBe(0);
    expect(harness.warnings).toEqual([]);
  });

  it("fails fast for config fetch exceptions without a GitHub status", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      errors: {
        [`${BASE_SHA}:mergewarden.yml`]: new Error("network unavailable"),
      },
    });
    const harness = createHarness({ octokit });

    await runAction(harness.runtime);

    expect(harness.failures[0]).toContain("network unavailable");
    expect(harness.outputs.size).toBe(0);
    expect(harness.warnings).toEqual([]);
  });

  it("fails fast when an explicit custom config path is missing", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      errors: {
        [`${BASE_SHA}:.github/agent-gtae.yml`]: githubApiError(404, "Not Found"),
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        config: ".github/agent-gtae.yml",
      },
    });

    await runAction(harness.runtime);

    expect(harness.failures).toEqual([
      `Unable to load .github/agent-gtae.yml from base ref ${BASE_SHA}: config file was not found.`,
    ]);
    expect(harness.outputs.size).toBe(0);
    expect(harness.warnings).toEqual([]);
  });

  it.each([
    ["directory response", []],
    ["non-file response", { type: "dir" }],
    ["non-base64 file response", { type: "file", encoding: "utf-8", content: "version: 1\n" }],
  ])("fails fast for malformed config content: %s", async (_name, data) => {
    const octokit = createOctokit({
      files: [workflowFile()],
      rawContents: {
        [`${BASE_SHA}:mergewarden.yml`]: data,
      },
    });
    const harness = createHarness({ octokit });

    await runAction(harness.runtime);

    expect(harness.failures[0]).toContain("response was not base64 file content");
    expect(harness.outputs.size).toBe(0);
    expect(harness.warnings).toEqual([]);
  });

  it("fails fast for invalid base-branch config instead of falling back", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 2\n",
      },
    });
    const harness = createHarness({ octokit });

    await runAction(harness.runtime);

    expect(harness.failures[0]).toMatch(/Invalid mergewarden\.yml: version/);
    expect(harness.outputs.size).toBe(0);
    expect(harness.warnings).toEqual([]);
  });

  it("does not fetch content for renamed files outside configured analysis paths", async () => {
    const octokit = createOctokit({
      files: [
        workflowFile({
          filename: "src/new.ts",
          previous_filename: "src/old.ts",
          status: "renamed",
        }),
      ],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:src/old.ts`]: "export const before = true;\n",
        [`${HEAD_SHA}:src/new.ts`]: "export const after = true;\n",
      },
    });
    const harness = createHarness({ context: prContext({ body: "" }), octokit });

    await runAction(harness.runtime);

    expect(octokit.rest.repos.getContent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        path: "src/old.ts",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        path: "src/new.ts",
        ref: HEAD_SHA,
      }),
    );
    expect(harness.outputs.get("decision")).toBe("pass");
  });

  it("fetches fork PR head content from the fork repository", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: read\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: write\n",
      },
    });
    const harness = createHarness({
      context: prContext({
        body: "",
        head: {
          ref: "fork/workflow",
          sha: HEAD_SHA,
          repo: {
            full_name: "fork-owner/mergewarden",
            name: "mergewarden",
            owner: {
              login: "fork-owner",
            },
            fork: true,
          },
        },
      }),
      octokit,
    });

    await runAction(harness.runtime);

    expect(octokit.rest.pulls.listFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        path: "mergewarden.yml",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        path: ".github/workflows/release.yml",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "fork-owner",
        repo: "mergewarden",
        path: ".github/workflows/release.yml",
        ref: HEAD_SHA,
      }),
    );
    expect(harness.outputs.get("decision")).toBe("block");
  });

  it("skips removed head content and tolerates missing added base content", async () => {
    const octokit = createOctokit({
      files: [
        workflowFile({
          filename: "src/deleted.ts",
          status: "removed",
        }),
        workflowFile({
          filename: "src/added.ts",
          status: "added",
        }),
      ],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:src/deleted.ts`]: "export const before = true;\n",
        [`${HEAD_SHA}:src/added.ts`]: "export const after = true;\n",
      },
    });
    const harness = createHarness({
      context: prContext({ body: "", changed_files: 2 }),
      octokit,
    });

    await runAction(harness.runtime);

    expect(octokit.rest.repos.getContent).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/deleted.ts", ref: HEAD_SHA }),
    );
    expect(harness.outputs.get("decision")).toBe("pass");
    expect(harness.failures).toEqual([]);
  });

  it("treats API content failures as null for changed files", async () => {
    const octokit = createOctokit({
      files: [workflowFile({ filename: "src/app.ts" })],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${HEAD_SHA}:src/app.ts`]: "export const after = true;\n",
      },
      errors: {
        [`${BASE_SHA}:src/app.ts`]: new Error("not found"),
      },
    });
    const harness = createHarness({ context: prContext({ body: "" }), octokit });

    await runAction(harness.runtime);

    expect(harness.outputs.get("decision")).toBe("pass");
    expect(harness.failures).toEqual([]);
  });

  it("surfaces workflow content fetch failures as incomplete analysis findings", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: write\n",
      },
      errors: {
        [`${BASE_SHA}:.github/workflows/release.yml`]: githubApiError(404, "Not Found"),
      },
    });
    const harness = createHarness({ octokit });

    const result = await runAction(harness.runtime);

    expect(result?.findings.map((finding) => finding.ruleId)).toContain(
      "analysis/content-unavailable",
    );
    expect(result?.findings.map((finding) => finding.ruleId)).not.toContain(
      "workflow/permission-escalation",
    );
    expect(harness.outputs.get("decision")).toBe("block");
    expect(harness.outputs.get("status")).toBe("incomplete");
    expect(harness.outputs.get("analysis-complete")).toBe("false");
    expect(harness.failures).toEqual(["MergeWarden analysis is incomplete."]);
  });

  it("loads changed_files with one pull GET when the webhook payload omits it", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
    });
    const harness = createHarness({ context: prContext({ changed_files: undefined }), octokit });

    await runAction(harness.runtime);

    expect(octokit.rest.pulls.get).toHaveBeenCalledOnce();
    expect(octokit.rest.pulls.get).toHaveBeenCalledWith(
      expect.objectContaining({ request: { signal: expect.any(AbortSignal) } }),
    );
    expect(harness.outputs.get("analysis-complete")).toBe("true");
    expect(harness.failures).toEqual([]);
  });

  it("fails incomplete file-list analysis even when fail-on-block is false", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: observe\n",
      },
    });
    const harness = createHarness({
      context: prContext({ changed_files: 3_001 }),
      octokit,
      inputs: { "fail-on-block": "false" },
    });

    const result = await runAction(harness.runtime);

    expect(result?.findings.map((finding) => finding.ruleId)).toEqual([
      "analysis/file-list-incomplete",
    ]);
    expect(result?.decision).toBe("block");
    expect(result?.status).toBe("incomplete");
    expect(octokit.rest.pulls.listFiles).not.toHaveBeenCalled();
    expect(harness.outputs.get("analysis-complete")).toBe("false");
    expect(harness.outputs.get("expected-file-count")).toBe("3001");
    expect(harness.outputs.get("analyzed-file-count")).toBe("0");
    expect(harness.failures).toEqual(["MergeWarden analysis is incomplete."]);
  });

  it("does not fail block decisions when fail-on-block is false", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions: {}\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions: write-all\n",
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        "fail-on-block": "false",
      },
    });

    await runAction(harness.runtime);

    expect(harness.outputs.get("decision")).toBe("block");
    expect(harness.failures).toEqual([]);
  });

  it("respects a valid mode override and does not fail warnings", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions: {}\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions: write-all\n",
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        mode: "warn",
      },
    });

    await runAction(harness.runtime);

    expect(harness.outputs.get("decision")).toBe("warn");
    expect(harness.failures).toEqual([]);
  });

  it("does not call comment APIs when comment is false", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
    });
    const harness = createHarness({ octokit });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.listComments).not.toHaveBeenCalled();
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
  });

  it("creates a marked PR comment when comment is true and none exists", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [{ id: 3, body: "unrelated" }],
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        issue_number: 5,
        body: expect.stringContaining(
          "<!-- mergewarden-report -->\n<!-- This comment is managed by MergeWarden. Do not edit manually. -->\n\n# MergeWarden: PASSED",
        ),
      }),
    );
    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
  });

  it("updates the highest-id existing marked PR comment", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 8,
          body: "<!-- mergewarden-report -->\nold",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
        { id: 3, body: "unrelated" },
        {
          id: 21,
          body: "<!-- mergewarden-report -->\nnewer old",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ],
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "mergewarden",
        comment_id: 21,
        body: expect.stringContaining(
          "<!-- mergewarden-report -->\n<!-- This comment is managed by MergeWarden. Do not edit manually. -->\n\n# MergeWarden: PASSED",
        ),
      }),
    );
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
    expect(octokit.paginate).not.toHaveBeenCalled();
    expect(octokit.rest.issues?.listComments).toHaveBeenCalledWith(
      expect.objectContaining({
        per_page: 100,
        page: 1,
        sort: "created",
        direction: "desc",
        request: { signal: expect.any(AbortSignal) },
      }),
    );
    expect(octokit.rest.issues?.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ request: { signal: expect.any(AbortSignal) } }),
    );
  });

  it("bounds managed-comment discovery to the newest 100 comments", async () => {
    const comments = Array.from({ length: 100 }, (_, index) => ({
      id: 1_000 - index,
      body: `unrelated comment ${index}`,
      user: { login: "octocat", type: "User" },
    }));
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments,
    });
    const harness = createHarness({ octokit, inputs: { comment: "true" } });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.listComments).toHaveBeenCalledOnce();
    expect(octokit.paginate).not.toHaveBeenCalled();
    expect(octokit.rest.issues?.createComment).toHaveBeenCalledOnce();
  });

  it("bounds PR comments and reports the exact number of omitted findings", async () => {
    const files = Array.from({ length: 75 }, (_, index) => ({
      filename: `src/generated-${index}.ts`,
      status: "modified",
      additions: 1,
      deletions: 0,
      patch: "",
    }));
    const octokit = createOctokit({
      files,
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
    });
    const harness = createHarness({
      context: prContext({ changed_files: files.length }),
      octokit,
      inputs: { comment: "true" },
    });

    const result = await runAction(harness.runtime);
    const createArgs = vi.mocked(octokit.rest.issues!.createComment!).mock.calls[0]?.[0];

    expect(result?.metadata.totalFindingCount).toBe(75);
    expect(Buffer.byteLength(harness.summaryText(), "utf8")).toBeLessThanOrEqual(900_000);
    expect(createArgs).toBeDefined();
    expect(Buffer.byteLength(createArgs!.body, "utf8")).toBeLessThanOrEqual(60_000);
    expect(createArgs!.body).toContain("_25 findings omitted from this surface._");
    expect(createArgs!.body).toContain("Full report: mergewarden-report.md");
  });

  it("ignores human-owned marker comments and creates a managed comment", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 99,
          body: "<!-- mergewarden-report -->\nfake report",
          user: { login: "alice", type: "User" },
        },
      ],
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining(
          "<!-- This comment is managed by MergeWarden. Do not edit manually. -->",
        ),
        request: { signal: expect.any(AbortSignal) },
      }),
    );
    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
  });

  it("updates bot-owned marker comments", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 42,
          body: "<!-- mergewarden-report -->\nold",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
      ],
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 42,
      }),
    );
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
  });

  it("ignores marker comments from bots other than github-actions[bot]", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 100,
          body: "<!-- mergewarden-report -->\nhuman marker",
          user: { login: "alice", type: "User" },
        },
        {
          id: 12,
          body: "<!-- mergewarden-report -->\nolder bot marker",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
        {
          id: 61,
          body: "<!-- mergewarden-report -->\nnewer bot marker",
          user: { login: "mergewarden[bot]", type: "Bot" },
        },
      ],
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 12,
      }),
    );
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
  });

  it("ignores github-actions markers performed through another GitHub App", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 44,
          body: "<!-- mergewarden-report -->\nforeign app",
          user: { login: "github-actions[bot]", type: "Bot" },
          performed_via_github_app: { slug: "foreign-app" },
        },
      ],
    });
    const harness = createHarness({ octokit, inputs: { comment: "true" } });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
    expect(octokit.rest.issues?.createComment).toHaveBeenCalledOnce();
  });

  it("warns without failing when PR comment upsert fails", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
      },
      commentErrors: {
        list: new Error("Resource not accessible by integration"),
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(harness.warnings).toEqual([
      "MergeWarden could not upsert PR comment: Resource not accessible by integration",
    ]);
    expect(harness.failures).toEqual([]);
  });

  it("attempts comment upsert before failing block decisions", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:mergewarden.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:.github/workflows/release.yml`]: "permissions: {}\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions: write-all\n",
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(octokit.rest.issues?.createComment).toHaveBeenCalled();
    expect(harness.failures).toEqual(["MergeWarden blocked this pull request."]);
  });

  it("fails clearly for invalid fail-on-block input", async () => {
    const harness = createHarness({
      inputs: {
        "fail-on-block": "yes",
      },
    });

    await runAction(harness.runtime);

    expect(harness.failures).toEqual([
      "Invalid boolean input fail-on-block: yes. Expected true or false.",
    ]);
  });

  it("fails clearly for invalid comment input", async () => {
    const harness = createHarness({
      inputs: {
        comment: "nope",
      },
    });

    await runAction(harness.runtime);

    expect(harness.failures).toEqual([
      "Invalid boolean input comment: nope. Expected true or false.",
    ]);
  });
});

describe("writeTextFile", () => {
  it("creates parent directories for nested report paths", async () => {
    const dir = await import("node:os").then(({ tmpdir }) => tmpdir());
    const { mkdtemp, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = await mkdtemp(join(dir, "mergewarden-action-"));
    const reportPath = join(root, "reports", "mergewarden.md");

    await writeTextFile(reportPath, "# MergeWarden Report\n");

    await expect(readFile(reportPath, "utf8")).resolves.toBe("# MergeWarden Report\n");
  });
});
