import { fileURLToPath } from 'node:url';

export type Shell = 'zsh' | 'powershell';

export function resolveShell(value = process.platform === 'win32' ? 'powershell' : 'zsh'): Shell {
  if (value !== 'zsh' && value !== 'powershell') throw new Error('Expected shell: zsh or powershell.');
  return value;
}

export function shellInit(shell: string): string {
  resolveShell(shell);
  const path = fileURLToPath(new URL(`../shell/cmdhelp.${shell === 'powershell' ? 'ps1' : 'zsh'}`, import.meta.url));
  if (shell === 'powershell') return `. '${path.replaceAll("'", "''")}'`;
  return `source '${path.replaceAll("'", "'\\''")}'`;
}
