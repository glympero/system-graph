"""Merge extractor output into one graph: dedupe nodes, resolve references, validate every edge."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from sysgraph.model import NODE_TYPES, RELATIONS, SOURCES, Edge, Node
from sysgraph.paths import match_key

UNMATCHED_CALL_PENALTY = 0.5  # a call that reaches the service but no known route is less certain


@dataclass
class Graph:
    nodes: dict[str, Node]
    edges: list[Edge]
    unresolved: list[Edge] = field(default_factory=list)


def _merge_nodes(nodes: list[Node]) -> dict[str, Node]:
    groups: dict[str, list[Node]] = defaultdict(list)
    for node in nodes:
        groups[node.id].append(node)
    merged = {}
    for node_id, group in groups.items():
        # The node with provenance (file and line) is the one shown; props from every extractor are kept.
        group.sort(key=lambda n: (n.file is None, n.file or "", n.line or 0))
        first = group[0]
        props: dict = {}
        for n in group:
            props.update(n.props)
        repo = next((n.repo for n in group if n.repo), None)
        merged[node_id] = Node(node_id, first.type, first.name, repo, first.file, first.line, props)
    return merged


def _resolver(nodes: dict[str, Node]):
    routes = {(n.props["service"], n.props["method"], match_key(n.props["path"])): n.id
              for n in nodes.values() if n.type == "endpoint"}
    tables_by_name: dict[str, list[str]] = defaultdict(list)
    for n in nodes.values():
        if n.type == "table":
            tables_by_name[n.props["table"]].append(n.id)

    def resolve(edge: Edge) -> Edge | None:
        to = edge.to
        if to.startswith("call:"):
            service, _, call = to[len("call:"):].partition(":")
            method, _, path = call.partition(" ")
            if hit := routes.get((service, method, match_key(path))):
                to = hit
            elif f"service:{service}" in nodes:
                to = f"service:{service}"
                edge.props = {**edge.props, "unmatched": call}
                edge.confidence = round(edge.confidence * UNMATCHED_CALL_PENALTY, 2)
            else:
                return None
        elif to.startswith("table:") and "." not in to:
            candidates = tables_by_name.get(to[len("table:"):], [])
            if len(candidates) != 1:
                return None
            to = candidates[0]
        if edge.from_ not in nodes or to not in nodes:
            return None
        edge.to = to
        return edge

    return resolve


class InvalidGraph(ValueError):
    pass


def _check(ok: bool, message: str) -> None:
    if not ok:
        raise InvalidGraph(message)


def validate(graph: Graph) -> None:
    for n in graph.nodes.values():
        _check(n.type in NODE_TYPES, f"unknown node type {n.type} on {n.id}")
    for e in graph.edges:
        _check(e.from_ in graph.nodes and e.to in graph.nodes, f"dangling edge {e.key()}")
        _check(e.rel in RELATIONS and e.source in SOURCES, f"bad rel or source on {e.key()}")
        _check(bool(e.file) and e.line > 0 and bool(e.extractor), f"edge without provenance {e.key()}")


def merge(nodes: list[Node], edges: list[Edge]) -> Graph:
    merged = _merge_nodes(nodes)
    resolve = _resolver(merged)
    kept: dict[tuple, Edge] = {}
    unresolved = []
    for edge in edges:
        original = edge.to
        if resolve(edge) is None:
            edge.to = original
            unresolved.append(edge)
        else:
            kept.setdefault(edge.key(), edge)
    graph = Graph(merged, sorted(kept.values(), key=Edge.key), sorted(unresolved, key=Edge.key))
    validate(graph)
    return graph
