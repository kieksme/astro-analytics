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

For publishing to the VS Code Marketplace, the `repository` field in `package.json` must be set (it is used for links on the Marketplace page). This project already has it configured.

## Releases and versioning (Release Please)

This project uses [Release Please](https://github.com/googleapis/release-please) to automate version bumps, changelog updates, and GitHub Releases. The extension is **not** published to npm; it is published to the VS Code Marketplace when a GitHub Release is created (see Automated publishing below).

**Conventional commits:** Use [Conventional Commits](https://www.conventionalcommits.org/) on the default branch so Release Please can determine the next version and changelog entries:

- `feat: ...` → minor version bump
- `fix: ...` → patch version bump
- `fix!: ...` or `feat!: ...` (breaking) → major version bump
- `chore: ...`, `docs: ...`, etc. → no version bump by default (can be configured)

**Setup (once per repository):** Add a **GitHub Personal Access Token (PAT)** as a repository secret named **`RELEASE_PLEASE_TOKEN`**. The PAT must have `repo` scope (or at least contents and pull-requests). Create it under GitHub → Settings → Developer settings → Personal access tokens. Do not use the default `GITHUB_TOKEN` for this workflow; Release Please requires a PAT.

**Flow:**

1. Push conventional commits to `main` → the [release-please](.github/workflows/release-please.yml) workflow creates or updates a **Release PR**. That PR updates the **version** in `package.json` and the release notes in `CHANGELOG.md`; do not bump the version in `package.json` manually when using this flow.
2. Merge the Release PR → Release Please creates the version tag (e.g. `0.5.5`) and the **GitHub Release**.
3. The [Publish VS Code Extension](.github/workflows/publish-vscode-extension.yml) workflow runs on `release: published` and publishes the extension to the Marketplace.

Configuration: [release-please-config.json](release-please-config.json) (single Node package, no npm publish). The `version` field in `package.json` is maintained by Release Please via the release PR.

## Publishing to the VS Code Marketplace

This section describes how to publish the extension to the [VS Code Marketplace](https://marketplace.visualstudio.com/vscode) so it is publicly installable.

### Prerequisites

- **Node.js** and **pnpm** (see Development above).
- A **Microsoft account** linked to [Azure DevOps](https://azure.microsoft.com/services/devops/) for Marketplace authentication.

### Create a publisher

Every extension needs a **publisher** identity on the Marketplace.

1. Open the [Visual Studio Marketplace publisher management page](https://marketplace.visualstudio.com/manage).
2. Sign in with your Microsoft account.
3. Click **Create publisher** and set:
   - **ID:** Must match the `publisher` field in `package.json` exactly (this project uses `kieksme`). The ID cannot be changed later.
   - **Name:** Display name for your publisher (e.g. company or brand).

### Authentication (Entra ID vs. PAT)

**Microsoft recommends [Entra ID](https://learn.microsoft.com/en-us/entra/id)** (Microsoft Entra ID) for authenticating with Azure DevOps and the Marketplace when the tool supports it: short-lived tokens, better security, and integration with Conditional Access. Use Entra ID where your workflow supports it.

**For vsce** (the publish CLI), authentication is currently done via a **Personal Access Token (PAT)** from Azure DevOps. Use a PAT only with the **minimum required scope** (Marketplace → Manage) and a **short expiration**, and store it like a password.

**Create a PAT (when using vsce):**

1. Go to the [Azure DevOps portal](https://dev.azure.com) and select your organization.
2. Open **User settings** (dropdown next to your profile) → **Personal access tokens**.
3. Click **New Token**.
4. Under **Scopes**, choose **Custom defined**, then find **Marketplace** and select **Manage**.
5. Set an expiration (e.g. 90 days) and create the token. **Copy it immediately** (it is shown only once).

Store the token securely and **never commit it**. For local publishing you can use a `.env` file (add `VSCE_PAT=your-token` and ensure `.env` is in `.gitignore`) or set the `VSCE_PAT` environment variable when running publish.

### Pre-publish checklist

Before publishing (when not using the Release Please flow):

- **Version:** Bump the version in `package.json` if needed (use [SemVer](https://semver.org/)). When using [Release Please](#releases-and-versioning-release-please), the version in `package.json` is updated automatically by the release PR — do not edit it manually for releases.
- **CHANGELOG.md:** Add an entry for the new version; this content is shown as **Release Notes** on the Marketplace page. When using Release Please, the changelog is updated automatically by the release PR.
- **Build:** Run `pnpm run compile` (or `pnpm run build`) so `dist/extension.js` is up to date.
- **Content:** Ensure README and CHANGELOG do not use user-provided SVG images (only [approved badges](https://code.visualstudio.com/api/references/extension-manifest#approved-badges) are allowed). Image URLs must use `https://`. The extension icon in `package.json` must be a PNG (e.g. `icon.png`).
- **License:** The Marketplace expects a LICENSE file in the project root; this project provides `LICENSE.md`.

### Publish command

**One-time login** (if not using `VSCE_PAT`):

```bash
pnpx vsce login <publisher-id>
```

Use the **exact** `publisher` value from `package.json` as `<publisher-id>`. For this repo it is `kieksme`, so:

```bash
pnpx vsce login kieksme
```

Enter your PAT when prompted. Alternatively, set the `VSCE_PAT` environment variable (e.g. from `.env`) and skip login.

**Publish:**

```bash
pnpm run compile
pnpx vsce publish
```

Or use the convenience script (compile + publish):

```bash
pnpm run publish
```

To bump the version and publish in one step:

```bash
pnpx vsce publish minor    # e.g. 0.5.0 → 0.6.0
pnpx vsce publish patch    # e.g. 0.5.0 → 0.5.1
pnpx vsce publish 1.0.0     # set exact version
```

If you run `vsce publish` in a Git repository, it may create a version commit and tag (via npm-version). You can pass a custom commit message with `-m "Release %s"`.

### Automated publishing with GitHub Actions

A workflow is provided to publish the extension from GitHub without running `vsce` locally.

**Setup (once per repository):**

1. In your GitHub repo: **Settings → Secrets and variables → Actions**.
2. Add a repository secret named **`VSCE_PAT`** with the value of your Azure DevOps PAT (Marketplace → Manage scope).

**Workflow file:** [`.github/workflows/publish-vscode-extension.yml`](.github/workflows/publish-vscode-extension.yml)

**How it runs:**

- **On release (recommended):** When a **GitHub Release** is created (e.g. by merging a [Release Please](.github/workflows/release-please.yml) release PR), this workflow runs, checks out the release tag, builds, and runs `vsce publish`. Release Please ensures `package.json` and `CHANGELOG.md` are updated before the tag is created.
- **Manual release:** You can also [create a GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-your-repository) manually (e.g. tag `v0.6.0`); then ensure that tag has the correct version in `package.json` and `CHANGELOG.md`.
- **Manual run (no release):** In the **Actions** tab, select **Publish VS Code Extension** and click **Run workflow**. It will use the default branch (`main`) to build and publish.

After a successful run, the new version appears on the [VS Code Marketplace](https://marketplace.visualstudio.com/vscode) and in the publisher management page.

For more options (e.g. publishing from a branch or other triggers), see [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration) in the VS Code docs.
