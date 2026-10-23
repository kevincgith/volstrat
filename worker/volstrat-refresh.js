// Cloudflare Worker "volstrat-refresh": starts the VolStrat "Data update"
// workflow on a Cloudflare cron trigger (GitHub's own schedule runs late or not
// at all). Paste this whole file into Cloudflare -> Workers & Pages ->
// volstrat-refresh -> Edit code, then Deploy. Setup notes:
// PRIVATE-cloudflare-refresh.md (kept on this Mac only).
//
// Secret: GITHUB_TOKEN (fine-grained token, only kevincgith/volstrat,
// Actions: Read and write).

const URL = 'https://api.github.com/repos/kevincgith/volstrat/actions/workflows/data-update.yml/dispatches';

/** Ask GitHub to start the workflow; retries GitHub hiccups (5xx / network), not token problems. */
async function dispatch(env, fetchImpl = fetch, tries = 3, waitMs = 2000) {
  if (!env.GITHUB_TOKEN) return { ok: false, status: 0, message: 'secret GITHUB_TOKEN is not set' };
  let last = '';
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchImpl(URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'volstrat-refresh',
        },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (res.status === 204) return { ok: true, status: 204, message: 'run started' };
      last = `${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status < 500) return { ok: false, status: res.status, message: last };
    } catch (e) {
      last = `network error: ${e}`;
    }
    if (i < tries) await new Promise((r) => setTimeout(r, waitMs * i));
  }
  return { ok: false, status: 0, message: `gave up after ${tries} tries (${last})` };
}

// The default export is the only export: Cloudflare treats named exports as entrypoints.
export default {
  dispatch, // exposed for the tests (tests/worker/), ignored by Cloudflare
  async scheduled(event, env, ctx) {
    const r = await dispatch(env);
    console.log(`GitHub answered ${r.status}${r.ok ? ' (run started)' : `: ${r.message}`}`);
    if (!r.ok) throw new Error(`GitHub said ${r.status}`); // shows as a failed cron event in Cloudflare
  },
};
