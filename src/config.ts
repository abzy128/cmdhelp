import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import type { ModelThinkingLevel } from '@earendil-works/pi-ai';

export interface Config {
  configPath: string;
  profile: string;
  provider: string;
  model: string;
  reasoning: ModelThinkingLevel;
  timeoutMs: number;
}

async function objectFile(path: string): Promise<Record<string, unknown>> {
  let text: string;
  try { text = await readFile(path, 'utf8'); }
  catch (error: any) { if (error.code === 'ENOENT') return {}; throw new Error(`Cannot read configuration: ${path}`); }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new Error(`Expected a JSON object in ${path}`); }
}

function text(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string.`);
  return value;
}

function absolute(value: unknown, name: string, home: string): string {
  const path = text(value, name);
  const expanded = path === '~' ? home : path.startsWith('~/') ? join(home, path.slice(2)) : path;
  if (!isAbsolute(expanded)) throw new Error(`${name} must be an absolute path or start with ~/.`);
  return expanded;
}

export async function loadConfig(env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<Config> {
  const configPath = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'cmdhelp/config.json');
  const own = await objectFile(configPath);
  const allowed = new Set(['$schema', 'profile', 'provider', 'model', 'reasoning', 'timeoutMs']);
  for (const key of Object.keys(own)) if (!allowed.has(key)) throw new Error(`Unknown option "${key}" in ${configPath}`);
  const profile = absolute(env.CMDHELP_PI_PROFILE ?? own.profile ?? env.PI_CODING_AGENT_DIR ?? join(home, '.pi/agent'), 'profile', home);
  const pi = await objectFile(join(profile, 'settings.json'));
  const provider = env.CMDHELP_PROVIDER ?? own.provider ?? pi.defaultProvider;
  const model = env.CMDHELP_MODEL ?? own.model ?? pi.defaultModel;
  if (provider === undefined || model === undefined) throw new Error(`Set provider and model in ${configPath}, or select a default model in Pi.`);
  const reasoning = own.reasoning ?? 'off';
  if (!['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoning as string)) throw new Error('Invalid cmdhelp reasoning level.');
  const timeoutMs = own.timeoutMs ?? 30_000;
  if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300_000) throw new Error('timeoutMs must be an integer between 1000 and 300000.');
  return { configPath, profile, provider: text(provider, 'provider'), model: text(model, 'model'), reasoning: reasoning as ModelThinkingLevel, timeoutMs };
}
