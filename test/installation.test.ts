import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
test('CLI and zsh initialization work from a relocated installation with quotes/spaces', async () => {
  const dir = await mkdtemp(join(tmpdir(), "cmdhelp user's app-"));
  try {
    for (const path of ['src', 'bin', 'shell', 'package.json']) await cp(join(root, path), join(dir, path), { recursive: true });
    await symlink(join(root, 'node_modules'), join(dir, 'node_modules'));
    await symlink(join(dir, 'bin/cmdhelp'), join(dir, 'linked-command'));
    const run = (...args: string[]) => execFileSync(process.execPath, [join(dir, 'linked-command'), ...args], { cwd: tmpdir(), encoding: 'utf8' });
    assert.match(run('--version'), /^\d+\.\d+\.\d+\s*$/);
    const init = run('init', 'zsh');
    const path = execFileSync('zsh', ['-fc', 'eval "$1"; print -r -- "$_cmdhelp_root"', 'test', init], { cwd: tmpdir(), encoding: 'utf8' }).trim();
    assert.equal(path, await realpath(dir));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
