"""Google Pub/Sub topics and subscriptions from Terraform, including ordering and dead-letter policy."""
import re

from sysgraph.model import Edge, Node, RepoContext, line_at

CONFIDENCE = 1.0
BLIND_SPOTS = [
    "Only literal names and `google_pubsub_topic.<name>.id|name` references are resolved, not variables or modules.",
    "The owning service comes from a `service` label on the subscription.",
]

_RESOURCE = re.compile(r"resource\s+\"(google_pubsub_topic|google_pubsub_subscription)\"\s+\"(\w+)\"\s*\{")
_NAME = re.compile(r"^\s*name\s*=\s*\"([^\"]+)\"", re.MULTILINE)
_REF = r"(?:google_pubsub_topic\.(\w+)\.(?:id|name)|\"([^\"]+)\")"
_TOPIC = re.compile(r"^\s*topic\s*=\s*" + _REF, re.MULTILINE)
_DLQ = re.compile(r"dead_letter_topic\s*=\s*" + _REF)
_ORDERED = re.compile(r"enable_message_ordering\s*=\s*true")
_SERVICE = re.compile(r"labels\s*=\s*\{[^}]*\bservice\s*=\s*\"([^\"]+)\"")


def _blocks(text: str):
    for m in _RESOURCE.finditer(text):
        depth, i = 1, m.end()
        while depth and i < len(text):
            depth += {"{": 1, "}": -1}.get(text[i], 0)
            i += 1
        yield m.group(1), m.group(2), text[m.end():i], m.start()


def extract(ctx: RepoContext):
    parsed = []
    for path in ctx.files(".tf"):
        text = ctx.read(path)
        parsed += [(kind, label, body, ctx.rel(path), line_at(text, offset))
                   for kind, label, body, offset in _blocks(text)]
    topics = {label: _NAME.search(body).group(1) for kind, label, body, _, _ in parsed
              if kind == "google_pubsub_topic" and _NAME.search(body)}

    def resolve(m):
        return topics.get(m.group(1)) if m.group(1) else m.group(2)

    for kind, label, body, file, line in parsed:
        name = _NAME.search(body)
        if not name:
            continue
        if kind == "google_pubsub_topic":
            yield Node(f"topic:{name.group(1)}", "topic", name.group(1), repo=ctx.name, file=file, line=line)
            continue
        topic_ref = _TOPIC.search(body)
        topic = resolve(topic_ref) if topic_ref else None
        if not topic:
            continue
        topic = topic.rsplit("/", 1)[-1]
        props = {"topic": topic, "ordered": bool(_ORDERED.search(body))}
        if dlq := _DLQ.search(body):
            props["dead_letter_topic"] = resolve(dlq).rsplit("/", 1)[-1]
        if service := _SERVICE.search(body):
            props["service"] = service.group(1)
        sub_id = f"subscription:{name.group(1)}"
        yield Node(sub_id, "subscription", name.group(1), repo=ctx.name, file=file, line=line, props=props)
        yield Node(f"topic:{topic}", "topic", topic)
        yield Edge(sub_id, f"topic:{topic}", "subscribes", file, line, source="iac")
