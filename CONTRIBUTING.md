# Contributing

Thanks for your interest in improving the echozed markdown editor!

## Development

Requires **Node 20+** and **pnpm 9+** (`npm i -g pnpm`).

```bash
pnpm install
pnpm -r build        # build every package's dist/ (consumers + examples resolve from dist)
pnpm dev:harness     # run the examples app on http://localhost:5173
```

## Before opening a PR

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

For changes that affect what consumers see (features, fixes, breaking changes), add a changeset:

```bash
pnpm changeset
```

Pick the affected packages and a semver bump and write a short summary. Commit the generated file in `.changeset/`. The five `@echozedlabs/*` packages are versioned together (fixed), so a bump applies to all of them.

## Releasing (maintainers)

Merging changesets to `main` triggers the release workflow, which opens a "Version Packages" PR. Merging that PR publishes to npm with provenance. Requires an `NPM_TOKEN` repository secret with publish rights to the `@echozedlabs` scope.

## Code of conduct

Be respectful and constructive. By participating you agree to uphold a welcoming, harassment-free environment.
