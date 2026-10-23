// Run with: node --test tests/worker/  (no dependencies)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../../worker/volstrat-refresh.js';

const { dispatch } = worker;

const env = { GITHUB_TOKEN: 't0k' };
const fake = (answers) => {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const a = answers.shift();
    if (a instanceof Error) throw a;
    return a;
  };
  return { impl, calls };
};

test('starts the data-update workflow on main', async () => {
  const f = fake([new Response(null, { status: 204 })]);
  const r = await dispatch(env, f.impl, 3, 0);
  assert.equal(r.ok, true);
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/kevincgith/volstrat/actions/workflows/data-update.yml/dispatches');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { ref: 'main' });
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer t0k');
});

test('retries GitHub hiccups', async () => {
  const f = fake([new Response('x', { status: 502 }), new Error('reset'), new Response(null, { status: 204 })]);
  assert.equal((await dispatch(env, f.impl, 3, 0)).ok, true);
  assert.equal(f.calls.length, 3);
});

test('does not retry token problems', async () => {
  const f = fake([new Response('Bad credentials', { status: 401 })]);
  const r = await dispatch(env, f.impl, 3, 0);
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  assert.equal(f.calls.length, 1);
});

test('refuses without the secret', async () => {
  const r = await dispatch({}, fake([]).impl);
  assert.match(r.message, /GITHUB_TOKEN/);
});
