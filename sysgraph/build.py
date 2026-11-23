"""The pipeline: config -> fetch -> extractors -> merge + validate -> rules -> atomic publish."""
from __future__ import annotations

import json
import os
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from sysgraph.config import Config, load_config
from sysgraph.extractors import REGISTRY, name_of
from sysgraph.fetch import materialize
from sysgraph.merge import Graph, merge
from sysgraph.model import Edge, Node, RepoContext
from sysgraph.rules import run_rules

CACHE = Path(".sysgraph-cache")


def collect(config: Config) -> tuple[list[Node], list[Edge], Counter]:
    nodes: list[Node] = []
    edges: list[Edge] = []
    counts: Counter = Counter()
    for spec in config.repos:
        root = materialize(spec, CACHE)
        ctx = RepoContext(spec.name, root, spec.service, dict(config.env_aliases))
        nodes.append(Node(f"repo:{spec.name}", "repo", spec.name, props={"link": spec.link} if spec.link else {}))
        if spec.service:
            nodes.append(Node(ctx.service_id, "service", spec.service, repo=spec.name))
        for module in REGISTRY:
            for item in module.extract(ctx):
                counts[(name_of(module), type(item).__name__)] += 1
                if isinstance(item, Edge):
                    item.extractor, item.confidence = name_of(module), module.CONFIDENCE
                    edges.append(item)
                else:
                    nodes.append(item)
    return nodes, edges, counts


def _built() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")  # the reproducible-builds convention
    moment = datetime.fromtimestamp(int(epoch), timezone.utc) if epoch else datetime.now(timezone.utc)
    return moment.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _dump(data: dict) -> str:
    return json.dumps(data, indent=1, sort_keys=True, ensure_ascii=False) + "\n"


def coverage_report(graph: Graph, counts: Counter) -> str:
    lines = ["# Coverage", "", "What each extractor found, how far to trust it, and what it cannot see.", "",
             "| Extractor | Confidence | Nodes | Edges | Blind spots |", "|---|---|---|---|---|"]
    for module in REGISTRY:
        name = name_of(module)
        spots = "<br>".join(module.BLIND_SPOTS)
        lines.append(f"| `{name}` | {module.CONFIDENCE} | {counts[(name, 'Node')]} | {counts[(name, 'Edge')]} "
                     f"| {spots} |")
    lines += ["", f"## Unresolved references ({len(graph.unresolved)})", ""]
    if graph.unresolved:
        lines += ["Edges dropped because their target is not in the graph.", "",
                  "| From | To | Relation | Evidence |", "|---|---|---|---|"]
        lines += [f"| `{e.from_}` | `{e.to}` | {e.rel} | {e.file}:{e.line} |" for e in graph.unresolved]
    else:
        lines.append("None.")
    return "\n".join(lines) + "\n"


def publish(out: Path, files: dict[str, str]) -> None:
    """Write to `out.next/`, check it parses, then swap file by file and keep the old files in `out.prev/`."""
    staging, previous = out.with_name(out.name + ".next"), out.with_name(out.name + ".prev")
    shutil.rmtree(staging, ignore_errors=True)
    staging.mkdir(parents=True)
    for name, content in files.items():
        (staging / name).write_text(content, encoding="utf-8", newline="\n")
        if name.endswith(".json"):
            json.loads((staging / name).read_text(encoding="utf-8"))
    out.mkdir(parents=True, exist_ok=True)
    previous.mkdir(exist_ok=True)
    for name in files:
        if (out / name).exists():
            shutil.copy2(out / name, previous / name)
        os.replace(staging / name, out / name)
    staging.rmdir()


def build(target: Path, out: Path) -> tuple[dict, dict]:
    config = load_config(target)
    nodes, edges, counts = collect(config)
    graph = merge(nodes, edges)
    graph_json = {"version": 1, "name": config.name, "built": _built(),
                  "nodes": [n.to_json() for n in sorted(graph.nodes.values(), key=lambda n: n.id)],
                  "edges": [e.to_json() for e in graph.edges]}
    findings = run_rules(graph)
    publish(out, {"graph.json": _dump(graph_json), "findings.json": _dump(findings),
                  "COVERAGE.md": coverage_report(graph, counts)})
    return graph_json, findings
