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

function createOctokit(options: {
  files?: PullFile[];
  contents?: Record<string, string>;
  errors?: Record<string, Error>;
}): OctokitLike {
  const files = options.files ?? [];
  const contents = options.contents ?? {};
  const errors = options.errors ?? {};

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

  const createComment = vi.fn(async () => ({ data: {} }));

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
        createComment,
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
  const notices: string[] = [];
  const writtenFiles = new Map<string, string>();
  let summaryText = "";

  const runtime: ActionRuntime = {
    context: options.context ?? prContext(),
    octokit: options.octokit ?? createOctokit({}),
    getInput: vi.fn((name: string) => inputs[name] ?? ""),
    setOutput: vi.fn((name: string, value: string | number) => {
      outputs.set(name, String(value));
    }),
    setFailed: vi.fn((message: string | Error) => {
      failures.push(message instanceof Error ? message.message : message);
    }),
    notice: vi.fn((message: string) => {
      notices.push(message);
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
  };

  return {
    failures,
    notices,
    outputs,
    runtime,
    summaryText: () => summaryText,
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
    expect(JSON.parse(harness.writtenFiles.get("agent-gate-report.json") ?? "{}")).toMatchObject({
      decision: "block",
    });
    expect(harness.writtenFiles.get("agent-gate-report.md")).toContain(
      "workflow/permission-escalation",
    );
    expect(harness.summaryText()).toContain("# Agent Gate Report");
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

  it("emits a notice for comment=true without calling comment APIs", async () => {
    const octokit = createOctokit({
      files: [],
      contents: {
        [`${BASE_SHA}:agent-gate.yml`]: "version: 1\nmode: block\n",
      },
    });
    const harness = createHarness({
      octokit,
      inputs: {
        comment: "true",
      },
    });

    await runAction(harness.runtime);

    expect(harness.notices).toEqual(["Agent Gate PR comments are not implemented yet."]);
    expect(octokit.rest.issues?.createComment).not.toHaveBeenCalled();
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
