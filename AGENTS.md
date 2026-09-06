# Repository Guidelines

## Project Structure & Module Organization

cmdhelp is a Bun/TypeScript command assistant for zsh on macOS and Linux. `bin/cmdhelp` launches `src/cli.ts`. Keep configuration loading in `src/config.ts`, provider requests and credentials in `src/core.ts`, terminal interaction in `src/ui.ts`, and shell initialization in `src/shell.ts`. The zsh widgets live in `shell/cmdhelp.zsh`. Tests are under `test/`; installation and configuration guides are under `docs/`. `config.example.json` provides a minimal configuration example.

## Build, Test, and Development Commands

Use Bun 1.4 or newer. TypeScript runs directly; there is no separate build step.

- `bun install --frozen-lockfile`: install the locked dependencies.
- `bun run start --help`: run the CLI from source.
- `bun run check`: run strict TypeScript checking without emitting files.
- `bun test`: run the Bun test suite.
- `zsh -n shell/cmdhelp.zsh`: check widget syntax.
- `script -q /dev/null zsh test/widget.zsh`: run widget checks in a pseudo-terminal on macOS. On Linux, use `script -qec 'zsh test/widget.zsh' /dev/null`.

## Coding Style & Naming Conventions

Follow the existing two-space indentation, single-quoted TypeScript strings, and semicolons. Use ES module imports with explicit `.ts` extensions for local modules. Use camelCase for functions and variables, PascalCase for types and classes, and short lowercase module filenames. No formatter or linter is configured; match nearby code and keep `bun run check` passing.

## Testing Guidelines

Use `bun:test` with `node:assert/strict`. Name TypeScript tests `test/*.test.ts` and describe observable behavior in test titles. Use temporary fixtures and clean them up; tests should not require real credentials or model requests. Cover affected configuration, credential, command-extraction, or widget behavior. No numeric coverage threshold is configured. Run the checks above before submitting; CI verifies both macOS and Linux.

## Commit & Pull Request Guidelines

The existing history uses short imperative subjects, such as “Make cmdhelp portable with Bun and setup guides.” Follow that style. PRs should describe the behavior change, list validation performed, and link related issues when applicable. Include terminal output or a recording for interactive changes, and update relevant guides when commands or configuration change.

## Security & Configuration

Preserve literal command insertion: suggestions must never execute automatically. Keep terminal-control sanitization, cancellation cleanup, and private handoff files intact. Store user configuration outside the checkout and never commit Pi credentials or API keys.
