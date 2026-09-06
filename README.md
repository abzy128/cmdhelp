# cmdhelp

Small zsh command tutor: suggest a command or explain shell input, then return to your prompt. Uses Pi AI and Pi TUI directly; no coding-agent process, shell execution tools, repo scanning, or background service.

## Use

Open a new terminal, or enable it in your existing shell:

```zsh
source ~/dev/personal/tools/cmdhelp/shell/cmdhelp.zsh
```

- **Ctrl-X, Ctrl-G**: describe the command you need. Existing shell input is included as context for modification.
- **Ctrl-X, Ctrl-E**: explain the current command; an empty buffer opens an input field.
- **Enter** submits your question. After a completed suggestion, **Enter** inserts the command into zsh without executing it.
- **Tab** opens a follow-up input after an answer. **Up/Down** scroll the answer.
- **Escape / Ctrl-C** cancel and restore the original shell buffer and cursor.

```sh
cmdhelp suggest 'find files larger than 100 MiB'
cmdhelp explain 'git reset --soft HEAD~1'
cmdhelp explain < command.txt
cmdhelp doctor
```

Quote command arguments literally, especially `$()`, backticks, pipes, and redirections; stdin is also supported. CLI mode prints the answer; only the zsh widget inserts a selected command.

## Configuration

`~/.config/cmdhelp/config.json` (or `$XDG_CONFIG_HOME/cmdhelp/config.json`):

```json
{
  "provider": "openai-codex",
  "model": "gpt-5.6-sol",
  "reasoning": "low",
  "timeoutMs": 30000
}
```

Provider/model precedence: `CMDHELP_PROVIDER` / `CMDHELP_MODEL`, then cmdhelp config, then Pi profile settings. Reasoning defaults to `off` rather than inheriting Pi's agent reasoning level. Supported values: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` (provider support varies).

Profile precedence: `CMDHELP_PI_PROFILE`, config `profile`, `PI_SLIM_PROFILE_DIR`, then `~/.pi/dropcode`. Paths should be absolute. The profile supplies `auth.json`, `models-store.json`, and fallback settings. Built-in Pi providers are supported; custom `models.json` providers and extension-defined providers are not loaded.

Credentials stay in Pi's auth file. OAuth refresh uses Pi's file-lock protocol and preserves profile symlinks. An explicitly expired-token response triggers one refresh/retry within the same deadline. Other errors are surfaced without switching providers. Use Pi to log in if refresh is rejected. `doctor` checks local configuration/catalog; it does not verify authentication against a server.

Only the prompt, current shell input, OS/shell identity, and recent follow-ups in the current panel are sent to the selected provider. Conversations are not saved. Shell handoff files are private and removed when the widget finishes. No shell history, environment dump, or project files are sent as prompt context. Generated commands can still be incorrect: they remain editable at the shell prompt.

## Install / develop

Requires Node >=22.19 and zsh.

```sh
npm ci
npm run check
npm test
zsh -n shell/cmdhelp.zsh
# macOS pseudo-terminal integration checks:
/usr/bin/script -q /dev/null zsh test/widget.zsh
```

Source `shell/cmdhelp.zsh` from your zsh configuration. It defines both the command and widgets. For use outside interactive zsh, symlink `bin/cmdhelp` into a directory on PATH. Dependencies are versioned separately from globally installed Pi.

On this machine, the source hook lives in `~/dev/personal/nix-abzy/home/abzy/zsh.nix`. Only its generated `.zshrc` was built and activated, rooted at `~/.local/state/cmdhelp-zshrc`; the original `.zshrc` symlink was retained at `~/.local/state/cmdhelp-original-zshrc`. A future normal Nix activation will manage `.zshrc` again with the source hook included. Existing terminal sessions still need the source command above.

For removal, remove the hook from the Nix source and rebuild your shell config, and remove `~/.pi/agent/bin/cmdhelp`. The cmdhelp checkout/config can then be removed. Pi's credentials are shared, so do not delete them.

## Validation on this machine

Live Codex-subscription requests with `gpt-5.6-sol`, low reasoning: explain completed in 10.2 seconds including an expired-token refresh; a subsequent suggestion completed in 6.2 seconds. These are individual full-response measurements, not guaranteed latency. The UI renders before the network request and streams text as it arrives.
