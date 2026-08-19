import assert from "node:assert/strict";
import test from "node:test";

import resolveWorkflowRunPr from "./resolve-workflow-run-pr.mjs";

const listPullRequests = () => {};

function makeContext(overrides = {}) {
  return {
    repo: { owner: "graphql", repo: "gaps" },
    payload: {
      workflow_run: {
        id: 123,
        head_repository: { full_name: "contributor/gaps" },
        head_branch: "preview",
        head_sha: "abc123",
        ...overrides,
      },
    },
  };
}

function makePullRequest(overrides = {}) {
  return {
    number: 40,
    head: {
      repo: { full_name: "contributor/gaps" },
      ref: "preview",
      sha: "abc123",
    },
    base: {
      repo: { full_name: "graphql/gaps" },
      ref: "main",
    },
    ...overrides,
  };
}

function makeGithub(pullRequests) {
  return {
    rest: { pulls: { list: listPullRequests } },
    paginate: async (method, parameters) => {
      assert.equal(method, listPullRequests);
      assert.deepEqual(parameters, {
        owner: "graphql",
        repo: "gaps",
        state: "open",
        base: "main",
        per_page: 100,
      });
      return pullRequests;
    },
  };
}

test("resolves the PR using the complete workflow identity", async () => {
  const shellMetacharacterBranch = "preview$(touch${IFS}/tmp/pwned)";
  const exactMatch = makePullRequest({
    head: {
      repo: { full_name: "contributor/gaps" },
      ref: shellMetacharacterBranch,
      sha: "abc123",
    },
  });
  const sameBranchFromAnotherFork = makePullRequest({
    number: 41,
    head: {
      repo: { full_name: "attacker/gaps" },
      ref: shellMetacharacterBranch,
      sha: "abc123",
    },
  });

  const result = await resolveWorkflowRunPr({
    github: makeGithub([sameBranchFromAnotherFork, exactMatch]),
    context: makeContext({ head_branch: shellMetacharacterBranch }),
    expectedBaseBranch: "main",
  });

  assert.equal(result, 40);
});

test("rejects stale and ambiguous workflow runs", async () => {
  await assert.rejects(
    resolveWorkflowRunPr({
      github: makeGithub([
        makePullRequest({
          head: {
            repo: { full_name: "contributor/gaps" },
            ref: "preview",
            sha: "newer-sha",
          },
        }),
      ]),
      context: makeContext(),
      expectedBaseBranch: "main",
    }),
    /found 0/,
  );

  await assert.rejects(
    resolveWorkflowRunPr({
      github: makeGithub([makePullRequest(), makePullRequest({ number: 41 })]),
      context: makeContext(),
      expectedBaseBranch: "main",
    }),
    /found 2/,
  );
});
