"""Kafka in code: Spring `KafkaTemplate.send` / `@KafkaListener`, kafkajs `producer.send` / `consumer.subscribe`."""
import re

from sysgraph.model import Edge, Node, RepoContext, line_at

CONFIDENCE = 0.9
BLIND_SPOTS = [
    "Topic names must be string literals or `static final String` constants in the same file.",
    "Topics from configuration (`${...}`, env vars) are not resolved.",
]

_JAVA_CONST = re.compile(r"static\s+final\s+String\s+(\w+)\s*=\s*\"([^\"]+)\"")
_JAVA_SEND = re.compile(r"\b\w*(?:[Kk]afka|[Tt]emplate)\w*\.send\(\s*(?:\"([^\"]+)\"|(\w+))")
_JAVA_LISTENER = re.compile(r"@KafkaListener\(([^)]*)\)")
_JAVA_TOPICS = re.compile(r"topics\s*=\s*(\{[^}]*\}|\"[^\"]*\"|\w+)")
_JS_SEND = re.compile(r"\.send\(\s*\{\s*topic:\s*(['\"])([^'\"]+)\1")
_JS_SUBSCRIBE = re.compile(r"\.subscribe\(\s*\{\s*(?:topic:\s*(['\"])([^'\"]+)\1|topics:\s*\[([^\]]*)\])")
_QUOTED = re.compile(r"['\"]([^'\"]+)['\"]")


def _java(text: str):
    consts = dict(_JAVA_CONST.findall(text))
    for m in _JAVA_SEND.finditer(text):
        topic = m.group(1) or consts.get(m.group(2))
        if topic:
            yield "publishes", topic, m.start()
    for m in _JAVA_LISTENER.finditer(text):
        topics = _JAVA_TOPICS.search(m.group(1))
        if not topics:
            continue
        literals = _QUOTED.findall(topics.group(1))
        names = literals or [consts.get(topics.group(1).strip("{} "))]
        for topic in names:
            if topic:
                yield "subscribes", topic, m.start()


def _js(text: str):
    for m in _JS_SEND.finditer(text):
        yield "publishes", m.group(2), m.start()
    for m in _JS_SUBSCRIBE.finditer(text):
        for topic in [m.group(2)] if m.group(2) else _QUOTED.findall(m.group(3)):
            yield "subscribes", topic, m.start()


def extract(ctx: RepoContext):
    if not ctx.service:
        return
    for path in ctx.files(".java", ".kt", ".js", ".ts", ".mjs"):
        text = ctx.read(path)
        found = _java(text) if path.suffix in (".java", ".kt") else _js(text)
        for rel, topic, offset in found:
            yield Node(f"topic:{topic}", "topic", topic)
            yield Edge(ctx.service_id, f"topic:{topic}", rel, ctx.rel(path), line_at(text, offset))
