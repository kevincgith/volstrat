import { describe, expect, it } from 'vitest';
import { dispatch, type Env } from '../src/index';

const env: Env = { GITHUB_TOKEN: 't0k', GITHUB_REPO: 'kevincgith/volstrat', WORKFLOW: 'data-update.yml', REF: 'main' };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    if (r instanceof Error) throw r;
    return r;
  };
  return { impl, calls };
}

describe('dispatch', () => {
  it('posts a workflow_dispatch for the configured ref', async () => {
    const f = fakeFetch([new Response(null, { status: 204 })]);
    const res = await dispatch(env, f.impl, 3, 0);
    expect(res).toMatchObject({ ok: true, status: 204, attempts: 1 });
    expect(f.calls[0]!.url).toBe('https://api.github.com/repos/kevincgith/volstrat/actions/workflows/data-update.yml/dispatches');
    expect(f.calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(f.calls[0]!.init.body))).toEqual({ ref: 'main' });
    const h = f.calls[0]!.init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer t0k');
    expect(h['User-Agent']).toBeTruthy();
  });

  it('retries server errors and network failures, then succeeds', async () => {
    const f = fakeFetch([new Response('oops', { status: 502 }), new Error('reset'), new Response(null, { status: 204 })]);
    const res = await dispatch(env, f.impl, 3, 0);
    expect(res).toMatchObject({ ok: true, attempts: 3 });
  });

  it('does not retry client errors and explains them', async () => {
    const f = fakeFetch([new Response('Bad credentials', { status: 401 })]);
    const res = await dispatch(env, f.impl, 3, 0);
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(1);
    expect(res.message).toMatch(/token invalid/);
  });

  it('refuses to run without a token', async () => {
    const res = await dispatch({ ...env, GITHUB_TOKEN: '' }, fakeFetch([]).impl);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/GITHUB_TOKEN/);
  });
});
