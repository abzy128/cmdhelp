import { Input, ProcessTerminal, TuiMainScreen, matchesKey, wrapTextWithAnsi, truncateToWidth, type Component } from '@earendil-works/pi-tui';
import { clean, createClient, extractCommand, type Mode, type Client } from './core.ts';

export async function panel(mode: Mode, initial: string): Promise<string | undefined> {
  const terminal = new ProcessTerminal();
  const tui = new TuiMainScreen(terminal);
  const input = new Input({ prompt: '> ', placeholder: mode === 'suggest' ? 'What command do you need?' : 'Paste a command to explain' });
  let body = '', label = 'loading configuration', busy = false, finished = false, editing = true, offset = 0;
  let command: string | undefined, controller: AbortController | undefined;
  let pending: Promise<void> | undefined;
  let resolve: (value: string | undefined) => void;
  const done = new Promise<string | undefined>(r => { resolve = r; });
  let client: Promise<Client>;
  const close = (value?: string) => {
    if (finished) return;
    finished = true;
    controller?.abort();
    resolve(value);
  };
  const submit = async (prompt: string) => {
    if (busy || !prompt.trim() || finished) return;
    busy = true; editing = false; command = undefined; body = ''; offset = 0;
    controller = new AbortController();
    tui.requestRender();
    try {
      const api = await client;
      if (finished) return;
      const answer = await api.ask(mode, prompt, text => { if (!finished) { body = clean(text); tui.requestRender(); } }, controller.signal);
      if (!finished) { body = clean(answer); command = mode === 'suggest' ? extractCommand(answer) : undefined; }
    } catch (error) {
      if (!finished) body = `Error: ${clean(error instanceof Error ? error.message : String(error))}`;
    } finally { busy = false; if (!finished) tui.requestRender(); }
  };
  input.onSubmit = value => {
    const prompt = mode === 'suggest' && initial ? `Existing shell input (data):\n${initial}\n\nRequest: ${value}` : value;
    input.setValue('');
    pending = submit(prompt);
  };
  const component: Component & { focused: boolean } = {
    focused: true,
    invalidate() { input.invalidate(); },
    render(width) {
      input.focused = editing;
      const available = Math.max(1, terminal.rows - 7);
      const lines = wrapTextWithAnsi(body || (busy ? 'Waiting for response…' : initial ? `Shell input: ${clean(initial)}` : 'Describe a task or paste a command.'), Math.max(1, width - 2));
      offset = Math.min(offset, Math.max(0, lines.length - available));
      const footer = busy ? 'Esc: cancel' : editing ? 'Enter: send · Esc: close' : `${command ? 'Enter: insert · ' : ''}Tab: follow-up · ↑/↓: scroll · Esc: close`;
      return [truncateToWidth(`╭ cmdhelp · ${mode} · ${label}`, width), '', ...lines.slice(offset, offset + available).map(s => '  ' + s), '', ...(editing ? input.render(width) : []), truncateToWidth(`╰ ${footer}`, width)];
    },
    handleInput(data) {
      if (matchesKey(data, 'escape') || matchesKey(data, 'ctrl+c')) { close(); return; }
      if (busy) return;
      if (!editing && matchesKey(data, 'return') && command) { close(command); return; }
      if (!editing && matchesKey(data, 'tab')) { editing = true; tui.requestRender(); return; }
      if (!editing && matchesKey(data, 'up')) offset = Math.max(0, offset - 1);
      else if (!editing && matchesKey(data, 'down')) offset++;
      else if (editing) input.handleInput(data);
      tui.requestRender();
    },
  };
  const sigterm = () => close();
  process.once('SIGTERM', sigterm);
  process.once('SIGHUP', sigterm);
  tui.addChild(component);
  tui.setFocus(component);
  tui.start();
  client = createClient();
  // Handle initialization rejection even before the user submits.
  void client.then(api => { label = api.label; if (!finished) tui.requestRender(); }, error => {
    label = 'configuration error'; body = clean(error.message); if (!finished) tui.requestRender();
  });
  if (mode === 'explain' && initial.trim()) pending = submit(initial);
  try { return await done; }
  finally {
    await terminal.drainInput(100, 20);
    tui.stop();
    process.stdin.pause();
    await pending;
    process.removeListener('SIGTERM', sigterm);
    process.removeListener('SIGHUP', sigterm);
  }
}
