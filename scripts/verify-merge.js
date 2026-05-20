import { readFile } from "fs/promises";
import path from "path";
import { parse as parseYaml } from "yaml";

export default async ({ github, context }) => {
  const actor = context.payload.comment.user.login;
  const prNumber = context.issue.number;

  const [{ data: pr }, { data: files }] = await Promise.all([
    github.rest.pulls.get({
      ...context.repo,
      pull_number: prNumber,
    }),
    github.rest.pulls.listFiles({
      ...context.repo,
      pull_number: prNumber,
      per_page: 100,
    }),
  ]);

  if (files.length >= 100) {
    throw new Error("PR touches too many files!");
  }

  if (pr.mergeable === false) {
    throw new Error(
      "PR is not in a mergeable state. Resolve conflicts and try again.",
    );
  }

  const gapDirSet = new Set();

  for (const f of files) {
    const normalized = path.normalize(f.filename);
    if (normalized !== f.filename || normalized.startsWith("..")) {
      throw new Error(
        `File path "${f.filename}" contains path traversal or is not normalized.`,
      );
    }
    gapDirSet.add(f.filename.split("/").slice(0, 2).join("/"));
  }

  const gapsChanged = [...gapDirSet];

  if (gapsChanged.length !== 1 || !gapsChanged[0].match(/^gaps\/GAP-\d+$/)) {
    throw new Error(
      "You can only run /merge for PRs that touch exactly one GAP directory and nothing else.",
    );
  }

  const gapDir = gapsChanged[0];

  for (const f of files) {
    if (!f.filename.startsWith(`${gapDir}/`)) {
      throw new Error(
        `File "${f.filename}" is outside the expected GAP directory (${gapDir}).`,
      );
    }
  }

  const metadata = parseYaml(
    await readFile(`${gapDir}/metadata.yml`, "utf8"),
  );
  const authorizedMergers = new Set([
    ...metadata.authors.map((author) =>
      author.githubUsername.replace(/^@/, ""),
    ),
    metadata.sponsor.replace(/^@/, ""),
  ]);

  if (!authorizedMergers.has(actor)) {
    throw new Error(`${actor} is not authorized to merge ${gapDir}.`);
  }
};
