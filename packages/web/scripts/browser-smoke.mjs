import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const executablePath =
  process.env.CHROME_PATH ??
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find(existsSync);
assert.ok(executablePath, "Set CHROME_PATH to an installed Chrome or Chromium executable.");

const dist = new URL("../dist/", import.meta.url);
const mime = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".html": "text/html",
};
const server = createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  const file = new URL(path === "/" ? "index.html" : `.${path}`, dist);
  if (!file.href.startsWith(dist.href)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(fileURLToPath(file));
    response
      .writeHead(200, {
        "Content-Type":
          mime[file.pathname.slice(file.pathname.lastIndexOf("."))] ?? "application/octet-stream",
      })
      .end(content);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
let browser;

const repository = { owner: { login: "owner" }, name: "repo", default_branch: "main" };
const pull = {
  number: 12,
  title: "Fix <img src=x onerror=alert(1)>",
  body: "Fixes #1\n\n" + "Review context. ".repeat(8),
  user: { login: "contributor" },
  author_association: "CONTRIBUTOR",
  labels: [],
  draft: false,
  changed_files: 0,
  additions: 0,
  deletions: 0,
  commits: 0,
  updated_at: "2026-09-10T00:00:00Z",
  html_url: "https://github.com/owner/repo/pull/12",
  base: { ref: "main", sha: "a".repeat(40), repo: repository },
  head: {
    ref: "change",
    sha: "b".repeat(40),
    repo: { ...repository, owner: { login: "contributor" }, fork: true },
  },
};

try {
  browser = await puppeteer.launch({ executablePath, headless: true });
  const page = await browser.newPage();
  const errors = [];
  const apiRequests = [];
  let mode = "normal";
  let deferred;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    if (!request.url().startsWith("https://api.github.com/")) {
      if (request.url().startsWith(url)) await request.continue();
      else await request.abort();
      return;
    }
    if (request.method() === "OPTIONS") {
      await request.respond({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "accept, x-github-api-version",
        },
      });
      return;
    }
    assert.equal(request.method(), "GET");
    assert.equal(request.headers().authorization, undefined);
    apiRequests.push(request.url());
    const path = new URL(request.url()).pathname;
    let status = 200;
    let body;
    if (mode === "limit") {
      status = 429;
      body = { message: "API rate limit exceeded" };
    } else if (path.endsWith("/pulls/404")) {
      status = 404;
      body = { message: "Not Found" };
    } else if (path.endsWith("/pulls/99")) {
      deferred = () =>
        request.respond({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ ...pull, number: 99 }),
        });
      return;
    } else if (path.endsWith("/pulls/12")) body = pull;
    else if (path.endsWith("/pulls")) body = [pull];
    else if (path.endsWith("/files") || path.endsWith("/commits")) body = [];
    else if (path.includes("/contents/")) {
      status = mode === "template-failure" ? 503 : 404;
      body = { message: "Unavailable" };
    } else {
      status = 404;
      body = { message: "Not Found" };
    }
    await request.respond({
      status,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(body),
    });
  });
  const waitForText = (text) =>
    page.waitForFunction(
      (expected) => globalThis.document.body.innerText.includes(expected),
      {},
      text,
    );
  const changeHash = (hash) =>
    page.evaluate((value) => {
      globalThis.location.hash = value;
    }, hash);

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url);
  await page.focus("#github-target");
  assert.equal(
    await page.$eval("#github-target", (input) => input.labels[0].textContent),
    "GitHub repository or pull request",
  );
  assert.notEqual(
    await page.$eval("#github-target", (input) => globalThis.getComputedStyle(input).boxShadow),
    "none",
  );
  await page.keyboard.type("owner/repo");
  await page.keyboard.press("Enter");
  await waitForText("1 external pull request read");
  assert.equal(
    await page.$eval(".result-column", (element) => element === globalThis.document.activeElement),
    true,
  );
  assert.equal(await page.$(".queue-row img"), null);
  assert.ok(await page.$("a[href='#pr=owner%2Frepo%2312']"));

  // A same-document shared link must replace the result without reloading.
  await changeHash("#pr=owner%2Frepo%2312");
  await waitForText("No high-signal boundary changes found.");
  assert.equal(await page.$eval("#github-target", (input) => input.value), "owner/repo#12");
  assert.equal(await page.$(".queue-result"), null);
  await page.reload();
  await waitForText("No high-signal boundary changes found.");
  assert.ok(
    (await page.$eval(".workflow", (element) => element.textContent)).includes(
      "sjh9714/mergewarden@v0.10.4",
    ),
  );
  assert.equal(
    await page.$eval(".install a.button", (link) => link.href),
    "https://github.com/owner/repo/new/main?filename=.github%2Fworkflows%2Fmergewarden.yml",
  );
  await page.evaluate(() =>
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await page.focus(".install button");
  await page.keyboard.press("Enter");
  await waitForText("Copy failed. Select the workflow below.");
  assert.equal(await page.$eval(".workflow", (element) => element.tabIndex), 0);
  await page.evaluate(() =>
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          globalThis.copiedWorkflow = text;
        },
      },
    }),
  );
  await page.keyboard.press("Enter");
  await waitForText("Workflow copied.");
  assert.ok((await page.evaluate(() => globalThis.copiedWorkflow)).includes("comment: auto"));

  await changeHash("#pr=owner%2Frepo%23404");
  await waitForText("This GitHub target is not publicly available.");
  await changeHash("#pr=invalid");
  await waitForText("Enter a valid GitHub repository or pull request.");
  mode = "limit";
  await changeHash("#repo=owner%2Frepo");
  await waitForText("GitHub API rate limit reached.");
  await waitForText("GH_TOKEN=... npx --yes mergewarden@0.10.4 triage owner/repo");
  mode = "template-failure";
  await changeHash("#repo=owner%2FREPO");
  await waitForText("Template checks unavailable for #12.");
  await waitForText("Review queue incomplete");

  // A late response must not overwrite a newer target or an empty hash.
  mode = "normal";
  await changeHash("#pr=owner%2Frepo%2399");
  const responseDeadline = Date.now() + 5_000;
  while (!deferred && Date.now() < responseDeadline)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(deferred, "The delayed PR request must start within five seconds.");
  await changeHash("#pr=owner%2Frepo%2312");
  await waitForText("No high-signal boundary changes found.");
  await deferred();
  await page.waitForNetworkIdle({ idleTime: 100 });
  assert.equal(
    await page.$eval(".success-stack .result-context", (element) => element.textContent),
    "owner/repo PR 12",
  );
  await changeHash("");
  await page.waitForSelector(".example");
  assert.equal(await page.$eval("#github-target", (input) => input.value), "");

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width: 375, height: 812 });
  await changeHash("#repo=owner%2Frepo");
  await waitForText("1 external pull request read");
  assert.equal(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
  assert.equal(
    await page.evaluate(() => globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    `Browser smoke passed: desktop/mobile, keyboard, shared hash/reload, stale response, incomplete/error states, clipboard fallback. ${apiRequests.length} mocked read-only GitHub requests.`,
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
