"""Spring MVC routes: `@GetMapping` and friends, joined to the class-level `@RequestMapping`."""
import re

from sysgraph.extractors._endpoints import endpoint
from sysgraph.model import RepoContext, line_at
from sysgraph.paths import join

CONFIDENCE = 0.95
BLIND_SPOTS = [
    "Method-level `@RequestMapping(method = ...)` is not read, only the verb-specific annotations.",
    "Paths from constants or properties (`${...}`) are not resolved.",
    "Functional routes (`RouterFunction`) are not seen.",
]

_CLASS_PREFIX = re.compile(r"@RequestMapping\(([^)]*)\)\s*(?:@\w+(?:\([^)]*\))?\s*)*(?:public\s+)?class\b")
_METHOD = re.compile(r"@(Get|Post|Put|Patch|Delete)Mapping\b(?:\(([^)]*)\))?")
_STRING = re.compile(r"\"([^\"]*)\"")


def _first_string(args: str | None) -> str:
    m = _STRING.search(args or "")
    return m.group(1) if m else ""


def extract(ctx: RepoContext):
    if not ctx.service:
        return
    for path in ctx.files(".java", ".kt"):
        text = ctx.read(path)
        prefix = _CLASS_PREFIX.search(text)
        base = _first_string(prefix.group(1)) if prefix else ""
        for m in _METHOD.finditer(text):
            yield from endpoint(ctx, m.group(1), join(base, _first_string(m.group(2))), ctx.rel(path),
                                line_at(text, m.start()))
