# Release Checklist

Use this checklist for v0.3.1 and later releases. Repository preparation does
not authorize a tag, npm publication, GitHub release, or Marketplace change.

## Code and Contracts

- [ ] Working tree is clean and the release branch is approved.
- [ ] Package manifests, engine constants, Action metadata, changelog, and
      release notes use the same version.
- [ ] Every changed rule has passing/failing fixtures, exact assertions, and a
      Markdown snapshot.
- [ ] Base-policy, checkout-free, no-runtime-LLM guarantees still hold.
- [ ] Root and package-local Action metadata deep equality passes.
- [ ] Committed Action bundle is fresh and works on Node 24.

## Verification

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm format:check`
- [ ] `pnpm audit`
- [ ] Unsafe PR zoo replay succeeds.
- [ ] Packed CLI installs in an empty directory on supported Node/OS matrix.
- [ ] Tarball has no `workspace:*` or private runtime dependency.
- [ ] Compressed/unpacked sizes are within 2MB/5MB.

## Before Publishing

- [ ] Recheck that the exact `@jinhyuk9714/agent-gate` npm name is available and owned by
      the intended publisher; stop if it is not.
- [ ] Confirm release environment approval and first-publish `NPM_TOKEN`.
- [ ] Confirm publish workflow uses full-SHA third-party Actions, minimal
      permissions, and the exact version tag.
- [ ] Create a signed annotated tag only after explicit approval.

## Publish Order

- [ ] Publish the tested tarball with `--provenance --access public`.
- [ ] Verify a cold `npx --yes @jinhyuk9714/agent-gate@VERSION --version` and public scan.
- [ ] Publish a non-prerelease GitHub release.
- [ ] Confirm Marketplace shows the same version and install ref.
- [ ] Configure npm Trusted Publisher and remove the first-publish token.
- [ ] Run the external checkout-free Action smoke with a full SHA pin.
- [ ] Add real report/GIF proof in a post-release PR.
- [ ] Publish launch content only after the proof PR is merged.

## Never

- Do not rewrite tags or publish a mutable `v0` alias.
- Do not publish a different tarball from the one tested.
- Do not fabricate CLI screenshots or claim an external adopter without proof.
