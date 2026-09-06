import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { version } from '../package.json';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), "cmdhelp user's npm install-"));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', dir], {
    cwd: root, encoding: 'utf8',
  }))[0];
  const files = packed.files.map((file: { path: string }) => file.path) as string[];
  for (const path of ['package.json', 'bin/cmdhelp', 'src/cli.ts', 'src/shell.ts', 'shell/cmdhelp.zsh']) {
    assert.ok(files.includes(path), `Missing package file: ${path}`);
  }
  assert.ok(files.every(path => /^(package\.json|README\.md|config\.example\.json|bin\/|src\/|shell\/|docs\/)/.test(path)), 'Unexpected package contents');
  execFileSync('npm', ['install', '--global', '--prefix', join(dir, 'install'), '--ignore-scripts', '--no-audit', '--no-fund', join(dir, packed.filename)], {
    cwd: dir, stdio: 'inherit',
  });
  const command = join(dir, 'install/bin/cmdhelp');
  const run = (...args: string[]) => execFileSync(command, args, { cwd: dir, encoding: 'utf8' });
  assert.equal(run('--version').trim(), version);
  assert.match(run('--help'), /cmdhelp suggest/);
  const installedRoot = join(dir, 'install/lib/node_modules/@abzy128/cmdhelp');
  const shellRoot = execFileSync('zsh', ['-fc', 'eval "$1"; print -r -- "$_cmdhelp_root"', 'test', run('init', 'zsh')], {
    cwd: dir, encoding: 'utf8',
  }).trim();
  assert.equal(shellRoot, await realpath(installedRoot));
  console.log(`Verified ${packed.name}@${version}: tarball contents, global executable, and zsh initialization.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
