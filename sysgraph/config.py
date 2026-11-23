"""`sysgraph.yaml`: which repos make up the estate and where evidence links point."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from sysgraph.miniyaml import load

CONFIG_FILE = "sysgraph.yaml"
_NAME = re.compile(r"^[A-Za-z0-9][\w.-]*$")  # repo names become cache folder names, so no path tricks


class ConfigError(ValueError):
    pass


@dataclass
class RepoSpec:
    name: str
    path: Path | None = None
    git: str | None = None
    ref: str | None = None
    service: str | None = None
    link: str | None = None


@dataclass
class Config:
    name: str
    root: Path
    repos: list[RepoSpec]
    env_aliases: dict[str, str] = field(default_factory=dict)


def load_config(target: Path) -> Config:
    path = target / CONFIG_FILE if target.is_dir() else target
    if not path.is_file():
        raise ConfigError(f"no {CONFIG_FILE} at {path}")
    doc = load(path.read_text(encoding="utf-8")) or {}
    root = path.parent.resolve()
    repos, seen = [], set()
    for raw in doc.get("repos") or []:
        if not isinstance(raw, dict):
            raise ConfigError(f"each repo needs `name:` and `path:` or `git:`, got {raw!r}")
        name = str(raw.get("name", ""))
        if not _NAME.match(name):
            raise ConfigError(f"invalid repo name {name!r}")
        if name in seen:
            raise ConfigError(f"duplicate repo {name!r}")
        seen.add(name)
        if bool(raw.get("path")) == bool(raw.get("git")):
            raise ConfigError(f"repo {name!r} needs exactly one of path or git")
        service = raw.get("service", name)
        link = raw.get("link") or doc.get("link")
        repos.append(RepoSpec(
            name=name,
            path=root / raw["path"] if raw.get("path") else None,
            git=raw.get("git"),
            ref=raw.get("ref"),
            service=None if service is False else str(service),
            link=link.replace("{repo}", name) if link else None,
        ))
    if not repos:
        raise ConfigError(f"{path} lists no repos")
    return Config(name=str(doc.get("name") or root.name), root=root, repos=repos,
                  env_aliases=doc.get("env_aliases") or {})
