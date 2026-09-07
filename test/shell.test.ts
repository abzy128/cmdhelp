import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveShell, shellInit } from '../src/shell.ts';
import { extractCommand, systemPrompt } from '../src/core.ts';

test('shell selection controls model syntax and rejects unsupported shells', () => {
  assert.match(systemPrompt('suggest', 'powershell'), /Shell: powershell.*PowerShell 7/);
  assert.match(systemPrompt('explain', 'zsh'), /Shell: zsh.*BSD\/macOS/);
  assert.equal(resolveShell(), process.platform === 'win32' ? 'powershell' : 'zsh');
  assert.throws(() => resolveShell('cmd'));
  assert.throws(() => shellInit('cmd'));
});

test('PowerShell command blocks preserve literal Unicode and normalize CRLF', () => {
  const command = 'Write-Output "$(Get-Date)"\nGet-Item \'café 你好\'';
  for (const language of ['powershell', 'pwsh', 'ps1']) {
    assert.equal(extractCommand(`\`\`\`${language}\r\n${command.replaceAll('\n', '\r\n')}\r\n\`\`\``), command);
  }
  assert.equal(extractCommand('```powershell\nWrite-Output "\x1b[31m"\n```'), undefined);
  assert.equal(extractCommand('```powershell\na\n```\n```zsh\nb\n```'), undefined);
});

const hasPowerShell = !!Bun.which('pwsh');
test.skipIf(process.platform === 'win32' || !hasPowerShell || !Bun.which('python3'))('PowerShell widgets accept keyboard input through Bun in a real terminal', () => {
  const path = fileURLToPath(new URL('./interactive-powershell.py', import.meta.url));
  assert.match(execFileSync('python3', [path], { encoding: 'utf8', timeout: 30_000 }), /PowerShell terminal checks passed/);
}, 35_000);

test.skipIf(!hasPowerShell)('PowerShell handlers preserve literal input, cursor, and private handoff cleanup', () => {
  const path = fileURLToPath(new URL('./widget.ps1', import.meta.url));
  assert.match(execFileSync('pwsh', ['-NoProfile', '-File', path], { encoding: 'utf8', timeout: 20_000 }), /PowerShell widget checks passed/);
});

test.skipIf(!hasPowerShell)('PowerShell initialization loads actual PSReadLine bindings and the CLI wrapper', () => {
  const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const script = `${shellInit('powershell')}\ncmdhelp --version\n(Get-PSReadLineKeyHandler -Chord 'Ctrl+x,Ctrl+g').Function\n(Get-PSReadLineKeyHandler -Chord 'Ctrl+x,Ctrl+e').Function`;
  const output = execFileSync('pwsh', ['-NoProfile', '-Command', script], { cwd: join(cli, '..'), encoding: 'utf8', timeout: 20_000 });
  assert.match(output, /\d+\.\d+\.\d+/);
  assert.match(output, /CmdhelpSuggest/);
  assert.match(output, /CmdhelpExplain/);
});

test.skipIf(!hasPowerShell)('PowerShell wrapper forwards piped command text as data', () => {
  const script = `${shellInit('powershell')}\nfunction global:bun { $input | ForEach-Object { "STDIN:$_" }; "ARGS:$($args -join '|')" }\n'Get-Item café' | cmdhelp explain`;
  const output = execFileSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 20_000 });
  assert.match(output, /STDIN:Get-Item café/);
  assert.match(output, /ARGS:.*cli\.ts\|--shell\|powershell\|explain/);
});
