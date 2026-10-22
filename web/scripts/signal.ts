/**
 * Daily signal snapshot for the default (Balanced) profile, run by the data
 * Action after the pipeline. Uses the same engine as the website.
 *
 * Writes into data/site/:
 *   latest.json          today's score, regime, allocation and components
 *   regime_history.json  every regime change since the score starts
 *   feed.xml             RSS feed of the last 30 regime changes
 * and, when run in GitHub Actions, sets outputs `changed`, `title`, `body` if
 * the regime differs from the previous latest.json.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { COMPONENT_BY_ID } from '../src/engine/components';
import { assemble } from '../src/engine/data';
import { DEFAULT_PARAMS } from '../src/engine/params';
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
