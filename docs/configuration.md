# Configuration

cmdhelp stores application preferences separately from credentials. It can use Pi's saved login or the selected provider's API-key environment variable. It does not launch Pi or load Pi extensions.

## Existing Pi login

By default cmdhelp reads `~/.pi/agent`:

- `settings.json`: fallback provider and model.
- `auth.json`: provider credentials.
- `models-store.json`: cached model definitions.

If Pi is already configured, run `cmdhelp doctor` to see the effective profile and model.

To set up Pi, follow its [installation and authentication guide](https://github.com/earendil-works/pi/tree/main/packages/coding-agent), or install its CLI with Bun:

```sh
bun add --global @earendil-works/pi-coding-agent
pi
```

In Pi, use `/login` to authenticate, then `/model` to select a model. Save it as the startup default in the model picker, or set `provider` and `model` explicitly in cmdhelp's config. For a Codex subscription, choose the OpenAI Codex provider in Pi's login flow; its provider ID is `openai-codex`.

If a model is absent from the local catalog, refresh Pi's model cache with `pi update --models`. For a custom profile, run Pi with that same `PI_CODING_AGENT_DIR`.

cmdhelp automatically refreshes supported OAuth credentials and saves refreshed tokens in the shared auth file. An expired-token server response triggers one refresh/retry within the request deadline. Failed refreshes require signing in again through Pi. It does not read the Codex application's own auth file.

## Application config

Create `~/.config/cmdhelp/config.json`, or `$XDG_CONFIG_HOME/cmdhelp/config.json` when `XDG_CONFIG_HOME` is set. The file is optional if Pi supplies a default provider and model.

```json
{
  "reasoning": "low",
  "timeoutMs": 30000
}
```

A minimal template is included at [`config.example.json`](../config.example.json). Copy it to your configuration directory if you do not already have a config file.

| Option | Default | Meaning |
| --- | --- | --- |
| `provider` | Pi's `defaultProvider` | Pi provider ID, such as `openai` or `openai-codex` |
| `model` | Pi's `defaultModel` | Exact model ID for the selected provider |
| `profile` | `~/.pi/agent` | Pi profile directory; absolute paths and `~/` are supported |
| `reasoning` | `off` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`; provider support varies |
| `timeoutMs` | `30000` | Request deadline, an integer from 1000 to 300000 milliseconds |

Reasoning does not inherit Pi's agent setting. Unknown option names, malformed JSON, relative profile paths, and invalid values produce an error instead of silently using a default.

To choose a provider/model explicitly, for example with an OpenAI API key:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "reasoning": "off",
  "timeoutMs": 30000
}
```

Choose a model available to your account and present in the local catalog. cmdhelp does not silently switch models or providers when a request fails.

## API keys without Pi

A Pi installation is optional for providers that accept API-key environment variables. With the OpenAI configuration above, set `OPENAI_API_KEY` using your normal secret-management method and run cmdhelp. No Pi profile files are required for models in the bundled catalog.

Other built-in providers use their corresponding variables, such as `ANTHROPIC_API_KEY`. Authentication behavior follows [Pi AI's provider documentation](https://github.com/earendil-works/pi/tree/main/packages/ai). Avoid placing credentials in the cmdhelp configuration file.

## Custom profiles and overrides

A custom profile can be set in config:

```json
{
  "profile": "~/.pi/my-profile",
  "reasoning": "low"
}
```

Environment overrides are also supported:

| Variable | Overrides |
| --- | --- |
| `CMDHELP_PROVIDER` | Config and Pi default provider |
| `CMDHELP_MODEL` | Config and Pi default model |
| `CMDHELP_PI_PROFILE` | Config and Pi profile environment setting |
| `PI_CODING_AGENT_DIR` | Default profile when neither cmdhelp override is set |
| `XDG_CONFIG_HOME` | Directory containing `cmdhelp/config.json` |

Provider/model precedence: cmdhelp environment override → cmdhelp config → Pi settings. Set both when changing providers to avoid inheriting a model from a different provider.

Profile precedence: `CMDHELP_PI_PROFILE` → config `profile` → `PI_CODING_AGENT_DIR` → `~/.pi/agent`.

## Limits

Only built-in Pi providers and cached model definitions are supported. Pi extensions, custom `models.json` providers, prompt templates, and skills are not loaded. Follow-up context exists only for the current panel. `doctor` checks the local configuration/catalog, not whether your credentials are accepted by the server.
