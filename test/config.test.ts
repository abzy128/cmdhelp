import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';

async function fixture(run: (home: string, config: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'cmdhelp-config-'));
  try {
    await mkdir(join(home, '.config/cmdhelp'), { recursive: true });
    await mkdir(join(home, '.pi/agent'), { recursive: true });
    await writeFile(join(home, '.pi/agent/settings.json'), JSON.stringify({ defaultProvider: 'fixture', defaultModel: 'default', defaultThinkingLevel: 'high' }));
    await run(home, join(home, '.config/cmdhelp/config.json'));
  } finally { await rm(home, { recursive: true, force: true }); }
}

test('defaults use the standard Pi profile but not its reasoning setting', async () => {
  await fixture(async home => {
    const value = await loadConfig({}, home);
    assert.equal(value.profile, join(home, '.pi/agent'));
    assert.equal(value.provider, 'fixture');
    assert.equal(value.model, 'default');
    assert.equal(value.reasoning, 'off');
  });
});

test('application config and environment override Pi settings in order', async () => {
  await fixture(async (home, config) => {
    await writeFile(config, JSON.stringify({ provider: 'configured', model: 'configured-model', reasoning: 'low' }));
    assert.equal((await loadConfig({}, home)).model, 'configured-model');
    const value = await loadConfig({ CMDHELP_PROVIDER: 'override', CMDHELP_MODEL: 'override-model' }, home);
    assert.equal(value.provider, 'override');
    assert.equal(value.model, 'override-model');
    assert.equal(value.reasoning, 'low');
  });
});

test('XDG config and profile overrides work without a default Pi profile', async () => {
  await fixture(async home => {
    const xdg = join(home, 'xdg'), profile = join(home, 'custom');
    await mkdir(join(xdg, 'cmdhelp'), { recursive: true });
    await mkdir(profile);
    await writeFile(join(profile, 'settings.json'), JSON.stringify({ defaultProvider: 'custom', defaultModel: 'custom-model' }));
    await writeFile(join(xdg, 'cmdhelp/config.json'), JSON.stringify({ profile: '~/custom' }));
    const env = { XDG_CONFIG_HOME: xdg, PI_CODING_AGENT_DIR: join(home, 'unused') };
    assert.equal((await loadConfig(env, home)).profile, profile);
    const override = await loadConfig({ ...env, CMDHELP_PI_PROFILE: join(home, '.pi/agent') }, home);
    assert.equal(override.provider, 'fixture');
    await writeFile(join(xdg, 'cmdhelp/config.json'), '{}');
    assert.equal((await loadConfig({ XDG_CONFIG_HOME: xdg, PI_CODING_AGENT_DIR: profile }, home)).provider, 'custom');
  });
});

test('API-key configuration does not require existing Pi files', async () => {
  await fixture(async (home, config) => {
    await writeFile(config, JSON.stringify({ profile: '~/missing', provider: 'openai', model: 'gpt-4o-mini' }));
    assert.equal((await loadConfig({}, home)).provider, 'openai');
  });
});

test('invalid configuration fails with actionable errors', async () => {
  await fixture(async (home, config) => {
    for (const value of ['null', '[]', '{', '{"timeoutMs":0}', '{"reasoning":"fast"}', '{"profile":"relative"}', '{"model":false}', '{"modle":"typo"}']) {
      await writeFile(config, value);
      await assert.rejects(loadConfig({}, home));
    }
  });
});
