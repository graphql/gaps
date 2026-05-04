#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const gapsDir = join(rootDir, "gaps");

async function getGapDirs() {
  const entries = await readdir(gapsDir, { withFileTypes: true });
  return entries.filter((d) => d.isDirectory() && /^GAP-[1-9]\d*$/.test(d.name));
}

async function main() {
  const dirs = await getGapDirs();

  const lines = await Promise.all(
    dirs.map(async (dir) => {
      const metadataPath = join(gapsDir, dir.name, "metadata.yml");
      const metadata = parseYaml(await readFile(metadataPath, "utf8"));
      const owners = metadata.authors.map((a) => a.githubUsername.replace(/^@/, ""));
      const ownerList = owners.map((o) => `@${o}`).join(" ");
      return `/gaps/${dir.name}/ ${ownerList}`;
    }),
  );

  const content = lines.join("\n") + "\n";

  const existing = await readFile(join(rootDir, "CODEOWNERS"), "utf8");
  if (existing === content) {
    console.log("CODEOWNERS is up to date.");
    process.exit(0);
  }

  await writeFile(join(rootDir, "CODEOWNERS"), content);
  console.log("CODEOWNERS updated.");
}

main();
