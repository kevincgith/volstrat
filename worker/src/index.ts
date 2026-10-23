/**
 * volstrat-cron: dispatches the data-update GitHub Actions workflow on a cron
 * schedule. GitHub's own `schedule:` trigger is best effort and is often late
 * or skipped under load; a Cloudflare cron trigger fires on time.
 *
 * Routes: GET /health -> "ok". Nothing else is exposed: there is deliberately
 * no public "run now" endpoint (use `gh workflow run data-update.yml`).
 */

export interface Env {
  GITHUB_TOKEN: string; // fine-grained PAT, this repo only, Actions: read and write
  GITHUB_REPO: string; // "owner/name"
  WORKFLOW: string; // workflow file name
  REF: string; // branch
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  attempts: number;
  message: string;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST .../actions/workflows/{WORKFLOW}/dispatches; retries 5xx and network errors. */
export async function dispatch(env: Env, fetchImpl: FetchLike = fetch, retries = 3, backoffMs = 2000): Promise<DispatchResult> {
  if (!env.GITHUB_TOKEN) return { ok: false, status: 0, attempts: 0, message: 'GITHUB_TOKEN secret is not set' };
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.WORKFLOW}/dispatches`;
  let last = '';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'volstrat-cron',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: env.REF }),
      });
      if (r.status === 204) return { ok: true, status: 204, attempts: attempt, message: 'dispatched' };
      const body = (await r.text()).slice(0, 300);
      if (r.status < 500) {
        // not retryable: say what is probably wrong
        const hint =
          r.status === 401
            ? 'token invalid or expired'
            : r.status === 403 || r.status === 404
              ? 'token lacks Actions: write on this repo, or repo/workflow name is wrong'
              : r.status === 422
                ? 'workflow has no workflow_dispatch trigger, or the ref does not exist'
                : 'request rejected';
        return { ok: false, status: r.status, attempts: attempt, message: `${hint}: ${body}` };
      }
      last = `HTTP ${r.status}: ${body}`;
    } catch (e) {
      last = `network error: ${String(e)}`;
    }
    if (attempt < retries) await sleep(backoffMs * attempt);
  }
  return { ok: false, status: 0, attempts: retries, message: `gave up after ${retries} attempts (${last})` };
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      dispatch(env).then((res) => {
        const line = `[${new Date(controller.scheduledTime).toISOString()}] cron "${controller.cron}": ${res.message} (status ${res.status}, attempts ${res.attempts})`;
        if (res.ok) console.log(line);
        else console.error(line);
      }),
    );
  },

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return new Response('ok');
    return new Response('volstrat-cron: triggers the VolStrat data update on a schedule. See /health.', { status: 404 });
  },
};
