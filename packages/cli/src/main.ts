#!/usr/bin/env node

import { runCli } from "./replay.js";

process.exitCode = await runCli(process.argv.slice(2));
