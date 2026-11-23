# 3. One shared core for the UI and the MCP server

Status: accepted

## Context

The same questions ("what breaks if this table changes?", "who calls this endpoint?") are asked in two places: a person
in the browser explorer and an AI assistant through MCP. If each had its own query code, the two would drift and give
different answers to the same question, which destroys trust in both.

## Decision

All question logic lives in a framework-free TypeScript core (`web/src/core`): the graph index, lenses, questions and
deep-link encoding. It imports nothing from React or the MCP SDK.

- The React explorer calls `runQuestion(index, id, args)` and renders the rows.
- The MCP server registers one tool per entry in `QUESTIONS` and formats the same rows as text, with a deep link that
  opens the identical view in the explorer.
- Both read only `graph.json` and `findings.json`, never the extractors.

Node runs the core's TypeScript directly (type stripping, Node 22.18+), so the MCP server needs no build step.

## Consequences

- A new question appears in the palette and as an MCP tool at once, and one golden test covers both.
- An assistant's answer and the explorer's answer cannot disagree.
- The core is restricted to erasable TypeScript syntax (no enums or parameter properties) so Node can strip the types.
