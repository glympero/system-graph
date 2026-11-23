"""Express routes: `app.get('/path', ...)`, `router.post('/path', ...)`."""
import re

from sysgraph.extractors._endpoints import endpoint
from sysgraph.model import RepoContext, line_at
from sysgraph.paths import to_template

CONFIDENCE = 0.95
BLIND_SPOTS = [
    "Mount prefixes from `app.use('/prefix', router)` are not applied.",
    "Routes built from variables or loops are not seen.",
]

_ROUTE = re.compile(r"\b(?:app|router|\w+Router)\.(get|post|put|patch|delete)\(\s*(['\"`])([^'\"`]+)\2")


def extract(ctx: RepoContext):
    if not ctx.service:
        return
    for path in ctx.files(".js", ".ts", ".mjs", ".cjs"):
        text = ctx.read(path)
        for m in _ROUTE.finditer(text):
            yield from endpoint(ctx, m.group(1), to_template(m.group(3)), ctx.rel(path), line_at(text, m.start()))
