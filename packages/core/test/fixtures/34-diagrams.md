---
title: Diagram Fixtures
status: published
---

# Diagram Fixtures

Mermaid diagrams should round-trip as fenced Markdown without interpreting the source
inside the codec.

```mermaid
graph TD
  Draft --> Review
  Review --> Publish
```

PlantUML diagrams are host-rendered in UI packages, but the codec must preserve the
source bytes exactly.

```plantuml
@startuml
Alice -> Bob: Validate release
Bob --> Alice: Approved
@enduml
```

Indented fence-like text inside prose should stay ordinary Markdown.

    ```mermaid
    graph LR
    ```
