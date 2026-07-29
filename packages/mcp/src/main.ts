import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { checkScope } from "./checkScope.js";

const server = new McpServer({
  name: "mergewarden",
  version: "0.8.0",
});

server.registerTool(
  "check_change_scope",
  {
    title: "Check whether changes stayed inside their declared scope",
    description: [
      "Compare the files a change actually touched against the paths it was supposed to touch,",
      "and report anything outside them. Also flags edits to agent-instruction files",
      "(AGENTS.md, CLAUDE.md, .mcp.json and similar), which change how every future agent run",
      "in the repository behaves.",
      "",
      "Use this before opening a pull request. Get changedPaths from `git diff --name-only`",
      "against the branch point. It runs the same engine as the MergeWarden GitHub Action on",
      "the same default policy, so a clean result here is what the gate will report.",
      "",
      "Deterministic and offline: no network, no token, no model call. Only checks decidable",
      "from paths — workflow permissions and dependency scripts need file contents and are not",
      "covered here.",
    ].join("\n"),
    inputSchema: {
      allowedPaths: z
        .array(z.string())
        .describe(
          "Glob paths the change was scoped to, e.g. ['src/auth/**', 'test/auth/**']. Take these from what the user actually asked for.",
        ),
      changedPaths: z
        .array(z.string())
        .describe("Repository-relative paths actually changed, from `git diff --name-only`."),
      blockedPaths: z
        .array(z.string())
        .optional()
        .describe("Glob paths the change was explicitly told not to touch."),
      task: z
        .string()
        .optional()
        .describe("One line describing what was asked for. Recorded verbatim, never interpreted."),
    },
  },
  async ({ allowedPaths, changedPaths, blockedPaths, task }) => {
    const result = await checkScope({ allowedPaths, changedPaths, blockedPaths, task });

    const detail = result.findings
      .map((finding) => `- ${finding.severity.toUpperCase()} ${finding.ruleId}: ${finding.message}`)
      .join("\n");

    const text = [
      result.ok ? "PASS" : "NEEDS REVIEW",
      "",
      result.summary,
      detail ? `\n${detail}` : "",
      "",
      "Contract block for the pull request body:",
      "",
      result.contractBlock,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        ok: result.ok,
        summary: result.summary,
        findings: result.findings.map((f) => ({
          ruleId: f.ruleId,
          severity: f.severity,
          path: f.path ?? null,
          message: f.message,
        })),
        contractBlock: result.contractBlock,
      },
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
