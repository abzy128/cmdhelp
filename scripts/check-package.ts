import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { version } from '../package.json';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
function npm(args: string[], cwd: string): string {
  // Let PowerShell resolve npm's Windows shim, passing arguments as data.
  return windows
    ? execFileSync('pwsh', ['-NoProfile', '-Command', '& npm @($env:CMDHELP_NPM_ARGS | ConvertFrom-Json); exit $LASTEXITCODE'], {
      cwd, encoding: 'utf8', env: { ...process.env, CMDHELP_NPM_ARGS: JSON.stringify(args) },
    })
    : execFileSync('npm', args, { cwd, encoding: 'utf8' });
}
const dir = await mkdtemp(join(tmpdir(), "cmdhelp user's npm install-"));
try {
  const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', dir], root))[0];
  const files = packed.files.map((file: { path: string }) => file.path) as string[];
  for (const path of ['package.json', 'bin/cmdhelp', 'src/cli.ts', 'src/shell.ts', 'shell/cmdhelp.zsh', 'shell/cmdhelp.ps1']) {
    assert.ok(files.includes(path), `Missing package file: ${path}`);
  }
  assert.ok(files.every(path => /^(package\.json|README\.md|LICENSE|config\.example\.json|bin\/|src\/|shell\/|docs\/)/.test(path)), 'Unexpected package contents');
  npm(['install', '--global', '--prefix', join(dir, 'install'), '--ignore-scripts', '--no-audit', '--no-fund', join(dir, packed.filename)], dir);
  const command = join(dir, windows ? 'install/cmdhelp.ps1' : 'install/bin/cmdhelp');
  const run = (...args: string[]) => windows
    ? execFileSync('pwsh', ['-NoProfile', '-File', command, ...args], { cwd: dir, encoding: 'utf8' })
    : execFileSync(command, args, { cwd: dir, encoding: 'utf8' });
  assert.equal(run('--version').trim(), version);
  assert.match(run('--help'), /cmdhelp suggest/);
  if (!windows) {
    const installedRoot = join(dir, 'install/lib/node_modules/@abzy128/cmdhelp');
    const shellRoot = execFileSync('zsh', ['-fc', 'eval "$1"; print -r -- "$_cmdhelp_root"', 'test', run('init', 'zsh')], {
      cwd: dir, encoding: 'utf8',
    }).trim();
    assert.equal(shellRoot, await realpath(installedRoot));
  }
  if (Bun.which('pwsh')) {
    const output = execFileSync('pwsh', ['-NoProfile', '-Command', `${run('init', 'powershell')}\ncmdhelp --version`], { cwd: dir, encoding: 'utf8' });
    assert.equal(output.trim(), version);
  }
  console.log(`Verified ${packed.name}@${version}: tarball contents, global executable, and shell initialization.`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
