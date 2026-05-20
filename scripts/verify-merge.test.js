import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { vol } from "memfs";

mock.module("fs/promises", { exports: vol.promises });

const { default: verifyMerge } = await import("./verify-merge.js");

function makeContext({ actor = "alice", prNumber = 1 } = {}) {
  return {
    payload: { comment: { user: { login: actor } } },
    issue: { number: prNumber },
    repo: { owner: "graphql", repo: "gaps" },
  };
}

function makeGithub({ mergeable = true, files = [] } = {}) {
  return {
    rest: {
      pulls: {
        get: mock.fn(async () => ({ data: { mergeable } })),
        listFiles: mock.fn(async () => ({ data: files })),
      },
    },
  };
}

const METADATA = `
authors:
  - name: "Alice"
    email: "alice@example.com"
    githubUsername: "@alice"
  - name: "Bob"
    email: "bob@example.com"
    githubUsername: "@bob"
sponsor: "@charlie"
`;

beforeEach(() => {
  vol.reset();
});

describe("verify-merge", () => {
  it("allows an author to merge", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.doesNotReject(
      verifyMerge({ github, context: makeContext({ actor: "alice" }) }),
    );
  });

  it("allows a co-author to merge", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.doesNotReject(
      verifyMerge({ github, context: makeContext({ actor: "bob" }) }),
    );
  });

  it("allows the sponsor to merge", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.doesNotReject(
      verifyMerge({ github, context: makeContext({ actor: "charlie" }) }),
    );
  });

  it("rejects an unauthorized user", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext({ actor: "eve" }) }),
    );
  });

  it("rejects PRs touching multiple GAP directories", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [
        { filename: "gaps/GAP-10/DRAFT.md" },
        { filename: "gaps/GAP-7/DRAFT.md" },
      ],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });

  it("rejects PRs touching files outside gaps/", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      files: [
        { filename: "gaps/GAP-10/DRAFT.md" },
        { filename: ".github/workflows/evil.yml" },
      ],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });

  it("rejects when PR is not mergeable", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      mergeable: false,
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });

  it("rejects when mergeable is null (still computing)", async () => {
    vol.fromJSON({ "gaps/GAP-10/metadata.yml": METADATA });
    const github = makeGithub({
      mergeable: null,
      files: [{ filename: "gaps/GAP-10/DRAFT.md" }],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });

  it("rejects PRs with 100+ files", async () => {
    const files = Array.from({ length: 100 }, (_, i) => ({
      filename: `gaps/GAP-10/file${i}.md`,
    }));
    const github = makeGithub({ files });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });

  it("rejects path traversal attempts", async () => {
    const github = makeGithub({
      files: [{ filename: "gaps/GAP-10/../../../etc/passwd" }],
    });

    await assert.rejects(
      verifyMerge({ github, context: makeContext() }),
    );
  });
});
