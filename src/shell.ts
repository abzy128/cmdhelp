import { fileURLToPath } from 'node:url';

export function shellInit(shell: string): string {
  if (shell !== 'zsh') throw new Error('Only zsh shell integration is supported.');
  const path = fileURLToPath(new URL('../shell/cmdhelp.zsh', import.meta.url));
  return `source '${path.replaceAll("'", "'\\''")}'`;
}
