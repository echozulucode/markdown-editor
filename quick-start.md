# Quick Start — run the examples app

Get the **examples application** (the dev-harness) running in three commands.

## Prerequisites

- Node 20+
- pnpm 9+ — `npm i -g pnpm`

## Run it

```bash
pnpm install        # install workspace dependencies
pnpm -r build       # build every package's dist/ (the harness imports the built packages)
pnpm dev:harness    # start the Vite dev server
```

Open **http://localhost:5173**.

Use the left sidebar to explore: **/markdown** (source), **/modes** (all modes + switching), **/renderers** (Shiki/Mermaid/PlantUML), **/examples** (host shells), plus **/responsive**, **/accessibility**, **/performance**.

## Notes

- If the port is taken, Vite picks the next free port and prints the URL (the config uses `strictPort: false`).
- After changing a package's source, rebuild it so the harness picks it up:
  ```bash
  pnpm -r build                                   # or one package:
  pnpm --filter @markdown-editor/react build
  ```
- Alternative to `pnpm dev:harness`:
  ```bash
  pnpm --filter @markdown-editor/dev-harness dev
  ```

## Run the tests (optional)

```bash
pnpm -r test        # unit/component tests across packages
pnpm test:e2e       # Playwright browser smoke (needs the harness; auto-starts it)
```
