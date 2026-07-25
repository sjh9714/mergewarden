#!/usr/bin/env node

import { runCli } from "./cli.js";

/**
 * `mergewarden demo | head` and `mergewarden scan … | less` (quit early) close stdout while
 * we are still writing to it. Without this, Node turns that ordinary shell idiom into an
 * unhandled EPIPE and prints a stack trace over the user's terminal. Exit quietly instead,
 * the way every other command-line tool does.
 */
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") {
      process.exit(0);
    }

    throw error;
  });
}

process.exitCode = await runCli(process.argv.slice(2));
