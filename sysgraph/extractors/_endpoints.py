"""Shared by the route extractors: one endpoint node plus the `exposes` edge from its service."""
from sysgraph.model import Edge, Node, RepoContext


def endpoint(ctx: RepoContext, method: str, path: str, file: str, line: int):
    method = method.upper()
    node_id = f"endpoint:{ctx.service}:{method} {path}"
    yield Node(node_id, "endpoint", f"{method} {path}", repo=ctx.name, file=file, line=line,
               props={"service": ctx.service, "method": method, "path": path})
    yield Edge(ctx.service_id, node_id, "exposes", file, line)
