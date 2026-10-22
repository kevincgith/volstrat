/**
 * Daily signal snapshot for the default (Balanced) profile, run by the data
 * Action after the pipeline. Uses the same engine as the website.
 *
 * Writes into data/site/:
 *   latest.json          today's score, regime, allocation and components
 *   regime_history.json  every regime change since the score starts
 *   feed.xml             RSS feed of the last 30 regime changes
 *   track_record.json    the live, out-of-sample track record (see below)
 *
 * Live track record (data/track/v1/): parameters are frozen in params.json on
 * the first run; every run appends that close's decision to decisions.csv
 * (append-only: no backfill, existing rows are never rewritten).
 * and, when run in GitHub Actions, sets outputs `changed`, `title`, `body` if
 * the regime differs from the previous latest.json.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENT_BY_ID } from '../src/engine/components';
import { assemble } from '../src/engine/data';
import { DEFAULT_PARAMS, merge, type Params } from '../src/engine/params';
import { run } from '../src/engine/run';
import { REGIMES } from '../src/engine/score';

const SITE = resolve(process.argv[2] ?? resolve(process.cwd(), '../data/site'));
const SITE_URL = process.env.SITE_URL ?? 'https://app.kevinlhc.com/volstrat/';
const load = (f: string) => JSON.parse(readFileSync(resolve(SITE, f), 'utf8'));

export interface RegimeChange {
  date: string;
  from: string | null;
  to: string;
  score: number;
}

const data = assemble(load('signals.json'), load('assets.json'), load('meta.json'));
const r = run(data, DEFAULT_PARAMS);
const n = data.dates.length;
let L = n - 1;
while (L > 0 && !Number.isFinite(r.score.score[L]!)) L--;

const round = (x: number, d = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const changes: RegimeChange[] = [];
let prev = -1;
for (let t = 0; t <= L; t++) {
  const g = r.regimes[t]!;
  if (g < 0) continue;
  if (g !== prev) changes.push({ date: data.dates[t]!, from: prev >= 0 ? REGIMES[prev]! : null, to: REGIMES[g]!, score: round(r.score.score[t]!, 1)! });
  prev = g;
}

const latest = {
  profile: 'Balanced (default parameters)',
  date: data.dates[L],
  score: round(r.score.score[L]!, 1),
  composite: round(r.score.composite[L]!, 1),
  regime: REGIMES[r.regimes[L]!],
  regime_since: changes.at(-1)?.date ?? null,
  allocation: r.targets[L],
  components: r.score.components.map((c) => ({
    id: c.def.id,
    label: COMPONENT_BY_ID[c.def.id]!.label,
    raw: round(c.raw[L]!, 4),
    score: round(c.score[L]!, 1),
  })),
  generated_at: new Date().toISOString().slice(0, 19) + 'Z',
};

const prevPath = resolve(SITE, 'latest.json');
const previous = existsSync(prevPath) ? (JSON.parse(readFileSync(prevPath, 'utf8')) as typeof latest) : null;
writeFileSync(prevPath, JSON.stringify(latest, null, 1) + '\n');
writeFileSync(resolve(SITE, 'regime_history.json'), JSON.stringify({ profile: latest.profile, changes }, null, 0) + '\n');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const alloc = (w: Record<string, number | undefined> | null | undefined) =>
  Object.entries(w ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${k} ${Math.round((v ?? 0) * 100)}%`)
    .join(', ');
const items = changes
  .slice(-30)
  .reverse()
  .map((c) => {
    const title = c.from ? `${c.from} → ${c.to}` : `Start: ${c.to}`;
    return `  <item>
    <title>${esc(`VolStrat regime: ${title} (score ${c.score})`)}</title>
    <link>${SITE_URL}#/dashboard</link>
    <guid isPermaLink="false">volstrat-${c.date}-${c.to}</guid>
    <pubDate>${new Date(c.date + 'T21:00:00Z').toUTCString()}</pubDate>
    <description>${esc(`Signal at the close of ${c.date}: ${title}. Composite score ${c.score}. Default (Balanced) profile; hypothetical research signal, not investment advice.`)}</description>
  </item>`;
  })
  .join('\n');
writeFileSync(
  resolve(SITE, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>VolStrat regime changes</title>
  <link>${SITE_URL}</link>
  <description>Regime changes of the VolStrat risk-appetite score (default parameters). Personal research project, not investment advice.</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>
`,
);

const changed = !!previous && previous.regime !== latest.regime;
console.log(`${latest.date}: score ${latest.score}, regime ${latest.regime} (since ${latest.regime_since})${changed ? ` — CHANGED from ${previous!.regime}` : ''}`);
if (process.env.GITHUB_OUTPUT) {
  const title = `Regime change: ${previous?.regime} → ${latest.regime} (${latest.date})`;
  const body = [
    `**${latest.regime}** as of the close of ${latest.date} (composite score ${latest.score}; previously ${previous?.regime}).`,
    '',
    `Default (Balanced) allocation: ${alloc(latest.allocation)}.`,
    '',
    '| Component | Value | Score |',
    '|---|---|---|',
    ...latest.components.map((c) => `| ${c.label} | ${c.raw ?? '–'} | ${c.score ?? '–'} |`),
    '',
    `Dashboard: ${SITE_URL}#/dashboard`,
    '',
    '_Hypothetical research signal, not investment advice._',
  ].join('\n');
  const delim = `EOF_${Date.now()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\ntitle=${title}\nbody<<${delim}\n${body}\n${delim}\n`);
}

// ------------------------------------------------------------------ live track record (v1)
const TRACK = resolve(SITE, '../track/v1');
const paramsPath = resolve(TRACK, 'params.json');
const logPath = resolve(TRACK, 'decisions.csv');
const HEADER = 'signal_date,score,regime,weights,data_cutoff,recorded_at_utc';

if (!existsSync(paramsPath)) {
  mkdirSync(TRACK, { recursive: true });
  writeFileSync(
    paramsPath,
    JSON.stringify(
      {
        version: 'v1',
        frozen_at_utc: new Date().toISOString().slice(0, 19) + 'Z',
        note: 'Parameters frozen at inception. Decisions are appended daily and never rewritten; a parameter change starts a new version.',
        params: DEFAULT_PARAMS,
      },
      null,
      1,
    ) + '\n',
  );
}
const frozen = JSON.parse(readFileSync(paramsPath, 'utf8')) as { params: Params; frozen_at_utc: string };
const fp = merge(DEFAULT_PARAMS, frozen.params); // fills fields added to Params after freezing, with their defaults
const tr = run(data, fp);
let TL = n - 1;
while (TL > 0 && !Number.isFinite(tr.score.score[TL]!)) TL--;
const wstr = (w: Record<string, number | undefined> | null | undefined) =>
  Object.entries(w ?? {})
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => `${k}:${Math.round((v ?? 0) * 1e4) / 1e4}`)
    .join(';');
const rows = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').slice(1).filter(Boolean) : [];
const lastLogged = rows.length ? rows[rows.length - 1]!.split(',')[0]! : '';
const todayDate = data.dates[TL]!;
const decision = [todayDate, round(tr.score.score[TL]!, 2), REGIMES[tr.regimes[TL]!], wstr(tr.targets[TL]), load('meta.json').eod_cutoff ?? '', new Date().toISOString().slice(0, 19) + 'Z'];
if (!rows.length) {
  writeFileSync(logPath, HEADER + '\n' + decision.join(',') + '\n');
  console.log(`track v1: inception, first decision ${todayDate} ${decision[2]} (${decision[3]})`);
} else if (todayDate > lastLogged) {
  appendFileSync(logPath, decision.join(',') + '\n');
  console.log(`track v1: appended ${todayDate} ${decision[2]} (${decision[3]})`);
} else {
  console.log(`track v1: ${todayDate} already logged (last ${lastLogged}); nothing appended`);
}
// consistency check: would today's data have produced the same past decisions? (log only)
const loggedRows = readFileSync(logPath, 'utf8').trim().split('\n').slice(1);
for (const row of loggedRows.slice(-5)) {
  const [d0, , reg0, w0] = row.split(',');
  const i = data.dates.indexOf(d0!);
  if (i >= 0 && (REGIMES[tr.regimes[i]!] !== reg0 || wstr(tr.targets[i]) !== w0)) {
    console.log(`track v1: NOTE ${d0} recomputed with current data as ${REGIMES[tr.regimes[i]!]} (${wstr(tr.targets[i])}); logged decision kept: ${reg0} (${w0})`);
  }
}
writeFileSync(
  resolve(SITE, 'track_record.json'),
  JSON.stringify({
    version: 'v1',
    frozen_at_utc: frozen.frozen_at_utc,
    params: frozen.params,
    decisions: loggedRows.map((row) => {
      const [date, score, regime, weights, cutoff, recorded] = row.split(',');
      return {
        date,
        score: Number(score),
        regime,
        weights: Object.fromEntries((weights ?? '').split(';').filter(Boolean).map((kv) => [kv.split(':')[0], Number(kv.split(':')[1])])),
        cutoff,
        recorded,
      };
    }),
  }) + '\n',
);
