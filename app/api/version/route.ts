// Which git commit is this deployment running? Read by the "Blottman - Health Watch" n8n workflow,
// which compares it with the latest commit on GitHub. If they differ for more than ~30 minutes, a
// push did not deploy (e.g. Vercel blocked it: TEAM_ACCESS_REQUIRED on 2026-09-17..26), which is
// otherwise SILENT: GitHub shows a normal push and the site just keeps serving the old build.
// Vercel injects VERCEL_GIT_COMMIT_SHA at build/run time for git-triggered deployments; a CLI deploy
// has none, so we report "unknown" and the watcher skips the comparison.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA || "unknown" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
