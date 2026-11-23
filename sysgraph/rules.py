"""Architecture rules as plain Python over the merged graph. Each rule yields findings with evidence."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Callable, Iterable

from sysgraph.merge import Graph
from sysgraph.model import Edge


@dataclass
class Finding:
    rule: str
    subject: str  # the key part of the id; usually a node id
    label: str  # Bad, Gap or Good
    message: str
    nodes: list[str]
    evidence: list[Edge]
    extra_evidence: list[dict] = field(default_factory=list)

    def to_json(self, title: str) -> dict:
        evidence = [{"file": e.file, "line": e.line, "note": describe(e)} for e in self.evidence]
        return {"id": f"{self.rule}:{self.subject}", "rule": self.rule, "title": title, "label": self.label,
                "subject": self.nodes[0], "nodes": self.nodes, "message": self.message,
                "evidence": sorted(evidence + self.extra_evidence, key=lambda x: (x["file"], x["line"]))}


REL_TEXT = {"calls": "calls", "publishes": "publishes to", "subscribes": "subscribes to", "reads_table": "reads",
            "writes_table": "writes", "exposes": "exposes", "declared_dependency": "declares a dependency on"}


def describe(edge: Edge) -> str:
    """Evidence notes in words: `payments-service writes orders.orders`."""
    def short(node_id: str) -> str:
        return node_id.split(":", 1)[1].replace(":", " ", 1) if node_id.startswith("endpoint:") else node_id.split(":", 1)[1]
    return f"{short(edge.from_)} {REL_TEXT.get(edge.rel, edge.rel)} {short(edge.to)}"


class Index:
    def __init__(self, graph: Graph):
        self.nodes = graph.nodes
        self.by_rel: dict[str, list[Edge]] = defaultdict(list)
        for e in graph.edges:
            self.by_rel[e.rel].append(e)

    def of_type(self, node_type: str):
        return [n for n in self.nodes.values() if n.type == node_type]

    def target_service(self, edge: Edge) -> str:
        """Service-level view of a call: an endpoint folds into the service that exposes it."""
        node = self.nodes[edge.to]
        return f"service:{node.props['service']}" if node.type == "endpoint" else edge.to

    def service_calls(self) -> dict[tuple[str, str], list[Edge]]:
        pairs: dict[tuple[str, str], list[Edge]] = defaultdict(list)
        for e in self.by_rel["calls"]:
            target = self.target_service(e)
            if target != e.from_:
                pairs[(e.from_, target)].append(e)
        return pairs


def _short(node_id: str) -> str:
    return node_id.split(":", 1)[1]


def _names(node_ids) -> str:
    names = sorted({_short(n) for n in node_ids})
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]


def topic_without_subscribers(ix: Index):
    for topic in ix.of_type("topic"):
        pubs = [e for e in ix.by_rel["publishes"] if e.to == topic.id]
        subs = [e for e in ix.by_rel["subscribes"] if e.to == topic.id]
        if pubs and not subs:
            who = _names(e.from_ for e in pubs)
            yield Finding("R1", topic.id, "Gap", f"Published by {who}, nothing subscribes to it.",
                          [topic.id], pubs)


def subscriber_without_publisher(ix: Index):
    for topic in ix.of_type("topic"):
        pubs = [e for e in ix.by_rel["publishes"] if e.to == topic.id]
        subs = [e for e in ix.by_rel["subscribes"] if e.to == topic.id]
        if subs and not pubs:
            who = _names(e.from_ for e in subs)
            yield Finding("R2", topic.id, "Gap", f"Consumed by {who}, nothing publishes it.",
                          [topic.id], subs)


def shared_table_writes(ix: Index):
    writers: dict[str, list[Edge]] = defaultdict(list)
    for e in ix.by_rel["writes_table"]:
        writers[e.to].append(e)
    for table, edges in writers.items():
        services = sorted({e.from_ for e in edges})
        if len(services) > 1:
            names = _names(services)
            yield Finding("R3", table, "Bad", f"{_short(table)} is written by {names}. One owner per table.",
                          [table, *services], edges)


def _strongly_connected(graph: dict[str, set[str]]) -> list[list[str]]:
    """Tarjan's algorithm, iterative so deep graphs do not hit the recursion limit."""
    index: dict[str, int] = {}
    low: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    result = []
    counter = 0
    for start in sorted(graph):
        if start in index:
            continue
        work = [(start, iter(sorted(graph[start])))]
        index[start] = low[start] = counter
        counter += 1
        stack.append(start)
        on_stack.add(start)
        while work:
            node, children = work[-1]
            child = next(children, None)
            if child is not None:
                if child not in index:
                    index[child] = low[child] = counter
                    counter += 1
                    stack.append(child)
                    on_stack.add(child)
                    work.append((child, iter(sorted(graph.get(child, ())))))
                elif child in on_stack:
                    low[node] = min(low[node], index[child])
                continue
            work.pop()
            if work:
                low[work[-1][0]] = min(low[work[-1][0]], low[node])
            if low[node] == index[node]:
                component = []
                while True:
                    member = stack.pop()
                    on_stack.discard(member)
                    component.append(member)
                    if member == node:
                        break
                result.append(sorted(component))
    return result


def call_cycles(ix: Index):
    pairs = ix.service_calls()
    graph: dict[str, set[str]] = defaultdict(set)
    for a, b in pairs:
        graph[a].add(b)
    for component in _strongly_connected(graph):
        if len(component) < 2:
            continue
        members = set(component)
        evidence = [e for (a, b), edges in pairs.items() if a in members and b in members for e in edges]
        names = " <-> ".join(_short(s) for s in component)
        yield Finding("R4", ">".join(component), "Bad", f"Call cycle: {names}. Neither can deploy or fail alone.",
                      component, evidence)


def declared_drift(ix: Index):
    declared = {(e.from_, e.to): e for e in ix.by_rel["declared_dependency"]}
    proven = ix.service_calls()
    for (a, b), edge in declared.items():
        if (a, b) not in proven:
            yield Finding("R5", f"{a}>{b}", "Gap",
                          f"{_short(a)} declares a dependency on {_short(b)}, no call in code proves it.",
                          [a, b], [edge])
    for (a, b), edges in proven.items():
        if ix.nodes[a].props.get("declares_dependencies") and (a, b) not in declared:
            yield Finding("R5", f"{a}>{b}", "Gap",
                          f"{_short(a)} calls {_short(b)}, its architecture file does not declare it.",
                          [a, b], edges)


def _fact(props: dict, note: str) -> dict:
    return {"file": props["file"], "line": props["line"], "note": note}


def pinned_services(ix: Index):
    for svc in ix.of_type("service"):
        deployment, hpa = svc.props.get("deployment"), svc.props.get("hpa")
        if not deployment:
            continue
        if not hpa:
            yield Finding("R6", svc.id, "Gap", f"{svc.name} has no autoscaler, it runs a fixed "
                          f"{deployment['replicas']} {'replica' if deployment['replicas'] == 1 else 'replicas'}.", [svc.id], [],
                          [_fact(deployment, f"replicas: {deployment['replicas']}, no HPA")])
        elif hpa["min"] == hpa["max"]:
            yield Finding("R6", svc.id, "Gap", f"{svc.name} autoscaler is pinned at {hpa['min']} to {hpa['max']}.",
                          [svc.id], [], [_fact(hpa, f"minReplicas {hpa['min']} == maxReplicas {hpa['max']}")])


def blocking_pdb(ix: Index):
    for svc in ix.of_type("service"):
        pdb = svc.props.get("pdb")
        hpa, deployment = svc.props.get("hpa"), svc.props.get("deployment")
        replicas = hpa["min"] if hpa else (deployment or {}).get("replicas")
        if not pdb or not isinstance(pdb["min_available"], int) or replicas is None:
            continue
        if pdb["min_available"] >= replicas:
            source = hpa or deployment
            yield Finding("R7", svc.id, "Bad", f"{svc.name} PDB needs {pdb['min_available']} pods available and the "
                          f"service can run only {replicas}, so no pod can ever be evicted.", [svc.id], [],
                          [_fact(pdb, f"minAvailable: {pdb['min_available']}"),
                           _fact(source, f"replicas floor: {replicas}")])


def dead_letter_policy(ix: Index):
    for sub in ix.of_type("subscription"):
        evidence = [{"file": sub.file, "line": sub.line, "note": f"subscription {sub.name}"}]
        nodes = [sub.id, f"topic:{sub.props['topic']}"]
        if sub.props.get("dead_letter_topic"):
            yield Finding("R8", sub.id, "Good", f"{sub.name} sends poison messages to "
                          f"{sub.props['dead_letter_topic']}.", nodes, [], evidence)
        elif sub.props.get("ordered"):
            yield Finding("R8", sub.id, "Bad", f"{sub.name} is ordered and has no dead-letter topic, "
                          "one bad message blocks everything behind it.", nodes, [], evidence)


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    check: Callable[[Index], Iterable[Finding]]


RULES = [
    Rule("R1", "Topic with publishers and no subscribers", topic_without_subscribers),
    Rule("R2", "Subscriber to a topic nobody publishes", subscriber_without_publisher),
    Rule("R3", "Table written by more than one service", shared_table_writes),
    Rule("R4", "Call cycle between services", call_cycles),
    Rule("R5", "Declared dependencies drift from the code", declared_drift),
    Rule("R6", "Service pinned at a fixed replica count", pinned_services),
    Rule("R7", "Disruption budget blocks every eviction", blocking_pdb),
    Rule("R8", "Subscription dead-letter policy", dead_letter_policy),
]


def run_rules(graph: Graph) -> dict:
    ix = Index(graph)
    findings = [f.to_json(rule.title) for rule in RULES for f in rule.check(ix)]
    return {"version": 1,
            "rules": [{"id": r.id, "title": r.title} for r in RULES],
            "findings": sorted(findings, key=lambda f: f["id"])}
