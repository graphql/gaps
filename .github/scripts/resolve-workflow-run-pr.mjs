export default async function resolveWorkflowRunPr({
  github,
  context,
  expectedBaseBranch,
}) {
  const workflowRun = context.payload.workflow_run;
  const headRepository = workflowRun?.head_repository?.full_name;
  const headBranch = workflowRun?.head_branch;
  const headSha = workflowRun?.head_sha;

  if (!headRepository || !headBranch || !headSha) {
    throw new Error("Workflow run is missing head repository, branch, or SHA");
  }

  const baseRepository = `${context.repo.owner}/${context.repo.repo}`;
  const pullRequests = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: "open",
    base: expectedBaseBranch,
    per_page: 100,
  });
  const matches = pullRequests.filter(
    (pullRequest) =>
      pullRequest.head.repo?.full_name === headRepository &&
      pullRequest.head.ref === headBranch &&
      pullRequest.head.sha === headSha &&
      pullRequest.base.repo?.full_name === baseRepository &&
      pullRequest.base.ref === expectedBaseBranch,
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one open pull request for workflow run ${workflowRun.id}; found ${matches.length}`,
    );
  }

  const pullRequestNumber = matches[0].number;
  if (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber < 1) {
    throw new Error("GitHub returned an invalid pull request number");
  }

  return pullRequestNumber;
}
