import React from "react";
import ReactDOM from "react-dom/client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold,
  faCheckSquare,
  faCode,
  faItalic,
  faListOl,
  faListUl
} from "@fortawesome/free-solid-svg-icons";
import {
  MarkdownEditor,
  type EditorDiagnostic,
  type EditorMode,
  type WysiwygToolbarIcons
} from "@markdown-editor/react";
import {
  createDefaultRendererRegistry,
  createMermaidRenderer,
  createPlantUmlRenderer,
  createShikiCodeRenderer,
  type RendererRegistry
} from "@markdown-editor/renderers";
import "@markdown-editor/react/styles.css";
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
    id: "examples",
    label: "Examples",
    path: "/examples",
    description: "Public API example shells for the required MVP host configurations."
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
- [x] Exercise configured editor modes
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

const rendererMarkdown = `# Renderer fixture

This route exercises the shared renderer pipeline through the public React component.

| Block | Expected behavior |
| --- | --- |
| TypeScript | Shiki highlighted |
| Unknown language | Plaintext fallback with warning |
| Mermaid | Rendered SVG diagram |
| PlantUML | Rendered through a host-provided demo service |

> [!warning] Renderer contract
> Invalid or missing renderers should report diagnostics without crashing the editor.

\`\`\`ts
type EditorMode = "markdown" | "hybrid" | "preview";

export function label(mode: EditorMode) {
  return \`Current mode: \${mode}\`;
}
\`\`\`

\`\`\`python
def normalize_title(value: str) -> str:
    return value.strip().title()
\`\`\`

\`\`\`madeup
const unsafe = "<tag>";
\`\`\`

\`\`\`mermaid
graph TD
  Markdown --> Renderer
  Renderer --> Preview
\`\`\`

\`\`\`mermaid
not a valid mermaid diagram
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: Preview renderer
Bob --> Alice: Diagnostics
@enduml
\`\`\`

![Inline renderer asset](data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20320%20120'%3E%3Crect%20width='320'%20height='120'%20rx='12'%20fill='%23edf7f2'/%3E%3Cpath%20d='M52%2076h216'%20stroke='%23243a31'%20stroke-width='10'%20stroke-linecap='round'/%3E%3Ccircle%20cx='96'%20cy='48'%20r='18'%20fill='%23f6c85f'/%3E%3Ccircle%20cx='160'%20cy='48'%20r='18'%20fill='%232f6f9f'/%3E%3Ccircle%20cx='224'%20cy='48'%20r='18'%20fill='%23945f43'/%3E%3C/svg%3E)
`;

const technicalDocsMarkdown = `---
title: Release Runbook
owner: Platform
published: true
---

# Release Runbook

Use this runbook to validate the editor inside a dense technical writing surface.

- [ ] Confirm migration notes
- [x] Validate renderer isolation
- [ ] Publish package notes

| Check | Owner | Status |
| --- | --- | --- |
| Syntax highlighting | Docs | Ready |
| Mermaid rendering | Platform | Ready |
| PlantUML rendering | Host | Demo |

\`\`\`ts
export function releaseChannel(version: string) {
  return version.includes("-") ? "preview" : "stable";
}
\`\`\`

\`\`\`mermaid
graph TD
  Draft --> Review
  Review --> Publish
\`\`\`

\`\`\`plantuml
@startuml
Docs -> Platform: Validate release
Platform --> Docs: Approved
@enduml
\`\`\`
`;

const knowledgeMarkdown = `---
title: Knowledge Note
area: Editor UX
---

# Knowledge Note

Hybrid mode should feel like a rendered note while keeping the active source line editable.

> [!note] Decision
> Keep Markdown as canonical source even when the document looks rendered.

- [[Renderer Registry]]
- [[WYSIWYG Adapter]]
- [[Host Services]]
`;

const articleMarkdown = `# Contributor Article

This WYSIWYG-only example is for nontechnical authors who should not need Markdown chrome.

## Publishing checklist

- [ ] Add summary
- [x] Attach diagram
- [ ] Request review

\`\`\`mermaid
graph LR
  Author --> Review
  Review --> Publish
\`\`\`
`;

const publishedDocsMarkdown = `---
title: Published API Guide
version: 0.1
---

# Published API Guide

The read-only example uses preview mode with renderer services and no editing toolbar.

## Supported modes

- Markdown source
- Hybrid source reveal
- WYSIWYG visual editing
- Read-only preview

\`\`\`tsx
<MarkdownEditor modes={["preview"]} readOnly value={markdown} />
\`\`\`
`;

const commentMarkdown = `Quick note for [[Release Runbook]]:

- [ ] Check mobile toolbar
`;

const reviewMarkdown = `# Authentication Notes

The token refresh section needs one more pass before the release guide is final.

> [!warning] Reviewer note
> Clarify whether mobile clients retry after a 401 or wait for foreground sync.

- [ ] Add retry matrix
- [ ] Link to [[Mobile Session Policy]]
- [x] Confirm copy with Security
`;

const quickEditMarkdown = `---
title: API Rate Limits
owner: Docs
---

# API Rate Limits

Update the burst limit note before publishing.

| Tier | Burst | Sustained |
| --- | ---: | ---: |
| Free | 60 | 30/min |
| Team | 300 | 180/min |
`;

const runbookMarkdown = `---
title: Incident Runbook
service: markdown-renderer
severity: sev2
---

# Incident Runbook

## Triage

1. Confirm the alert in [[Renderer Dashboard]].
2. Check queue depth and failed render counts.
3. Page the package owner if Mermaid or PlantUML failures exceed the threshold.

> [!danger] Customer impact
> Preview rendering can fail open to source fallback, but authoring must remain available.

\`\`\`bash
pnpm --filter @markdown-editor/renderers test -- --runInBand
pnpm --filter @markdown-editor/dev-harness test:e2e
\`\`\`

\`\`\`ts
export async function renderWithTimeout(markdown: string, signal: AbortSignal) {
  return renderMarkdown(markdown, { signal, timeoutMs: 2500 });
}
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant Alert
  participant OnCall
  participant Renderer
  Alert->>OnCall: Page
  OnCall->>Renderer: Disable failing adapter
  Renderer-->>OnCall: Source fallback active
\`\`\`

\`\`\`plantuml
@startuml
Monitor -> OnCall: Renderer failure spike
OnCall -> Service: Enable fallback
Service --> Monitor: Healthy
@enduml
\`\`\`
`;

const mobileNoteMarkdown = `# Standup

- [ ] Review gallery smoke tests
- [x] Check phone layout
- [ ] Capture [[Release Notes]] follow-up

## Notes

Keep the toolbar reachable and the editor wide enough for thumb typing.
`;

const promptMarkdown = `# Draft release note prompt

You are helping write the [[Release Runbook]] announcement.

Use these source pages:

- [[Renderer Registry]]
- [[WYSIWYG Adapter]]
- [[Mobile Session Policy]]

## Instructions

Summarize user-visible changes, list known limitations, and preserve exact package names.
`;

const baseConflictMarkdown = `# Release Checklist

- [x] Renderer smoke tests
- [ ] Mobile gallery pass
- [ ] Publish docs

The release owner signs off after the conflict resolver picks the final checklist.
`;

const incomingConflictMarkdown = `# Release Checklist

- [x] Renderer smoke tests
- [x] Mobile gallery pass
- [ ] Publish docs
- [ ] Announce WYSIWYG limitations

The release owner signs off after the conflict resolver picks the final checklist.
`;

const fontAwesomeToolbarIcons: WysiwygToolbarIcons = {
  bold: <FontAwesomeIcon icon={faBold} fixedWidth />,
  italic: <FontAwesomeIcon icon={faItalic} fixedWidth />,
  inlineCode: <FontAwesomeIcon icon={faCode} fixedWidth />,
  bulletedList: <FontAwesomeIcon icon={faListUl} fixedWidth />,
  numberedList: <FontAwesomeIcon icon={faListOl} fixedWidth />,
  checkboxList: <FontAwesomeIcon icon={faCheckSquare} fixedWidth />
};

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
            <p className="eyebrow">MVP fixture harness</p>
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
  const [diagnostics, setDiagnostics] = React.useState<EditorDiagnostic[]>([]);
  const rendererRegistry = React.useMemo(
    () =>
      createDefaultRendererRegistry({
        mermaid: createMermaidRenderer(),
        plantUml: createPlantUmlRenderer({
          renderPlantUml: async (source) => ({
            html: renderPlantUmlFixture(source)
          })
        }),
        shiki: createShikiCodeRenderer()
      }),
    []
  );

  if (route.id === "markdown") {
    return (
      <div className="panel-grid">
        <section className="panel" aria-labelledby="source-title">
          <h3 id="source-title">Public Component</h3>
          <MarkdownEditor
            ariaLabel="Markdown source harness"
            value={markdown}
            modes={["markdown"]}
            initialMode="markdown"
            onChange={onMarkdownChange}
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

  if (route.id === "renderers") {
    return (
      <div className="panel-grid renderer-grid">
        <section className="panel" aria-labelledby="renderer-preview-title">
          <h3 id="renderer-preview-title">Preview Renderer</h3>
          <MarkdownEditor
            ariaLabel="Renderer preview harness"
            value={rendererMarkdown}
            modes={["preview"]}
            initialMode="preview"
            readOnly
            renderers={rendererRegistry}
            onDiagnostics={setDiagnostics}
          />
        </section>
        <section className="panel" aria-labelledby="renderer-diagnostics-title">
          <h3 id="renderer-diagnostics-title">Diagnostics</h3>
          <DiagnosticList diagnostics={diagnostics} />
          <div className="fixture-source" aria-label="Renderer fixture source">
            <MarkdownEditor
              ariaLabel="Renderer fixture Markdown source"
              value={rendererMarkdown}
              modes={["markdown"]}
              initialMode="markdown"
              readOnly
            />
          </div>
        </section>
      </div>
    );
  }

  if (route.id === "modes") {
    return (
      <section className="panel">
        <h3>Mode Configurations</h3>
        <div className="mode-stack">
          <ModeCard title="hybrid only" modes={["hybrid"]} markdown={markdown} renderers={rendererRegistry} onMarkdownChange={onMarkdownChange} />
          <ModeCard title="markdown + preview" modes={["markdown", "preview"]} markdown={markdown} renderers={rendererRegistry} onMarkdownChange={onMarkdownChange} />
          <ModeCard title="wysiwyg only" modes={["wysiwyg"]} markdown={markdown} renderers={rendererRegistry} toolbarIcons={fontAwesomeToolbarIcons} onMarkdownChange={onMarkdownChange} />
          <ModeCard title="all modes" modes={["hybrid", "markdown", "preview", "wysiwyg"]} markdown={markdown} renderers={rendererRegistry} toolbarIcons={fontAwesomeToolbarIcons} onMarkdownChange={onMarkdownChange} />
          <ModeCard title="read-only preview" modes={["preview"]} markdown={markdown} renderers={rendererRegistry} readOnly onMarkdownChange={onMarkdownChange} />
        </div>
      </section>
    );
  }

  if (route.id === "examples") {
    return <ExamplesGallery renderers={rendererRegistry} />;
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

function ExamplesGallery({ renderers }: { renderers: RendererRegistry }) {
  const [technicalDocs, setTechnicalDocs] = React.useState(technicalDocsMarkdown);
  const [splitMarkdown, setSplitMarkdown] = React.useState(technicalDocsMarkdown);
  const [knowledge, setKnowledge] = React.useState(knowledgeMarkdown);
  const [article, setArticle] = React.useState(articleMarkdown);
  const [comment, setComment] = React.useState(commentMarkdown);
  const [review, setReview] = React.useState(reviewMarkdown);
  const [quickEdit, setQuickEdit] = React.useState(quickEditMarkdown);
  const [runbook, setRunbook] = React.useState(runbookMarkdown);
  const [mobileNote, setMobileNote] = React.useState(mobileNoteMarkdown);
  const [prompt, setPrompt] = React.useState(promptMarkdown);
  const [resolvedConflict, setResolvedConflict] = React.useState(incomingConflictMarkdown);

  return (
    <div className="examples-gallery" data-testid="examples-gallery">
      <ExampleShell
        id="full-page-docs"
        eyebrow="All modes"
        title="Full-page technical docs editor"
        description="A complete authoring surface with Markdown, hybrid, preview, and WYSIWYG available."
      >
        <MarkdownEditor
          ariaLabel="Full-page technical docs editor"
          value={technicalDocs}
          modes={["hybrid", "markdown", "preview", "wysiwyg"]}
          initialMode="hybrid"
          renderers={renderers}
          wysiwygToolbarIcons={fontAwesomeToolbarIcons}
          onChange={setTechnicalDocs}
        />
      </ExampleShell>

      <ExampleShell
        id="markdown-preview"
        eyebrow="Markdown + preview"
        title="Split source and preview workflow"
        description="A source-first documentation layout with an always-visible read-only preview."
      >
        <div className="example-split">
          <MarkdownEditor
            ariaLabel="Markdown plus preview source editor"
            value={splitMarkdown}
            modes={["markdown"]}
            initialMode="markdown"
            onChange={setSplitMarkdown}
          />
          <MarkdownEditor
            ariaLabel="Markdown plus preview rendered output"
            value={splitMarkdown}
            modes={["preview"]}
            initialMode="preview"
            readOnly
            renderers={renderers}
          />
        </div>
      </ExampleShell>

      <ExampleShell
        id="hybrid-knowledge"
        eyebrow="Hybrid only"
        title="Knowledge-base note editor"
        description="Document-first editing with rendered inactive blocks and no mode switcher."
      >
        <MarkdownEditor
          ariaLabel="Hybrid-only knowledge editor"
          value={knowledge}
          modes={["hybrid"]}
          initialMode="hybrid"
          renderers={renderers}
          onChange={setKnowledge}
        />
      </ExampleShell>

      <ExampleShell
        id="wysiwyg-contributor"
        eyebrow="WYSIWYG only"
        title="Contributor article editor"
        description="A visual editing surface for authors who should not need Markdown controls."
      >
        <MarkdownEditor
          ariaLabel="WYSIWYG-only contributor editor"
          value={article}
          modes={["wysiwyg"]}
          initialMode="wysiwyg"
          renderers={renderers}
          wysiwygToolbarIcons={fontAwesomeToolbarIcons}
          onChange={setArticle}
        />
      </ExampleShell>

      <ExampleShell
        id="published-docs"
        eyebrow="Read-only preview"
        title="Published documentation page"
        description="A preview-only publishing surface with properties rendered and all editing chrome removed."
      >
        <MarkdownEditor
          ariaLabel="Read-only published documentation"
          value={publishedDocsMarkdown}
          modes={["preview"]}
          initialMode="preview"
          readOnly
          renderers={renderers}
        />
      </ExampleShell>

      <ExampleShell
        id="comment-composer"
        eyebrow="Compact"
        title="Comment composer"
        description="A constrained Markdown composer suitable for review sidebars, comments, and quick notes."
      >
        <div className="comment-example">
          <MarkdownEditor
            ariaLabel="Compact comment composer"
            value={comment}
            modes={["markdown"]}
            initialMode="markdown"
            onChange={setComment}
          />
          <div className="comment-actions">
            <span>{comment.length} characters</span>
            <button type="button">Submit</button>
          </div>
        </div>
      </ExampleShell>

      <ExampleShell
        id="side-pane-review"
        eyebrow="Review pane"
        title="Side-pane review editor"
        description="A review workflow with read-only context, comment threads, and a focused Markdown editor in a side pane."
      >
        <div className="review-example">
          <article className="review-document" aria-label="Document under review">
            <MarkdownEditor
              ariaLabel="Reviewed document preview"
              value={technicalDocsMarkdown}
              modes={["preview"]}
              initialMode="preview"
              readOnly
              renderers={renderers}
            />
          </article>
          <aside className="review-pane" aria-label="Review side pane">
            <div className="review-thread">
              <strong>Security review</strong>
              <span>Blocking until retry behavior is documented.</span>
            </div>
            <MarkdownEditor
              ariaLabel="Side-pane review editor"
              value={review}
              modes={["markdown", "preview"]}
              initialMode="markdown"
              renderers={renderers}
              onChange={setReview}
            />
            <div className="review-actions">
              <button type="button">Resolve</button>
              <button type="button">Request changes</button>
            </div>
          </aside>
        </div>
      </ExampleShell>

      <ExampleShell
        id="modal-quick-edit"
        eyebrow="Modal"
        title="Modal quick-edit editor"
        description="A constrained dialog editor for fast metadata and paragraph edits without leaving the host page."
      >
        <div className="quick-edit-backdrop" aria-label="Quick edit modal backdrop">
          <section className="quick-edit-modal" role="dialog" aria-modal="true" aria-labelledby="quick-edit-title">
            <header>
              <div>
                <p className="eyebrow">Quick edit</p>
                <h4 id="quick-edit-title">API Rate Limits</h4>
              </div>
              <button type="button" aria-label="Close quick edit">Close</button>
            </header>
            <MarkdownEditor
              ariaLabel="Modal quick-edit editor"
              value={quickEdit}
              modes={["hybrid", "markdown", "preview"]}
              initialMode="hybrid"
              renderers={renderers}
              onChange={setQuickEdit}
            />
            <footer>
              <span>Autosaved draft</span>
              <button type="button">Apply changes</button>
            </footer>
          </section>
        </div>
      </ExampleShell>

      <ExampleShell
        id="technical-runbook"
        eyebrow="Runbook"
        title="Technical runbook editor"
        description="A code-heavy incident runbook with diagrams, callouts, properties, and host renderer services."
      >
        <div className="runbook-example">
          <nav className="runbook-outline" aria-label="Runbook outline">
            <a href="#triage">Triage</a>
            <a href="#commands">Commands</a>
            <a href="#diagrams">Diagrams</a>
          </nav>
          <MarkdownEditor
            ariaLabel="Technical runbook editor"
            value={runbook}
            modes={["hybrid", "markdown", "preview"]}
            initialMode="hybrid"
            renderers={renderers}
            onChange={setRunbook}
          />
        </div>
      </ExampleShell>

      <ExampleShell
        id="mobile-note"
        eyebrow="Mobile"
        title="Mobile-first note editor"
        description="A narrow host shell that keeps the editor usable for phone-sized note capture and task updates."
      >
        <div className="mobile-note-frame" aria-label="Mobile note preview frame">
          <header>
            <span>Today</span>
            <button type="button">Save</button>
          </header>
          <MarkdownEditor
            ariaLabel="Mobile-first note editor"
            value={mobileNote}
            modes={["hybrid", "markdown"]}
            initialMode="hybrid"
            renderers={renderers}
            onChange={setMobileNote}
          />
        </div>
      </ExampleShell>

      <ExampleShell
        id="ai-prompt-composer"
        eyebrow="AI prompt"
        title="AI prompt composer"
        description="A Markdown prompt surface with page mentions, source context, and a generated-preview companion pane."
      >
        <div className="prompt-example">
          <section className="prompt-composer" aria-label="Prompt composer">
            <div className="mention-row" aria-label="Available page mentions">
              <button type="button">[[Release Runbook]]</button>
              <button type="button">[[Renderer Registry]]</button>
              <button type="button">[[Mobile Session Policy]]</button>
            </div>
            <MarkdownEditor
              ariaLabel="AI prompt composer with Markdown and page mentions"
              value={prompt}
              modes={["markdown", "preview"]}
              initialMode="markdown"
              renderers={renderers}
              onChange={setPrompt}
            />
          </section>
          <aside className="prompt-context" aria-label="Prompt context">
            <strong>Context pages</strong>
            <ul>
              <li>Release Runbook</li>
              <li>Renderer Registry</li>
              <li>Mobile Session Policy</li>
            </ul>
            <MarkdownEditor
              ariaLabel="AI prompt rendered preview"
              value={prompt}
              modes={["preview"]}
              initialMode="preview"
              readOnly
              renderers={renderers}
            />
          </aside>
        </div>
      </ExampleShell>

      <ExampleShell
        id="conflict-resolver"
        eyebrow="Conflict"
        title="Conflict/diff resolver"
        description="A merge workflow embedding base, incoming, and resolved Markdown editor instances."
      >
        <div className="conflict-example">
          <section className="conflict-column" aria-label="Base version">
            <header>
              <strong>Base</strong>
              <span>Read-only</span>
            </header>
            <MarkdownEditor
              ariaLabel="Conflict base Markdown"
              value={baseConflictMarkdown}
              modes={["markdown"]}
              initialMode="markdown"
              readOnly
            />
          </section>
          <section className="conflict-column" aria-label="Incoming version">
            <header>
              <strong>Incoming</strong>
              <span>Read-only</span>
            </header>
            <MarkdownEditor
              ariaLabel="Conflict incoming Markdown"
              value={incomingConflictMarkdown}
              modes={["markdown"]}
              initialMode="markdown"
              readOnly
            />
          </section>
          <section className="conflict-column conflict-resolution" aria-label="Resolved version">
            <header>
              <strong>Resolved</strong>
              <button type="button" onClick={() => setResolvedConflict(incomingConflictMarkdown)}>Use incoming</button>
            </header>
            <MarkdownEditor
              ariaLabel="Conflict resolved Markdown editor"
              value={resolvedConflict}
              modes={["markdown", "preview"]}
              initialMode="markdown"
              renderers={renderers}
              onChange={setResolvedConflict}
            />
          </section>
        </div>
      </ExampleShell>
    </div>
  );
}

function ExampleShell({
  id,
  eyebrow,
  title,
  description,
  children
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="example-shell" data-testid={`example-${id}`} aria-labelledby={`${id}-title`}>
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h3 id={`${id}-title`}>{title}</h3>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

function renderPlantUmlFixture(source: string): string {
  const message = source.match(/([A-Za-z]+)\s*-+>+\s*([A-Za-z]+):\s*(.+)/);
  const from = escapeSvgText(message?.[1] ?? "Alice");
  const to = escapeSvgText(message?.[2] ?? "Bob");
  const label = escapeSvgText(message?.[3] ?? "PlantUML host renderer");

  return `<figure class="me-renderer-diagram me-renderer-plantuml" data-renderer="host-demo"><svg viewBox="0 0 520 170" role="img" aria-label="PlantUML host rendered sequence diagram" xmlns="http://www.w3.org/2000/svg"><rect width="520" height="170" rx="8" fill="#ffffff"/><line x1="130" y1="42" x2="130" y2="144" stroke="#94a3b8" stroke-dasharray="4 4"/><line x1="390" y1="42" x2="390" y2="144" stroke="#94a3b8" stroke-dasharray="4 4"/><rect x="80" y="18" width="100" height="32" rx="4" fill="#eff6ff" stroke="#2563eb"/><rect x="340" y="18" width="100" height="32" rx="4" fill="#eff6ff" stroke="#2563eb"/><text x="130" y="39" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" fill="#18202a">${from}</text><text x="390" y="39" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" fill="#18202a">${to}</text><path d="M140 92h228" stroke="#2563eb" stroke-width="2" marker-end="url(#arrow)"/><text x="254" y="82" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#18202a">${label}</text><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#2563eb"/></marker></defs></svg></figure>`;
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function DiagnosticList({ diagnostics }: { diagnostics: EditorDiagnostic[] }) {
  if (diagnostics.length === 0) {
    return <p className="empty-state">No renderer diagnostics.</p>;
  }

  return (
    <ul className="diagnostic-list">
      {diagnostics.map((diagnostic, index) => (
        <li key={`${diagnostic.code}-${index}`} data-severity={diagnostic.severity}>
          <strong>{diagnostic.code}</strong>
          <span>{diagnostic.message}</span>
        </li>
      ))}
    </ul>
  );
}

function ModeCard({
  title,
  modes,
  markdown,
  renderers,
  readOnly = false,
  toolbarIcons,
  onMarkdownChange
}: {
  title: string;
  modes: EditorMode[];
  markdown: string;
  renderers: RendererRegistry;
  readOnly?: boolean;
  toolbarIcons?: WysiwygToolbarIcons;
  onMarkdownChange: (value: string) => void;
}) {
  return (
    <article className="mode-card" data-testid={`mode-card-${slugifyTestId(title)}`}>
      <strong>{title}</strong>
      <MarkdownEditor
        ariaLabel={`${title} editor`}
        value={markdown}
        modes={modes}
        initialMode={modes[0]}
        readOnly={readOnly}
        renderers={renderers}
        wysiwygToolbarIcons={toolbarIcons}
        onChange={onMarkdownChange}
      />
    </article>
  );
}

function slugifyTestId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
