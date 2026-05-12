import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

type HarnessRoute = {
  id: string;
  label: string;
  path: string;
  description: string;
};

const routes: HarnessRoute[] = [
  {
    id: "markdown",
    label: "Markdown",
    path: "/markdown",
    description: "Raw source editing surface for CodeMirror and core round-trip checks."
  },
  {
    id: "renderers",
    label: "Renderers",
    path: "/renderers",
    description: "Fixture surface for code, Mermaid, PlantUML, tables, images, and callouts."
  },
  {
    id: "modes",
    label: "Mode Matrix",
    path: "/modes",
    description: "Host configuration checks for markdown, hybrid, preview, and WYSIWYG subsets."
  },
  {
    id: "responsive",
    label: "Responsive",
    path: "/responsive",
    description: "Phone, tablet, modal, compact, and full-page layout smoke coverage."
  },
  {
    id: "accessibility",
    label: "Accessibility",
    path: "/accessibility",
    description: "Keyboard, focus, labels, reduced motion, and error-state checks."
  },
  {
    id: "performance",
    label: "Performance",
    path: "/performance",
    description: "Mount, typing, mode-switch, lazy-renderer, and large-document perf probes."
  }
];

const sampleMarkdown = `---
title: Dev Harness Sample
---

# Markdown editor harness

This placeholder keeps Markdown as plain text until package APIs are ready.

- [ ] Preserve source bytes on no-op paths
- [ ] Exercise configured editor modes
- [ ] Render code and diagram blocks through safe adapters

\`\`\`ts
export const mode = "markdown";
\`\`\`

\`\`\`mermaid
graph TD
  Plan --> Harness
  Harness --> Packages
\`\`\`
`;

function getCurrentPath() {
  return window.location.pathname === "/" ? "/markdown" : window.location.pathname;
}

function App() {
  const [path, setPath] = React.useState(getCurrentPath);
  const [markdown, setMarkdown] = React.useState(sampleMarkdown);
  const activeRoute = routes.find((route) => route.path === path) ?? routes[0];

  React.useEffect(() => {
    const onPopState = () => setPath(getCurrentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Harness routes">
        <div>
          <p className="eyebrow">Dev Harness</p>
          <h1>Markdown Editor QA</h1>
        </div>
        <nav className="route-list" aria-label="Planned surfaces">
          {routes.map((route) => (
            <button
              key={route.id}
              className={route.path === activeRoute.path ? "route-button active" : "route-button"}
              type="button"
              onClick={() => navigate(route.path)}
              aria-current={route.path === activeRoute.path ? "page" : undefined}
            >
              {route.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-labelledby="route-title">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Phase 0/1 placeholder</p>
            <h2 id="route-title">{activeRoute.label}</h2>
            <p>{activeRoute.description}</p>
          </div>
          <div className="status-pill">No package internals imported</div>
        </header>

        <RoutePanel route={activeRoute} markdown={markdown} onMarkdownChange={setMarkdown} />
      </section>
    </main>
  );
}

function RoutePanel({
  route,
  markdown,
  onMarkdownChange
}: {
  route: HarnessRoute;
  markdown: string;
  onMarkdownChange: (value: string) => void;
}) {
  if (route.id === "markdown") {
    return (
      <div className="panel-grid">
        <section className="panel" aria-labelledby="source-title">
          <h3 id="source-title">Source Placeholder</h3>
          <textarea
            aria-label="Markdown source placeholder"
            value={markdown}
            onChange={(event) => onMarkdownChange(event.target.value)}
            spellCheck={false}
          />
        </section>
        <section className="panel" aria-labelledby="planned-title">
          <h3 id="planned-title">Planned Checks</h3>
          <CheckList
            items={[
              "Swap textarea for public MarkdownEditor when packages/react exists.",
              "Exercise controlled value, read-only mode, undo/redo, and selection restore.",
              "Compare saved source against initial bytes for no-op paths."
            ]}
          />
        </section>
      </div>
    );
  }

  if (route.id === "modes") {
    return (
      <section className="panel">
        <h3>Mode Configurations</h3>
        <div className="mode-grid">
          {["hybrid only", "markdown + preview", "wysiwyg only", "all modes", "read-only preview"].map((mode) => (
            <article className="mode-card" key={mode}>
              <strong>{mode}</strong>
              <span>Awaiting public API wiring.</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h3>{route.label} Surface</h3>
      <CheckList
        items={[
          "Keep this route stable for Playwright smoke coverage.",
          "Replace placeholder content through public package APIs only.",
          "Record route-specific gates in docs/test-matrix.md as behavior lands."
        ]}
      />
    </section>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
