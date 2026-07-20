import * as core from "@actions/core";
import * as github from "@actions/github";

import { writeTextFile } from "./fileWriter.js";
import { runAction, type ActionContext, type ActionSummary, type OctokitLike } from "./run.js";

const summary: ActionSummary = {
  addRaw(content) {
    core.summary.addRaw(content);
    return summary;
  },
  async write() {
    await core.summary.write();
  },
};

async function main(): Promise<void> {
  const token = core.getInput("github-token");

  if (!token) {
    core.setFailed("MergeWarden requires the github-token input.");
    return;
  }

  await runAction({
    context: github.context as unknown as ActionContext,
    getInput: (name) => core.getInput(name),
    info: (message) => core.info(message),
    notice: (message) => core.notice(message),
    octokit: github.getOctokit(token) as unknown as OctokitLike,
    setFailed: (message) => core.setFailed(message),
    setOutput: (name, value) => core.setOutput(name, value),
    warning: (message) => core.warning(message),
    summary,
    writeFile: writeTextFile,
    now: () => new Date(),
  });
}

main().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
