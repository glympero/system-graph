"""Get each repo onto disk: local folders are read in place, git repos are shallow-cloned into a cache."""
import subprocess
from pathlib import Path

from sysgraph.config import ConfigError, RepoSpec


def materialize(spec: RepoSpec, cache: Path) -> Path:
    if spec.path:
        if not spec.path.is_dir():
            raise ConfigError(f"repo {spec.name!r}: {spec.path} is not a folder")
        return spec.path
    dest = cache / spec.name
    ref = ["--branch", spec.ref] if spec.ref else []
    if not dest.exists():
        cache.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--quiet", "--depth", "1", *ref, "--", spec.git, str(dest)], check=True)
    else:
        subprocess.run(["git", "-C", str(dest), "remote", "set-url", "origin", spec.git], check=True)
        subprocess.run(["git", "-C", str(dest), "fetch", "--quiet", "--depth", "1", "origin", spec.ref or "HEAD"],
                       check=True)
        subprocess.run(["git", "-C", str(dest), "reset", "--quiet", "--hard", "FETCH_HEAD"], check=True)
    return dest
