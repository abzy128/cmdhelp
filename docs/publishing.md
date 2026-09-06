# Publishing

The npm package is `@abzy128/cmdhelp`; the executable remains `cmdhelp`. It ships TypeScript source, the Bun launcher, zsh integration, and documentation. There is no build step. Consumers need Bun 1.4+ and zsh on macOS or Linux.

## Validate the package

Use Bun 1.4+, Node 24 with npm 11.5.1 or newer, and zsh:

```sh
bun install --frozen-lockfile
bun run check
bun test
zsh -n shell/cmdhelp.zsh
bun run test:package
npm pack --dry-run
```

Also run the [pseudo-terminal widget check](installation.md#verification). The package check installs a real npm tarball into a temporary global prefix and verifies its executable and shell initialization, without credentials or model requests. It needs registry access to install dependencies and removes its temporary files afterward.

`files` in `package.json` limits the published contents. `prepublishOnly` runs type checking and unit tests before a local source publish.

## First publish and trusted publisher setup

If the package does not yet exist, publish its current version once from a validated checkout using an npm account with access to the `@abzy128` scope:

```sh
npm login --registry=https://registry.npmjs.org/
npm publish
```

Complete npm's authentication/2FA prompt. `publishConfig` sets public access and the npmjs registry. This uploads the package contents publicly even while the GitHub repository is private.

In the package settings on npmjs.com, add a GitHub Actions trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `abzy128` |
| Repository | `cmdhelp` |
| Workflow filename | `publish.yml` |
| Environment | Leave blank |
| Allowed actions, if shown | Allow direct `npm publish` |

The workflow uses GitHub-hosted runners and `id-token: write` for [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/); no npm token secret is needed. Provenance is automatic for eligible public repositories. The workflow does not force provenance because the repository is currently private.

## Subsequent releases

1. Update `version` in `package.json` to an unused version, and commit the change with the release contents.
2. Push the commit and create a GitHub release with the matching `v<version>` tag, for example `v0.2.1`. The tag must point at that commit.
3. Publish the GitHub release. `.github/workflows/publish.yml` runs the full macOS/Linux checks, including tarball installation, then publishes to npm.

Stable releases publish to `latest`. For prereleases, use a version such as `0.3.0-beta.1`, tag it `v0.3.0-beta.1`, and mark the GitHub release as a prerelease; these publish to `next`. The workflow rejects a mismatched tag or prerelease flag. Draft releases do not publish.

Do not trigger the workflow for the version already uploaded during bootstrap: npm versions cannot be republished. Use the next version for the first automated release. A GitHub release remains published if npm publishing fails; inspect the Actions result before announcing availability.
