"""Tables and schemas from Flyway-style migrations (`V1__name.sql`)."""
import re

from sysgraph.model import Node, RepoContext, line_at

CONFIDENCE = 1.0
BLIND_SPOTS = [
    "Only `CREATE TABLE` is read; renames and drops in later migrations are not applied.",
    "Tables created by an ORM at runtime or by Liquibase XML/YAML changelogs are not seen.",
]

_MIGRATION = re.compile(r"^V\d+(?:[._]\d+)*__\w+\.sql$")
_CREATE = re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w.]*)", re.IGNORECASE)


def extract(ctx: RepoContext):
    for path in ctx.files(".sql"):
        if not _MIGRATION.match(path.name):
            continue
        text = ctx.read(path)
        for m in _CREATE.finditer(text):
            schema, _, table = m.group(1).lower().rpartition(".")
            schema = schema or "public"
            yield Node(f"schema:{schema}", "schema", schema)
            yield Node(f"table:{schema}.{table}", "table", f"{schema}.{table}", repo=ctx.name, file=ctx.rel(path),
                       line=line_at(text, m.start()), props={"schema": schema, "table": table})
