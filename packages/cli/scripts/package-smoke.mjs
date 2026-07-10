import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const MAX_PACKED_BYTES = 2 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 5 * 1024 * 1024;
const MAX_HELP_MILLISECONDS = 10_000;
const MAX_SCAN_MILLISECONDS = 60_000;
const PUBLISHED_PACKAGE = "@jinhyuk9714/agent-gate";
const PUBLIC_SCAN_TARGET =
  process.env.AGENT_GATE_PACKAGE_SMOKE_SCAN_TARGET ??
  "https://github.com/sjh9714/agent-gate-install-smoke-20260617/pull/14";
const EXPECTED_FILES = [
  "LICENSE",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  "dist/main.js",
  "package.json",
].sort();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    ...options,
    // Windows command shims are .cmd files and require the command shell.
    shell: process.platform === "win32" && command === npmCommand,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function createTarball(tempRoot) {
  const packRoot = join(tempRoot, "pack");
  await mkdir(packRoot, { recursive: true });
  const pack = await run(npmCommand, ["pack", "--json", "--pack-destination", packRoot], {
    cwd: packageRoot,
  });
  const entries = JSON.parse(pack.stdout);
  const packed = entries[0];
  assert(packed && typeof packed.filename === "string", "npm pack did not return a tarball name");
  return join(packRoot, packed.filename);
}

async function installedFiles(root, directory = root) {
  const files = [];
  let byteLength = 0;

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await installedFiles(root, path);
      files.push(...nested.files);
      byteLength += nested.byteLength;
      continue;
    }

    assert(entry.isFile(), `installed package contains unsupported entry: ${path}`);
    files.push(relative(root, path).split(sep).join("/"));
    byteLength += (await stat(path)).size;
  }

  return { files, byteLength };
}

async function validateTarball(tarball, tempRoot) {
  const tarballStats = await stat(tarball);
  assert(tarballStats.isFile(), `tarball is not a file: ${tarball}`);
  assert(
    tarballStats.size < MAX_PACKED_BYTES,
    `packed CLI is ${tarballStats.size} bytes; limit is ${MAX_PACKED_BYTES}`,
  );

  const installRoot = join(tempRoot, "install");
  await mkdir(installRoot, { recursive: true });
  await writeFile(
    join(installRoot, "package.json"),
    JSON.stringify({ name: "agent-gate-package-smoke", private: true }, null, 2),
  );
  await run(
    npmCommand,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", tarball],
    { cwd: installRoot },
  );

  const installedPackagePath = join(installRoot, "node_modules", "@jinhyuk9714", "agent-gate");
  const installed = await installedFiles(installedPackagePath);
  assert(
    installed.byteLength < MAX_UNPACKED_BYTES,
    `unpacked CLI is ${installed.byteLength} bytes; limit is ${MAX_UNPACKED_BYTES}`,
  );
  assert(
    JSON.stringify(installed.files.sort()) === JSON.stringify(EXPECTED_FILES),
    `tarball contains unexpected files: ${installed.files.join(", ")}`,
  );

  const installedManifest = JSON.parse(
    await readFile(join(installedPackagePath, "package.json"), "utf8"),
  );
  assert(
    installedManifest.name === PUBLISHED_PACKAGE,
    `published manifest name ${installedManifest.name} does not match ${PUBLISHED_PACKAGE}`,
  );
  for (const [name, dependency] of Object.entries(installedManifest.dependencies ?? {})) {
    assert(!name.startsWith("@agent-gate/"), `published manifest contains private package ${name}`);
    assert(
      typeof dependency !== "string" || !dependency.startsWith("workspace:"),
      "published manifest must not contain workspace dependencies",
    );
  }

  const cliEntry = join(installedPackagePath, "dist", "main.js");
  assert(
    (await readFile(cliEntry, "utf8")).startsWith("#!/usr/bin/env node\n"),
    "installed CLI entry is missing its executable shebang",
  );
  const help = await run(process.execPath, [cliEntry, "--help"], {
    cwd: installRoot,
    timeout: MAX_HELP_MILLISECONDS,
  });
  assert(help.stdout.includes("agent-gate scan"), "installed CLI help did not describe scan");
  const helpStartedAt = Date.now();
  const binHelp = await run(
    npmCommand,
    ["exec", "--offline", "--no", "--", "agent-gate", "--help"],
    {
      cwd: installRoot,
      timeout: MAX_HELP_MILLISECONDS,
    },
  );
  const helpMilliseconds = Date.now() - helpStartedAt;
  assert(binHelp.stdout.includes("agent-gate scan"), "installed npm bin did not execute its CLI");
  assert(
    helpMilliseconds < MAX_HELP_MILLISECONDS,
    `installed npm-exec help took ${helpMilliseconds}ms; limit is ${MAX_HELP_MILLISECONDS}ms`,
  );

  const version = await run(process.execPath, [cliEntry, "--version"], { cwd: installRoot });
  assert(
    version.stdout.trim() === installedManifest.version,
    `installed CLI version ${version.stdout.trim()} does not match ${installedManifest.version}`,
  );

  const fixtureRoot = join(installRoot, "fixture");
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(join(fixtureRoot, "agent-gate.yml"), "version: 1\nmode: warn\n");
  await writeFile(join(fixtureRoot, "fixture.json"), JSON.stringify({ files: [] }, null, 2));
  const replay = await run(
    process.execPath,
    [cliEntry, "replay", fixtureRoot, "--format", "json"],
    {
      cwd: installRoot,
    },
  );
  const replayResult = JSON.parse(replay.stdout);
  assert(replayResult.decision === "pass", "installed CLI replay did not produce a pass result");

  const scanStartedAt = Date.now();
  const scan = await run(
    process.execPath,
    [cliEntry, "scan", PUBLIC_SCAN_TARGET, "--mode", "warn", "--format", "json"],
    {
      cwd: installRoot,
      timeout: MAX_SCAN_MILLISECONDS,
    },
  );
  const scanMilliseconds = Date.now() - scanStartedAt;
  const scanResult = JSON.parse(scan.stdout);
  assert(
    scanResult.metadata?.analysisComplete === true,
    "installed CLI scan did not complete its analysis",
  );
  assert(
    scanMilliseconds < MAX_SCAN_MILLISECONDS,
    `installed CLI scan took ${scanMilliseconds}ms; limit is ${MAX_SCAN_MILLISECONDS}ms`,
  );

  process.stdout.write(
    `Package smoke passed for ${basename(tarball)} (${tarballStats.size} bytes packed, ${installed.byteLength} bytes unpacked, help ${helpMilliseconds}ms, public scan ${scanMilliseconds}ms).\n`,
  );
}

const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--");
assert(arguments_.length <= 1, "Usage: package-smoke.mjs [existing-package.tgz]");
if (process.env.npm_lifecycle_event === "test:packed") {
  assert(arguments_.length === 1, "test:packed requires the exact tarball path to validate.");
}

const tempRoot = await mkdtemp(join(tmpdir(), "agent-gate-package-smoke-"));
const tarball = arguments_[0]
  ? resolve(process.cwd(), arguments_[0])
  : await createTarball(tempRoot);
await validateTarball(tarball, tempRoot);
