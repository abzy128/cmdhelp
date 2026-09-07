# Publishing

The npm package is `@abzy128/cmdhelp`; the executable remains `cmdhelp`. It ships TypeScript source, the Bun launcher, zsh integration, and documentation. There is no build step. Consumers need Bun 1.4+ and zsh on macOS or Linux.

## Validate the package

Use Bun 1.4+, Node 24 with npm 11.15.0 or newer, and zsh. CI pins npm to 11.19.0 for staged publishing:

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

Complete npm's authentication/2FA prompt. `publishConfig` sets public access and the npmjs registry. This uploads the package contents publicly.

In the package settings on npmjs.com, add a GitHub Actions trusted publisher:

| Field | Value |
| --- | --- |
| Organization or user | `abzy128` |
| Repository | `cmdhelp` |
| Workflow filename | `publish.yml` |
| Environment | Leave blank |
| Allowed actions | Staged publishing only; leave direct `npm publish` unchecked |

The workflow uses GitHub-hosted runners and `id-token: write` for [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/); no npm token secret is needed. Provenance is automatic for eligible public repositories.

If you already enabled direct publishing, disable it in the trusted publisher settings (recreate the configuration if npm does not allow editing it). Enable 2FA on your npm account. CI must only be allowed to stage packages; approval happens through your interactive npm session. Check other trusted publishers and write tokens too: this configuration does not revoke their access.

Actions are pinned to commit SHAs. Application installation and tests run in a separate job without OIDC permissions. The staging job installs no application dependencies and disables package lifecycle scripts; it stages source directly from the release commit after checks pass.

## Subsequent releases

1. Update `version` in `package.json` to an unused version, and commit the change with the release contents.
2. Push the commit and create a GitHub release with the matching `v<version>` tag, for example `v0.2.1`. The tag must point at that commit.
3. Publish the GitHub release. `.github/workflows/publish.yml` runs the full macOS/Linux checks, including tarball installation, then stages the package on npm.
4. Open **Staged Packages** on npmjs.com. Review the version and staged contents against your intended release, then approve with 2FA. Only this approval makes the package publicly available.

Stable releases request `latest`. For prereleases, use a version such as `0.3.0-beta.1`, tag it `v0.3.0-beta.1`, and mark the GitHub release as a prerelease; these request `next`. Tags take effect on approval. The workflow rejects a mismatched tag or prerelease flag. Draft releases do not stage packages.

You can also inspect and approve from an authenticated local CLI:

```sh
npm stage list @abzy128/cmdhelp
npm stage view <stage-id>
npm stage download <stage-id>
npm stage approve <stage-id>
# If the contents are unexpected:
npm stage reject <stage-id>
```

See [npm staged publishing](https://docs.npmjs.com/staged-publishing/) for the review process. Approval requires 2FA and cannot use CI's OIDC credentials. Do not approve an unexpected staged upload solely because CI is green.

Do not reuse a version already published or pending in staging. A successful CI run means the package is awaiting approval, not that it is public. A GitHub release remains published if staging fails or approval is pending; verify npm availability before announcing it.

The release trigger does not enforce main-branch ancestry or a particular actor. Use repository rules to protect release tags and the main branch; staging approval remains the final publication gate.
