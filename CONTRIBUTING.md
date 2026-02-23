# Contributing to Astro Analytics

Thanks for your interest in contributing. This document covers development setup, tests, and packaging.

## Development

This project uses **pnpm** only. Do not run `npm install` — it will report many "missing" peer/optional dependency warnings and can leave the workspace in an inconsistent state.

```bash
pnpm install
pnpm run compile   # builds TypeScript + bundle (dist/extension.js)
# F5 in VS Code → opens Extension Development Host
```

For incremental TypeScript build: `pnpm run watch` (then optionally `pnpm run bundle` to refresh the extension).

### Commands not found after changes

If the command **"Astro Analytics: Test API Connection"** (or others) is not found after code changes:

- **Extension Development Host (F5):** Run `pnpm run compile` (or `pnpm run bundle`), then in the *Extension Development Host* window: `Cmd+Shift+P` → **Developer: Reload Window**.
- **Installed from VSIX:** Run `pnpm run compile`, then repackage and reinstall the `.vsix`.

## Tests

**Unit tests (Vitest)** in `tests/` — e.g. `tests/lib/slug.test.ts`:

```bash
pnpm test
```

Watch mode: `pnpm run test:watch`

**Integration tests** (launch extension in VS Code and verify commands):

```bash
pnpm run test:integration
```

(Note: No other VS Code window should be running when you start the tests from the command line.)

## Packaging

To build a `.vsix` for local installation or distribution:

```bash
pnpm install
pnpm run compile
pnpx vsce package --no-dependencies --allow-missing-repository
```

Install the generated `.vsix` in VS Code: `Cmd+Shift+P` → **"Install from VSIX..."**.
