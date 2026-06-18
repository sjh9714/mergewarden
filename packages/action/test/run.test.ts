import { describe, expect, it, vi } from "vitest";

import {
  fetchRepositoryTextContent,
  runAction,
  type ActionContext,
  type ActionRuntime,
  type OctokitLike,
  type PullFile,
} from "../src/run.js";
import { writeTextFile } from "../src/fileWriter.js";
import { AGENT_GATE_VERSION } from "../src/version.js";

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

function validContractBody() {
  return [
    "<!-- agent-gate-contract",
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
      repo: "Agent-Gate",
    },
    payload: {
      pull_request: {
        number: 5,
        title: "Tighten workflow permissions",
        body: validContractBody(),
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
}

function createOctokit(options: {
  files?: PullFile[];
  contents?: Record<string, string>;
  errors?: Record<string, Error>;
  comments?: IssueComment[];
  commentErrors?: {
    list?: Error;
    create?: Error;
    update?: Error;
  };
}): OctokitLike {
  const files = options.files ?? [];
  const contents = options.contents ?? {};
  const errors = options.errors ?? {};
  const comments = options.comments ?? [];
  const commentErrors = options.commentErrors ?? {};

  const listFiles = vi.fn(async () => ({ data: files }));
  const getContent = vi.fn(async ({ path, ref }: { path: string; ref: string }) => {
    const key = `${ref}:${path}`;

    if (errors[key]) {
      throw errors[key];
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
    paginate: vi.fn(async (method, args) => {
      const response = await method(args);
      return response.data;
    }),
    rest: {
      pulls: {
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
    config: "agent-gate.yml",
    mode: "",
    comment: "false",
    "fail-on-block": "true",
    "report-json": "agent-gate-report.json",
    "report-markdown": "agent-gate-report.md",
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

  const runtime = {
    context: options.context ?? prContext(),
    octokit: options.octokit ?? createOctokit({}),
    getInput: vi.fn((name: string) => inputs[name] ?? ""),
    setOutput: vi.fn((name: string, value: string | number) => {
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
        repo: { owner: "sjh9714", repo: "Agent-Gate" },
        payload: {},
      },
    });

    await runAction(harness.runtime);

    expect(harness.failures).toEqual(["Agent Gate can only run on pull_request events."]);
  });

  it("builds analysis input from PR APIs, writes reports, and fails on block by default", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]:
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
    expect(harness.outputs.get("risk-score")).toBe(String(result?.riskScore));
    expect(harness.outputs.get("report-json")).toBe("agent-gate-report.json");
    expect(harness.outputs.get("report-markdown")).toBe("agent-gate-report.md");
    const jsonReport = JSON.parse(harness.writtenFiles.get("agent-gate-report.json") ?? "{}");

    expect(jsonReport).toMatchObject({
      decision: "block",
      metadata: {
        version: AGENT_GATE_VERSION,
      },
    });
    expect(jsonReport.findings[0].findingId).toMatch(/^agf_[0-9a-f]{16}$/);
    expect(harness.writtenFiles.get("agent-gate-report.md")).toContain(
      "workflow/permission-escalation",
    );
    expect(harness.summaryText()).toContain("# Agent Gate: BLOCKED");
    expect(harness.infos.join("\n")).toContain("Agent Gate: BLOCKED");
    expect(harness.infos.join("\n")).toContain("Decision: block");
    expect(harness.infos.join("\n")).toContain("Risk score:");
    expect(harness.infos.join("\n")).toContain("Findings:");
    expect(harness.infos.join("\n")).toMatch(
      /- error agf_[0-9a-f]{16} workflow\/permission-escalation \.github\/workflows\/release\.yml/,
    );
    expect(harness.failures).toEqual(["Agent Gate blocked this pull request."]);
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "agent-gate.yml",
        owner: "sjh9714",
        repo: "Agent-Gate",
        ref: BASE_SHA,
      }),
    );
  });

  it("fetches renamed file base content from previousPath and head content from current path", async () => {
    const octokit = createOctokit({
      files: [
        workflowFile({
          filename: "src/new.ts",
          previous_filename: "src/old.ts",
          status: "renamed",
        }),
      ],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:src/old.ts`]: "export const before = true;\n",
        [`${HEAD_SHA}:src/new.ts`]: "export const after = true;\n",
      },
    });
    const harness = createHarness({ context: prContext({ body: "" }), octokit });

    await runAction(harness.runtime);

    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "Agent-Gate",
        path: "src/old.ts",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "Agent-Gate",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
            full_name: "fork-owner/Agent-Gate",
            name: "Agent-Gate",
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
        repo: "Agent-Gate",
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "Agent-Gate",
        path: "agent-gate.yml",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "sjh9714",
        repo: "Agent-Gate",
        path: ".github/workflows/release.yml",
        ref: BASE_SHA,
      }),
    );
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "fork-owner",
        repo: "Agent-Gate",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
        [`${BASE_SHA}:src/deleted.ts`]: "export const before = true;\n",
        [`${HEAD_SHA}:src/added.ts`]: "export const after = true;\n",
      },
    });
    const harness = createHarness({ context: prContext({ body: "" }), octokit });

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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
        [`${HEAD_SHA}:.github/workflows/release.yml`]: "permissions:\n  contents: write\n",
      },
      errors: {
        [`${BASE_SHA}:.github/workflows/release.yml`]: new Error("not found"),
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
  });

  it("does not fail block decisions when fail-on-block is false", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
        repo: "Agent-Gate",
        issue_number: 5,
        body: expect.stringContaining(
          "<!-- agent-gate-report -->\n<!-- This comment is managed by Agent Gate. Do not edit manually. -->\n\n# Agent Gate: PASSED",
        ),
      }),
    );
    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
  });

  it("updates the highest-id existing marked PR comment", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 8,
          body: "<!-- agent-gate-report -->\nold",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
        { id: 3, body: "unrelated" },
        {
          id: 21,
          body: "<!-- agent-gate-report -->\nnewer old",
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
        repo: "Agent-Gate",
        comment_id: 21,
        body: expect.stringContaining(
          "<!-- agent-gate-report -->\n<!-- This comment is managed by Agent Gate. Do not edit manually. -->\n\n# Agent Gate: PASSED",
        ),
      }),
    );
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
  });

  it("ignores human-owned marker comments and creates a managed comment", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 99,
          body: "<!-- agent-gate-report -->\nfake report",
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
          "<!-- This comment is managed by Agent Gate. Do not edit manually. -->",
        ),
      }),
    );
    expect(octokit.rest.issues?.updateComment).not.toHaveBeenCalled();
  });

  it("updates bot-owned marker comments", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 42,
          body: "<!-- agent-gate-report -->\nold",
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

  it("updates the newest bot-owned marker when human and bot markers both exist", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
      },
      comments: [
        {
          id: 100,
          body: "<!-- agent-gate-report -->\nhuman marker",
          user: { login: "alice", type: "User" },
        },
        {
          id: 12,
          body: "<!-- agent-gate-report -->\nolder bot marker",
          user: { login: "github-actions[bot]", type: "Bot" },
        },
        {
          id: 61,
          body: "<!-- agent-gate-report -->\nnewer bot marker",
          user: { login: "agent-gate[bot]", type: "Bot" },
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
        comment_id: 61,
      }),
    );
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
  });

  it("warns without failing when PR comment upsert fails", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
      "Agent Gate could not upsert PR comment: Resource not accessible by integration",
    ]);
    expect(harness.failures).toEqual([]);
  });

  it("attempts comment upsert before failing block decisions", async () => {
    const octokit = createOctokit({
      files: [workflowFile()],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
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
    expect(harness.failures).toEqual(["Agent Gate blocked this pull request."]);
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

describe("fetchRepositoryTextContent", () => {
  it("returns null for API failures and non-file content", async () => {
    const throwingOctokit = createOctokit({
      files: [],
      errors: {
        "main:agent-gate.yml": new Error("not found"),
      },
    });
    const directoryOctokit: OctokitLike = {
      rest: {
        repos: {
          getContent: vi.fn(async () => ({ data: [] })),
        },
        pulls: {
          listFiles: vi.fn(async () => ({ data: [] })),
        },
      },
    };

    await expect(
      fetchRepositoryTextContent(throwingOctokit, {
        owner: "sjh9714",
        repo: "Agent-Gate",
        path: "agent-gate.yml",
        ref: "main",
      }),
    ).resolves.toBeNull();
    await expect(
      fetchRepositoryTextContent(directoryOctokit, {
        owner: "sjh9714",
        repo: "Agent-Gate",
        path: ".github",
        ref: "main",
      }),
    ).resolves.toBeNull();
  });
});

describe("writeTextFile", () => {
  it("creates parent directories for nested report paths", async () => {
    const dir = await import("node:os").then(({ tmpdir }) => tmpdir());
    const { mkdtemp, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = await mkdtemp(join(dir, "agent-gate-action-"));
    const reportPath = join(root, "reports", "agent-gate.md");

    await writeTextFile(reportPath, "# Agent Gate Report\n");

    await expect(readFile(reportPath, "utf8")).resolves.toBe("# Agent Gate Report\n");
  });
});
