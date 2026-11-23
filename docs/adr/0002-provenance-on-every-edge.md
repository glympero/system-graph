# 2. Provenance on every edge

Status: accepted

## Context

An architecture map is only useful if people trust it. Hand-drawn diagrams lose trust because nobody can tell whether
a box or an arrow is still true. A generated map has the same problem if it cannot show why an arrow exists: static
analysis makes mistakes, and a reader needs a way to check.

## Decision

Every edge carries its evidence, with no exceptions:

```json
{"from": "service:payments-service", "to": "table:orders.orders", "rel": "writes_table",
 "source": "code", "file": "payments-service/src/main/java/com/inkwell/payments/OrderStatusWriter.java",
 "line": 18, "confidence": 0.8, "extractor": "table_usage"}
```

- `file` and `line` point at the exact place that proves the edge.
- `source` says whether it came from code, infrastructure as code, or a team's declaration.
- `extractor` and `confidence` say which plugin produced it and how far to trust that plugin.

The merge step refuses to publish an edge without provenance. Each extractor also lists its blind spots, which the
build writes to `COVERAGE.md`, so the map is honest about what it cannot see.

## Consequences

- Every answer in the explorer and every MCP answer can cite file:line and link to the repo host.
- A reviewer can check a surprising finding in one click instead of arguing about it.
- Extractors cost a little more to write, since they must track offsets and line numbers.
- Declared dependencies are kept as their own `declared` source, so drift between what teams say and what the code does
  becomes a rule (R5) instead of silently merging the two.
