import { test, spyOn } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { PiCredentials } from '../src/core.ts';

const cli = new URL('../src/cli.ts', import.meta.url).pathname;
const oauth = {
  type: 'oauth' as const, access: 'fixture-access', refresh: 'fixture-refresh',
  expires: Date.now() + 3_600_000, clientId: 'fixture-client', scopes: ['chatgpt.tokens.use.direct'],
};

async function run(profile: string, action: string, model = 'gpt-6.1-sol') {
  const child = Bun.spawn([process.execPath, cli, action, ...(action === 'suggest' ? ['print hello'] : [])], {
    env: { ...process.env, XDG_CONFIG_HOME: profile, CMDHELP_PI_PROFILE: profile, CMDHELP_PROVIDER: 'openai', CMDHELP_MODEL: model, OPENAI_API_KEY: '' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}

test('OpenAI ChatGPT OAuth, API keys, and legacy Codex credentials resolve through Pi', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cmdhelp-provider-'));
  try {
    const path = join(dir, 'auth.json');
    const credentials = new PiCredentials(path);
    const models = builtinModels({ credentials });
    await writeFile(path, JSON.stringify({ openai: oauth, 'openai-codex': oauth }));
    assert.equal((await models.getAuth('openai'))?.auth.apiKey, oauth.access);
    assert.equal((await models.getAuth('openai'))?.source, 'OAuth');
    assert.equal((await models.getAuth('openai-codex'))?.auth.apiKey, oauth.access);
    await credentials.modify('openai', async () => ({ type: 'api_key', key: 'sk-fixture' }));
    assert.equal((await models.getAuth('openai'))?.auth.apiKey, 'sk-fixture');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('expired OpenAI OAuth refresh preserves registration metadata and other provider credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cmdhelp-refresh-'));
  const path = join(dir, 'auth.json');
  const credentials = new PiCredentials(path);
  const models = builtinModels({ credentials });
  const refresh = spyOn(models.getProvider('openai')!.auth.oauth!, 'refresh').mockImplementation(async current => ({
    ...current, access: 'fixture-new-access', refresh: 'fixture-new-refresh', expires: Date.now() + 3_600_000,
  }));
  try {
    await writeFile(path, JSON.stringify({ openai: { ...oauth, expires: 0 }, other: { type: 'api_key', key: 'fixture-other' } }));
    const auth = await models.getAuth('openai');
    assert.equal(auth?.auth.apiKey, 'fixture-new-access');
    assert.equal(refresh.mock.calls.length, 1);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(saved.openai.refresh, 'fixture-new-refresh');
    assert.equal(saved.openai.clientId, oauth.clientId);
    assert.deepEqual(saved.openai.scopes, oauth.scopes);
    assert.equal(saved.other.key, 'fixture-other');
  } finally { refresh.mockRestore(); await rm(dir, { recursive: true, force: true }); }
});

test('doctor finds GPT-6.1 Sol in the bundled catalog without credentials or a cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cmdhelp-catalog-'));
  try {
    const result = await run(dir, 'doctor');
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Model: openai\/gpt-6\.1-sol/);
    assert.match(result.stdout, /no inference request made/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('cmdhelp streams with OpenAI OAuth and API keys while ignoring non-chat cache entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cmdhelp-stream-'));
  const requests: { authorization: string | null; path: string; body: any }[] = [];
  const answer = '```sh\nprintf hello\n```\nPrints hello.';
  const item = { type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: answer, annotations: [] }] };
  const events = [
    { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [] } },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: answer },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_fixture', status: 'completed', output: [item], usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } } },
  ];
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      requests.push({ authorization: request.headers.get('authorization'), path: new URL(request.url).pathname, body: await request.json() });
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
    },
  });
  try {
    const models = builtinModels();
    const bundled = models.getModel('openai', 'gpt-6.1-sol')!;
    // Same-ID classifiers can precede chat models in newer Pi catalogs.
    const classifier = models.getModelOfType('classifier', 'openai', 'gpt-6-luna')!;
    const cached = { ...bundled, id: 'fixture-cached-chat', baseUrl: `${server.url}v1` };
    await writeFile(join(dir, 'models-store.json'), JSON.stringify({ openai: { models: [{ ...classifier, id: cached.id }, cached] } }));
    for (const credential of [oauth, { type: 'api_key' as const, key: 'sk-fixture' }]) {
      await writeFile(join(dir, 'auth.json'), JSON.stringify({ openai: credential }));
      const result = await run(dir, 'suggest', cached.id);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.stdout, `${answer}\n`);
      assert.equal(requests.at(-1)?.authorization, `Bearer ${credential.type === 'oauth' ? credential.access : credential.key}`);
      assert.equal(requests.at(-1)?.path, '/v1/responses');
      assert.equal(requests.at(-1)?.body.model, cached.id);
      assert.equal(requests.at(-1)?.body.tools?.length ?? 0, 0);
    }
    assert.equal(requests.length, 2);
    // Non-chat-only entries cannot be used for command suggestions.
    await writeFile(join(dir, 'models-store.json'), JSON.stringify({ openai: { models: [{ ...classifier, id: cached.id }] } }));
    const result = await run(dir, 'doctor', cached.id);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /unavailable in this Pi SDK\/catalog/);
  } finally { server.stop(true); await rm(dir, { recursive: true, force: true }); }
});
