import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { clean, createClient, type Mode } from './core.ts';
import { loadConfig } from './config.ts';
import { resolveShell, shellInit } from './shell.ts';
import { version } from '../package.json';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, mode: { type: 'string' },
    version: { type: 'boolean', short: 'v' },
    shell: { type: 'string' },
    'buffer-file': { type: 'string' }, 'output-file': { type: 'string' },
  } });
  if (values.version) { console.log(version); return; }
  if (values.help || !positionals.length) {
    console.log('cmdhelp suggest "task" [--shell zsh|powershell]\ncmdhelp explain \'command\'\ncmdhelp explain < command.txt (zsh)\nGet-Content -Raw command.txt | cmdhelp explain (PowerShell)\ncmdhelp ui --mode suggest|explain\ncmdhelp init zsh|powershell\ncmdhelp doctor\ncmdhelp --version\n\nZsh / PowerShell: Ctrl-X Ctrl-G suggests; Ctrl-X Ctrl-E explains.'); return;
  }
  const action = positionals[0];
  if (action === 'init') {
    if (positionals.length !== 2) throw new Error('Usage: cmdhelp init zsh|powershell');
    console.log(shellInit(positionals[1])); return;
  }
  const shell = resolveShell(values.shell);
  if (action === 'doctor') {
    const config = await loadConfig();
    const client = await createClient(shell);
    console.log(`Config: ${config.configPath}\nProfile: ${config.profile}\nModel: ${client.label}\nReasoning: ${config.reasoning}\nTimeout: ${config.timeoutMs}ms\nCatalog loaded (no inference request made).`); return;
  }
  const mode = (action === 'ui' ? values.mode || 'suggest' : action) as Mode;
  if (!['suggest', 'explain'].includes(mode)) throw new Error('Expected suggest, explain, ui, or doctor.');
  if (action === 'ui') {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Interactive mode requires a terminal.');
    const initial = values['buffer-file'] ? await readFile(values['buffer-file'], 'utf8') : '';
    const { panel } = await import('./ui.ts');
    const selected = await panel(mode, initial, shell);
    if (selected && values['output-file']) await writeFile(values['output-file'], selected, { mode: 0o600 });
    else if (selected) console.log(selected);
    // The panel has drained input and settled any request/credential write.
    // Provider keep-alive sockets must not delay returning control to the shell.
    process.exit(0);
  }
  let prompt = positionals.slice(1).join(' ');
  if (!prompt && !process.stdin.isTTY) for await (const chunk of process.stdin) prompt += chunk;
  if (!prompt.trim()) throw new Error('Provide a prompt or pipe command text on stdin.');
  const client = await createClient(shell);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once('SIGINT', stop);
  let previous = '';
  try {
    await client.ask(mode, prompt, text => {
      const safe = clean(text);
      process.stdout.write(safe.slice(previous.length)); previous = safe;
    }, abort.signal);
    process.stdout.write('\n');
  } finally { process.removeListener('SIGINT', stop); }
}
main().catch(error => { console.error(`cmdhelp: ${clean(error.message)}`); process.exitCode = 1; });
