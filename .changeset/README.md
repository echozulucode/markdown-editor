# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It
drives versioning, changelogs, and publishing for the `@echozedlabs/*` packages.

## Adding a changeset

When you make a change that should ship in a release, run:

```bash
pnpm changeset
```

Pick the affected packages and a semver bump (the five `@echozedlabs/*` packages
are **fixed**, so they version together), then write a short summary. Commit the
generated file under `.changeset/`.

## Releasing

CI (`.github/workflows/release.yml`) opens a "Version Packages" PR that applies the
pending changesets (bumping versions + updating changelogs). Merging that PR
publishes the packages to npm. To do it locally instead:

```bash
pnpm version-packages   # changeset version
pnpm release            # build all, then changeset publish
```
