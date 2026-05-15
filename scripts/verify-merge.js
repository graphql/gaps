const fs = require("fs");
const yaml = require("js-yaml");

module.exports = async ({ github, context }) => {
  const actor = context.payload.comment.user.login;
  const prNumber = context.issue.number;

  const { data: files } = await github.rest.pulls.listFiles({
    ...context.repo,
    pull_number: prNumber,
  });

  const gapDirs = files
    .map((f) => f.filename)
    .map((p) => p.split("/")
    .slice(0, 2).join("/"));

  const gapsChanged = [...new Set(gapDirs)];

  if (gapsChanged.length !== 1 || !gapsChanged[0].match(/^gaps\/GAP-\d+$/)) {
    throw new Error("You can only run /merge for PRs that touch exactly one GAP directory and nothing else.");
  }

  const metadata = yaml.load(fs.readFileSync(`${gapsChanged[0]}/metadata.yml`, "utf8"));
  const authorizedMergers = new Set([
    ...metadata.authors.map(author => author.githubUsername.replace(/^@/, '')),
    metadata.sponsor.replace(/^@/, ''),
  ]);

  if (!authorizedMergers.has(actor)) {
    throw new Error(`${actor} is not authorized to merge ${gapsChanged[0]}.`);
  }
};
