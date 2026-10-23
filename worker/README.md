# volstrat-cron: on-time trigger for the data update

GitHub's own `schedule:` trigger is best effort: runs are often late and sometimes skipped. On
2026-10-22 the 23:30 UTC run had not started 1 h 40 min later. This Cloudflare Worker fires on
a Cloudflare cron trigger, which runs on time, and asks GitHub's API to dispatch the
`data-update.yml` workflow. The workflow keeps its own schedule as a fallback. Duplicate runs
are harmless because the pipeline is idempotent and the workflow runs one at a time.

```
worker/
  wrangler.jsonc     name, cron schedule, repo/workflow variables
  src/index.ts       scheduled(): dispatch the workflow (retries 5xx/network errors); GET /health
  test/              unit tests for the dispatch call (mocked GitHub API)
```

**Schedule** (UTC; set in `wrangler.jsonc`): `20 1,3,11,23 * * *`.

| UTC | New York | Why |
|---|---|---|
| 23:20 | 19:20 EDT / 18:20 EST | first run after the pipeline's 18:00 end-of-day cutoff |
| 01:20 | 21:20 EDT / 20:20 EST | late publishers: Cboe VIX row, CFE settlements, Yahoo ETF bars |
| 03:20 | 23:20 EDT / 22:20 EST | second catch-up |
| 11:20 | 07:20 EDT / 06:20 EST | morning catch-up (put/call files, anything overnight) |

A date is only published, and a live decision only logged, once every input of the strategy has
it (the pipeline's completeness gate). So it doesn't matter which of these runs gets the data:
the first run that finds everything does the work, and the others find nothing new. It runs on
weekends too, and those runs are no-ops.

It runs on the Workers **free plan**: four invocations a day and one cron trigger.

## Setup

### 1. Create a GitHub token that can only start this workflow

github.com → your avatar → **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**:

- **Token name:** `volstrat-cron`
- **Expiration:** your choice (e.g. 1 year). Note the date: when it expires the Worker logs
  `401 token invalid or expired`, and the GitHub schedule keeps running as a fallback.
- **Resource owner:** `kevincgith`
- **Repository access:** *Only select repositories* → `volstrat`
- **Permissions → Repository permissions → Actions: Read and write.** Leave everything else at
  *No access*. *Metadata: Read* is added automatically.

Generate it and copy the token (`github_pat_…`). GitHub shows it only once.

### 2. Log in to Cloudflare

This opens the browser to authorise wrangler with your Cloudflare account (the same one as
mj-api):

```bash
cd worker
npm install
npx wrangler login
```

### 3. Deploy

```bash
npm run deploy
```

This creates the `volstrat-cron` Worker with its cron trigger. Until step 4 is done, a cron
firing only logs "GITHUB_TOKEN secret is not set".

### 4. Store the token as a secret

```bash
npx wrangler secret put GITHUB_TOKEN
```

Paste the token when asked. It's stored encrypted in Cloudflare, never in this repository.

### 5. Check it

```bash
curl https://volstrat-cron.<your-workers-subdomain>.workers.dev/health
```

It answers `ok`. The exact URL is printed by `npm run deploy`. To see a dispatch without
waiting for the schedule, run the Worker locally with the token in `worker/.dev.vars`
(git-ignored):

```
GITHUB_TOKEN="github_pat_..."
```

```bash
npm run dev
```

Then, in another terminal:

```bash
curl "http://localhost:8787/__scheduled?cron=20+23+*+*+*"
```

The dev terminal prints `dispatched (status 204, attempts 1)`, and a new **Data update** run
appears under the repository's Actions tab, triggered by *workflow_dispatch*. Delete
`.dev.vars` afterwards if you prefer not to keep the token on disk.

### 6. Watch it live

```bash
npm run tail
```

This shows each cron firing and its result. The Cloudflare dashboard shows the same under
**Workers & Pages → volstrat-cron → Logs**, and past cron runs under **Settings → Triggers**.

## Changing things

- **Schedule:** edit `triggers.crons` in `wrangler.jsonc`, then `npm run deploy`.
- **New token** (expiry or rotation): `npx wrangler secret put GITHUB_TOKEN`, then delete the
  old token on GitHub.
- **Run once by hand:** `gh workflow run data-update.yml`. The Worker deliberately exposes
  no public "run now" URL.

## Tests

```bash
npm test          # dispatch: request shape, retries, error messages
npm run typecheck
```

CI runs both on every push (`.github/workflows/ci.yml`).
