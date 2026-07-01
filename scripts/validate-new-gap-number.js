#!/usr/bin/env node

/**
 * Validates that newly added GAP directories and their metadata.yml `id` field
 * both match the PR number, per CONTRIBUTING.md.
 *
 * Usage: PR_NUMBER=123 node scripts/validate-new-gap-number.js
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, basename } from "node:path";
import { parse as parseYaml } from "yaml";

const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
  console.error("PR_NUMBER environment variable is required.");
  process.exit(1);
}

const newMetadataFiles = execSync(
  "git diff --name-only --diff-filter=A origin/main...HEAD -- 'gaps/*/metadata.yml'",
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

if (newMetadataFiles.length === 0) {
  console.log("No new metadata.yml files added in this PR.");
  process.exit(0);
}

let failed = false;

for (const file of newMetadataFiles) {
  const gapDir = basename(dirname(file));
  const expectedDir = `GAP-${prNumber}`;

  if (gapDir !== expectedDir) {
    console.error(
      `::error file=${file}::GAP directory is ${gapDir}, but must be ${expectedDir} to match the PR number. See CONTRIBUTING.md.`,
    );
    failed = true;
  } else {
    console.log(`✓ ${file}: directory ${gapDir} matches PR #${prNumber}`);
  }

  const content = readFileSync(file, "utf8");
  const metadata = parseYaml(content);
  const id = String(metadata.id);

  if (id !== prNumber) {
    console.error(
      `::error file=${file}::metadata.yml 'id' field is ${id}, but must match the PR number (${prNumber}). See CONTRIBUTING.md.`,
    );
    failed = true;
  } else {
    console.log(`✓ ${file}: id ${id} matches PR #${prNumber}`);
  }
}

if (failed) {
  process.exit(1);
}
