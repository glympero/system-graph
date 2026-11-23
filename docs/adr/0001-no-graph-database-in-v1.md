# 1. No graph database in v1

Status: accepted

## Context

The graph is a natural fit for a graph database such as Neo4j: rules like "call cycle" or "what depends on this table"
are graph queries. But a graph database is one more server to install, run, seed and keep in sync, and it would sit
between a person cloning the repo and their first result.

The demo estate has about 60 nodes and 85 edges. A real estate of a few hundred repos is in the tens of thousands.
Both fit in memory many times over.

## Decision

Keep the graph in plain JSON files (`graph.json`, `findings.json`). Rules run in Python over an in-memory adjacency
index. The explorer and the MCP server load the same JSON into a small TypeScript index.

## Consequences

- Two commands from clone to explorer, no services to run, and the pipeline uses only the Python standard library.
- The output is a reviewable, diffable artifact. Committing `graph.json` to a repo shows architecture changes in a PR.
- Rules are ordinary functions with ordinary unit tests, not query strings.
- Ad-hoc exploration needs code (a new question) instead of a query console.

A graph database earns its place when one of these becomes true: the graph no longer fits comfortably in memory,
people want ad-hoc queries without writing code, or the graph needs history (how the architecture looked last quarter)
with queries across versions. The JSON contract makes that move cheap: load the same files into the database.
