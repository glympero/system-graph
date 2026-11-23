"""Which service reads or writes which table, from SQL written in application code.

Emits `table:<name as written>`; the merge step resolves a bare name to the one table that has it.
"""
import re

from sysgraph.model import Edge, RepoContext, line_at

CONFIDENCE = 0.8
BLIND_SPOTS = [
    "Only upper-case SQL keywords in code are read; ORM queries (JPA, Prisma, Sequelize) are not seen.",
    "Dynamic table names and stored procedures are not seen.",
]

_IDENT = r"([A-Za-z_][\w.]*)"
_WRITE = re.compile(r"\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO)\s+" + _IDENT)
_READ = re.compile(r"(?<!DELETE )\b(?:FROM|JOIN)\s+" + _IDENT)
_CODE = (".java", ".kt", ".js", ".ts", ".mjs", ".py", ".go", ".cs")


def extract(ctx: RepoContext):
    if not ctx.service:
        return
    for path in ctx.files(*_CODE):
        text = ctx.read(path)
        seen = set()
        for rel, pattern in (("writes_table", _WRITE), ("reads_table", _READ)):
            for m in pattern.finditer(text):
                key = (rel, m.group(1).lower(), line_at(text, m.start()))
                if key not in seen:
                    seen.add(key)
                    yield Edge(ctx.service_id, f"table:{key[1]}", rel, ctx.rel(path), key[2])
