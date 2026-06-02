# Publishing `@echozedlabs/*` to npm

This is the operator runbook for releasing the editor packages. It covers the npm
account, **exactly which token to create**, **where to paste it**, and how the
first and ongoing releases work.

You publish **5 packages** together (they're version-locked):

- `@echozedlabs/core`
- `@echozedlabs/codemirror`
- `@echozedlabs/renderers`
- `@echozedlabs/wysiwyg-lexical`
- `@echozedlabs/react` ← the one consumers install

There are two ways to publish:

- **Automated (recommended):** push to `main`; a GitHub Action publishes using a token stored as a repo secret. Set this up once (Steps 1–5), then you rarely touch tokens again.
- **Manual (fallback):** publish from your laptop with `npm login` + `pnpm release`.

Do Steps 1–5 once. Steps 6–8 are per release.

---

## Prerequisites checklist

- [ ] An npm account (https://www.npmjs.com/signup)
- [ ] The **`echozedlabs`** npm organization exists and you're an owner (you created it)
- [ ] You can push to `github.com/echozulucode/markdown-editor`
- [ ] Node 20+ and pnpm 9+ locally (only needed for the manual path)

---

## Step 1 — Secure your npm account (2FA)

1. Sign in at https://www.npmjs.com.
2. Click your avatar → **Account** → **Two-Factor Authentication** → enable it (**Authorization and Publishing**). Use an authenticator app (1Password, Authy, Google Authenticator).
3. Save the recovery codes somewhere safe.

> Why: 2FA protects your account. The **token** you create below is what lets CI publish *without* needing your 2FA code each time — your password/2FA are never put in CI.

---

## Step 2 — Confirm the org and free public publishing

1. Go to https://www.npmjs.com/settings/echozedlabs/packages (or avatar → **echozedlabs** org).
2. Confirm you're an **Owner**.
3. Nothing to pay: **public** packages under an org are free and unlimited. (Our `package.json`s already set `"publishConfig": { "access": "public" }`, so they publish publicly even though they're scoped.)

---

## Step 3 — Create the npm token (the important part)

You need a token that can **publish** packages under the `@echozedlabs` scope. Use a
**Granular Access Token** (preferred). A Classic Automation token is the simpler
fallback if the granular flow gives you trouble on the very first publish.

### Option A — Granular Access Token (recommended)

1. npm → avatar → **Access Tokens**: https://www.npmjs.com/settings/<your-username>/tokens
2. Click **Generate New Token** → **Granular Access Token**.
3. Fill it in:
   - **Token name:** `echozedlabs-publish-ci` (any label you'll recognize)
   - **Expiration:** 90 days is a good default (you'll rotate it; see Step 9). You can choose longer, but npm caps granular tokens — set a calendar reminder to renew.
   - **Packages and scopes → Permissions:** **Read and write** ← required to publish
   - **Packages and scopes → Select scopes:** choose the **`@echozedlabs`** scope/organization. (Selecting the *scope* — not individual packages — is what lets you publish the **brand-new** package names that don't exist on npm yet.)
   - **Organizations:** if a separate "Organizations" permission is shown, set **`echozedlabs` → Read and write** too.
   - Leave IP allowlist empty (GitHub Actions runners have dynamic IPs).
4. Click **Generate token**.
5. **Copy the token now** — it starts with `npm_…` and is shown **only once**. If you lose it, delete it and make a new one.

### Option B — Classic Automation token (fallback)

Use this if Option A blocks the first publish (e.g. "you do not have permission" on a name that doesn't exist yet).

1. npm → **Access Tokens** → **Generate New Token** → **Classic Token**.
2. Choose type **Automation**. (Automation tokens are designed for CI and are **exempt from the 2FA one-time-code prompt** at publish time.)
3. Generate, then **copy the `npm_…` value immediately**.

> Automation (classic) tokens are account-wide publish rights — more powerful than needed. Prefer the granular token and tighten it to `@echozedlabs` once the packages exist.

> ⚠️ **Do NOT use a Classic "Publish" / "Read and Publish" token.** If your account has 2FA enabled for publishing (Step 1), those tokens still demand a one-time code that CI can't provide, and the publish fails with:
> `E403 ... Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.`
> Only **Granular** (Option A) and **Classic _Automation_** (this option) tokens bypass 2FA in CI.

**Do not** paste this token into any file in the repo, commit it, or share it. It goes in exactly one place: the GitHub secret in Step 4 (and/or your local npm login in Step 6b).

---

## Step 4 — Paste the token into GitHub (where it goes)

The release workflow reads the token from a repository secret named **exactly** `NPM_TOKEN`.

1. Go to the repo on GitHub: `https://github.com/echozulucode/markdown-editor`
2. **Settings** (top tab) → left sidebar **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Set:
   - **Name:** `NPM_TOKEN`  ← must match exactly (the workflow uses `secrets.NPM_TOKEN`)
   - **Secret:** paste the `npm_…` token from Step 3
5. Click **Add secret**

That's the only place the token is stored. GitHub encrypts it and never shows it again. The workflow (`.github/workflows/release.yml`) maps it to `NODE_AUTH_TOKEN` at publish time.

> If you ever see the value again, you can't — that's expected. To change it, create a new token and **Update** the secret.

---

## Step 5 — Make the repository public

Provenance (the supply-chain attestation our workflow adds) **requires a public repo**, and you're open-sourcing anyway.

1. Repo → **Settings** → scroll to **Danger Zone** → **Change repository visibility** → **Public** → confirm.

> If you want to stay private for now, open `.github/workflows/release.yml` and delete the line `NPM_CONFIG_PROVENANCE: "true"` (and you can drop the `id-token: write` permission). Publishing still works; you just won't get provenance.

---

## Step 6 — Publish

### 6a — Automated (recommended)

1. Commit and push everything to `main`:
   ```bash
   git add -A
   git commit -m "chore: prepare @echozedlabs packages for publishing"
   git push origin main
   ```
2. Open the repo's **Actions** tab and watch the **Release** workflow.
   - On this first run there are **no pending changesets**, so the workflow runs `changeset publish`, which builds and publishes all 5 packages at **`0.1.0`**.
3. If it fails on auth, re-check Step 4 (secret name is exactly `NPM_TOKEN`) and Step 3 (token has **read and write** on the `@echozedlabs` scope).

### 6b — Manual (fallback, from your laptop)

```bash
# from the markdown-editor repo root
npm login                 # opens a browser; signs you in (uses your 2FA)
pnpm install
pnpm release              # = pnpm -r build && changeset publish
```

If 2FA prompts for a one-time code during publish, enter it, or pass it inline:

```bash
npm publish --otp=123456   # only if a single package needs it
```

> The manual path uses your interactive npm login, **not** the `NPM_TOKEN` secret. You only need the GitHub secret for the automated path.

---

## Step 7 — Verify

```bash
npm view @echozedlabs/react
npm view @echozedlabs/react version     # -> 0.1.0
```

Or visit https://www.npmjs.com/package/@echozedlabs/react. Then sanity-check a real install in a scratch folder:

```bash
npm i @echozedlabs/react react react-dom
```

---

## Step 8 — Cutting future releases (Changesets)

You won't hand-edit versions again. For each change that consumers should see:

1. Make your code change.
2. Record it:
   ```bash
   pnpm changeset
   ```
   Pick a bump (patch/minor/major) and write a one-line summary. Commit the file it creates under `.changeset/`.
3. Merge to `main`. The **Release** workflow opens a **"Version Packages"** pull request that applies the bump + updates changelogs.
4. **Merge that PR.** The workflow then publishes the new versions to npm automatically.

(The 5 packages are version-locked, so one changeset bumps them all together.)

---

## Step 9 — Token hygiene

- **Rotate** the token before it expires: create a new one (Step 3), **Update** the `NPM_TOKEN` secret (Step 4), delete the old token on npm.
- **Least privilege:** once the packages exist, re-scope the granular token to just the `@echozedlabs` packages with read+write.
- **Never** commit a token or paste it in code/PRs. If one leaks, delete it on npm immediately (avatar → Access Tokens → trash icon) and rotate.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `ENEEDAUTH` / `401 Unauthorized` in CI | `NPM_TOKEN` secret missing, misnamed, or expired. Re-do Steps 3–4. The name must be exactly `NPM_TOKEN`. |
| `E403` / "**Two-factor authentication or granular access token with bypass 2fa enabled is required**" | The token is a Classic **Publish** token, which can't bypass 2FA in CI. Replace it with a **Granular** token (3A) or a Classic **Automation** token (3B), **Update** the `NPM_TOKEN` secret, and re-run the workflow. `changeset publish` skips any version already on npm, so no version bump is needed. |
| `403 Forbidden` / "you do not have permission to publish" | Token lacks **write**, or isn't scoped to `@echozedlabs`. For brand-new names, scope the token to the **org/scope** (Step 3A) or use a Classic **Automation** token (3B). |
| `402 Payment Required` | Scoped package defaulting to private. Our `publishConfig.access` is `public`, so this usually means the token/org can't publish public — confirm org ownership (Step 2). |
| `EOTP` / "one-time password required" | You're publishing with an interactive login + 2FA. Use `--otp=######`, or use an **Automation/Granular** token (CI path) which is OTP-exempt. |
| Provenance step fails | Repo isn't public, or `id-token: write` permission missing. Make the repo public (Step 5) or remove `NPM_CONFIG_PROVENANCE` from the workflow. |
| `EPUBLISHCONFLICT` / "cannot publish over previously published version" | That version already exists. Add a changeset and let it bump (Step 8); you can't re-publish the same version. |
| CI says lockfile out of date | Run `pnpm install` locally, commit the updated `pnpm-lock.yaml`. |

---

## Appendix — Tokenless publishing (OIDC trusted publishing)

Once you've published at least once, you can switch CI to **trusted publishing** and
**delete the `NPM_TOKEN` secret entirely** — npm trusts GitHub Actions directly via
OIDC, so there's no long-lived token to rotate.

1. On npm: package → **Settings** → **Trusted Publisher** → add the GitHub repo
   `echozulucode/markdown-editor` and the workflow `release.yml`.
2. In `release.yml`, the `id-token: write` permission (already present) is what enables this.
3. Remove the `NODE_AUTH_TOKEN` env line and delete the `NPM_TOKEN` repo secret.

This is the most secure setup, but it requires the package to already exist on npm, so do your first release with the token (Steps 3–6), then switch.
