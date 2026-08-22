import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

async function files(directory) {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
      }),
    )
  ).flat();
}

const forbidden = [
  { label: "Node import", pattern: /(?:from\s*|import\s*\(|require\s*\()\s*["'`]node:/u },
  { label: "Buffer runtime", pattern: /\bBuffer\s*(?:\.|\[|\()/u },
];

for (const path of await files(fileURLToPath(new URL("../dist", import.meta.url)))) {
  if (path.endsWith(".map")) {
    continue;
  }

  const source = await readFile(path, "utf8");
  for (const check of forbidden) {
    if (check.pattern.test(source)) {
      throw new Error(`${check.label} found in ${path}`);
    }
  }
}
