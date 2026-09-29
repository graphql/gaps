// Minimizes previous deploy-preview comments so only the latest is visible.
// Called from preview-deploy.yml via actions/github-script.

export default async function run({ github, context, prNumber }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
  });

  await Promise.all(
    comments
      .filter(
        (c) =>
          c.user.login === "github-actions[bot]" &&
          c.body.includes("<!-- deploy-preview -->")
      )
      .map((c) =>
        github.graphql(
          `
          mutation($id: ID!) {
            minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) {
              minimizedComment { isMinimized }
            }
          }
        `,
          { id: c.node_id }
        )
      )
  );
}
