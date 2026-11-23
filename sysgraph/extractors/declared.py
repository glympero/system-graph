"""What a team says its service depends on, from `architecture.yaml` at the repo root."""
import re

from sysgraph.miniyaml import load
from sysgraph.model import Edge, Node, RepoContext

CONFIDENCE = 0.5
BLIND_SPOTS = [
    "Only as true as the last time someone edited the file. That is the point: rule R5 compares it with the code.",
]

FILE = "architecture.yaml"


def extract(ctx: RepoContext):
    path = ctx.root / FILE
    if not path.is_file():
        return
    text = ctx.read(path)
    doc = load(text) or {}
    service = doc.get("service") or ctx.service
    if not service:
        return
    props = {k: v for k, v in doc.items() if k not in ("service", "depends_on") and v is not None}
    props["declares_dependencies"] = True
    yield Node(f"service:{service}", "service", service, props=props)
    lines = text.splitlines()
    for target in doc.get("depends_on") or []:
        pattern = re.compile(rf"^\s*-\s*['\"]?{re.escape(target)}['\"]?\s*(#.*)?$")
        line = next((number for number, text_line in enumerate(lines, 1) if pattern.match(text_line)), 1)
        yield Edge(f"service:{service}", f"service:{target}", "declared_dependency", ctx.rel(path), line,
                   source="declared")
