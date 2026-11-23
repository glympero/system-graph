"""The data contract: nodes, edges and the repo an extractor reads."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SKIP_DIRS = {".git", "node_modules", "dist", "build", "target", ".gradle", ".venv", "__pycache__"}

NODE_TYPES = ("repo", "service", "endpoint", "topic", "subscription", "table", "schema", "function", "library")
RELATIONS = ("calls", "publishes", "subscribes", "reads_table", "writes_table", "exposes", "routes_to",
             "uses_library", "declared_dependency")
SOURCES = ("code", "iac", "declared")


@dataclass
class Node:
    id: str
    type: str
    name: str
    repo: str | None = None
    file: str | None = None
    line: int | None = None
    props: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {"id": self.id, "type": self.type, "name": self.name}
        for key in ("repo", "file", "line"):
            if getattr(self, key) is not None:
                out[key] = getattr(self, key)
        if self.props:
            out["props"] = self.props
        return out


@dataclass
class Edge:
    from_: str
    to: str
    rel: str
    file: str
    line: int
    source: str = "code"
    confidence: float = 0.0  # stamped from the extractor by the pipeline
    extractor: str = ""
    props: dict[str, Any] = field(default_factory=dict)

    def key(self) -> tuple:
        return (self.from_, self.to, self.rel, self.file, self.line)

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {"from": self.from_, "to": self.to, "rel": self.rel, "source": self.source,
                               "file": self.file, "line": self.line, "confidence": self.confidence,
                               "extractor": self.extractor}
        if self.props:
            out["props"] = self.props
        return out


@dataclass(frozen=True)
class RepoContext:
    name: str
    root: Path
    service: str | None  # the service this repo deploys, None for infra-only repos
    env_aliases: dict[str, str] = field(default_factory=dict)  # env var -> service, beats the naming convention

    @property
    def service_id(self) -> str | None:
        return f"service:{self.service}" if self.service else None

    def files(self, *suffixes: str) -> list[Path]:
        found = [p for p in self.root.rglob("*")
                 if p.is_file() and p.suffix in suffixes and not SKIP_DIRS & set(p.relative_to(self.root).parts)]
        return sorted(found)

    def rel(self, path: Path) -> str:
        """Estate-wide file id: `<repo>/<path inside the repo>`."""
        return f"{self.name}/{path.relative_to(self.root).as_posix()}"

    @staticmethod
    def read(path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")


def line_at(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1
