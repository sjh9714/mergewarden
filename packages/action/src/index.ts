import * as core from "@actions/core";
import * as github from "@actions/github";
import { writeFile } from "node:fs/promises";

import { runAction, type ActionContext, type ActionSummary, type OctokitLike } from "./run.js";

const token = core.getInput("github-token");
const summary: ActionSummary = {
  addRaw(content) {
    core.summary.addRaw(content);
    return summary;
  },
  async write() {
    await core.summary.write();
  },
};

if (!token) {
  core.setFailed("Agent Gate requires the github-token input.");
} else {
  await runAction({
    context: github.context as unknown as ActionContext,
    getInput: (name) => core.getInput(name),
    notice: (message) => core.notice(message),
    octokit: github.getOctokit(token) as unknown as OctokitLike,
    setFailed: (message) => core.setFailed(message),
    setOutput: (name, value) => core.setOutput(name, value),
    summary,
    writeFile,
    now: () => new Date(),
  });
}
