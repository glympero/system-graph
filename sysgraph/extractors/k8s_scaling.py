"""Scaling facts from Kubernetes manifests: Deployment replicas, HPA min/max/metrics, PDB minAvailable."""
import re
from pathlib import Path

from sysgraph.miniyaml import load
from sysgraph.model import Node, RepoContext

CONFIDENCE = 1.0
BLIND_SPOTS = [
    "Plain manifests only; Helm templates and Kustomize overlays are not rendered.",
    "The Deployment name must equal the service name.",
]


def _documents(text: str):
    """Yield (first line number, document text) for each `---` separated document."""
    start, buf = 1, []
    for number, line in enumerate(text.splitlines(), 1):
        if line.strip() == "---" or line.startswith("--- "):
            yield start, "\n".join(buf)
            start, buf = number + 1, []
        else:
            buf.append(line)
    yield start, "\n".join(buf)


def _line(doc: str, start: int, key: str) -> int:
    m = re.search(rf"^\s*{key}:", doc, re.MULTILINE)
    return start + doc.count("\n", 0, m.start()) if m else start


def _facts(ctx: RepoContext, path: Path):
    text, file = ctx.read(path), ctx.rel(path)
    for start, doc_text in _documents(text):
        doc = load(doc_text)
        if not isinstance(doc, dict):
            continue
        spec = doc.get("spec") or {}
        kind = doc.get("kind")
        if kind == "Deployment" and "replicas" in spec:
            yield doc["metadata"]["name"], "deployment", {
                "replicas": spec["replicas"], "file": file, "line": _line(doc_text, start, "replicas")}
        elif kind == "HorizontalPodAutoscaler":
            metrics = [m.get("resource", {}).get("name") or m.get("type") for m in spec.get("metrics") or []]
            yield spec["scaleTargetRef"]["name"], "hpa", {
                "min": spec.get("minReplicas", 1), "max": spec.get("maxReplicas"), "metrics": metrics,
                "file": file, "line": _line(doc_text, start, "minReplicas")}
        elif kind == "PodDisruptionBudget" and "minAvailable" in spec:
            labels = (spec.get("selector") or {}).get("matchLabels") or {}
            name = labels.get("app") or doc.get("metadata", {}).get("name")
            yield name, "pdb", {"min_available": spec["minAvailable"], "file": file,
                                "line": _line(doc_text, start, "minAvailable")}


def extract(ctx: RepoContext):
    services: dict[str, dict] = {}
    for path in ctx.files(".yaml", ".yml"):
        for name, key, value in _facts(ctx, path):
            services.setdefault(name, {})[key] = value
    for name, props in sorted(services.items()):
        yield Node(f"service:{name}", "service", name, props=props)
