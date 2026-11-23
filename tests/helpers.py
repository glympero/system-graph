import tempfile
import textwrap
from pathlib import Path

from sysgraph.model import Edge, Node, RepoContext


def repo(files: dict[str, str], name: str = "shop", service: str | None = "shop",
         env_aliases: dict[str, str] | None = None) -> RepoContext:
    """A throwaway repo on disk built from {path: content}."""
    root = Path(tempfile.mkdtemp(prefix="sysgraph-test-"))
    for path, content in files.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(textwrap.dedent(content), encoding="utf-8")
    return RepoContext(name=name, root=root, service=service, env_aliases=env_aliases or {})


def edges(items) -> set[tuple]:
    return {(e.from_, e.to, e.rel, e.file, e.line) for e in items if isinstance(e, Edge)}


def nodes(items) -> dict[str, Node]:
    return {n.id: n for n in items if isinstance(n, Node)}
