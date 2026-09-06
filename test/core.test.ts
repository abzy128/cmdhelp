import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clean, extractCommand, PiCredentials } from '../src/core.ts';

test('only complete, unambiguous command blocks can be inserted', () => {
  assert.equal(extractCommand('```sh\nprintf \'%s\\n\' "$(date)"\n```\nPrints date.'), 'printf \'%s\\n\' "$(date)"');
  for (const answer of ['```sh\nrm -rf /', 'What directory?', '```sh\na\n```\n```sh\nb\n```', '```sh\necho \x1b[31mred\n```']) assert.equal(extractCommand(answer), undefined);
  assert.equal(extractCommand('```zsh\nprintf a\nprintf b\n```'), 'printf a\nprintf b');
});
test('terminal output cannot contain active escape controls', () => {
  const value = clean('hello\x1b]52;c;payload\x07\nworld\x9b2J');
  assert.doesNotMatch(value, /[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
  assert.ok(value.includes('\n'));
});
test('credential updates preserve profile symlinks and concurrent provider writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cmdhelp-test-'));
  try {
    const target = join(dir, 'auth.json'), link = join(dir, 'profile-auth.json');
    await writeFile(target, JSON.stringify({ existing: { type: 'api_key', key: 'fixture' } }), { mode: 0o600 });
    await symlink(target, link);
    const one = new PiCredentials(link), two = new PiCredentials(link);
    await Promise.all([
      one.modify('a', async () => ({ type: 'api_key', key: 'a' })),
      two.modify('b', async () => ({ type: 'api_key', key: 'b' })),
    ]);
    assert.ok((await lstat(link)).isSymbolicLink());
    assert.deepEqual(Object.keys(JSON.parse(await readFile(target, 'utf8'))).sort(), ['a', 'b', 'existing']);
    await assert.rejects(one.modify('a', async () => { throw new Error('failed refresh'); }));
    assert.equal((await one.read('a') as any).key, 'a');
    const unchanged = await one.modify('a', async () => undefined);
    assert.equal((unchanged as any).key, 'a');
    assert.equal((await one.read('a') as any).key, 'a');
    await one.delete('a');
    assert.equal(await one.read('a'), undefined);
    assert.equal((await one.read('b') as any).key, 'b');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
