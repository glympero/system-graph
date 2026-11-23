"""A YAML subset reader, so the pipeline stays standard-library only.

shortcut: block mappings, block sequences, flow lists, plain and quoted scalars, comments and `---` only.
No anchors, tags, multi-line strings or flow mappings with nesting. Swap in PyYAML if a manifest needs more.
"""
from __future__ import annotations

import re
from typing import Any

_INT = re.compile(r"^-?\d+$")
_FLOAT = re.compile(r"^-?\d+\.\d+$")


def _strip_comment(line: str) -> str:
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "'\"" and (i == 0 or line[i - 1] in " \t:[{,-"):
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def _split_flow(body: str) -> list[str]:
    parts, depth, quote, start = [], 0, None, 0
    for i, ch in enumerate(body):
        if quote:
            quote = None if ch == quote else quote
        elif ch in "'\"":
            quote = ch
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(body[start:i])
            start = i + 1
    parts.append(body[start:])
    return [p.strip() for p in parts if p.strip()]


def scalar(text: str) -> Any:
    text = text.strip()
    if text == "" or text in ("~", "null"):
        return None
    if len(text) >= 2 and text[0] == text[-1] and text[0] in "'\"":
        return text[1:-1]
    if text.startswith("[") and text.endswith("]"):
        return [scalar(p) for p in _split_flow(text[1:-1])]
    if text.startswith("{") and text.endswith("}"):
        return dict(_key_value(p) for p in _split_flow(text[1:-1]))
    if text in ("true", "false"):
        return text == "true"
    if _INT.match(text):
        return int(text)
    if _FLOAT.match(text):
        return float(text)
    return text


def _key_value(text: str) -> tuple[str, Any]:
    key, _, rest = text.partition(":")
    return scalar(key), scalar(rest)


class _Parser:
    def __init__(self, lines: list[tuple[int, str]]):
        self.lines = lines  # (indent, content)
        self.i = 0

    def block(self, indent: int) -> Any:
        if self.i >= len(self.lines):
            return None
        if self.lines[self.i][1].startswith("-"):
            return self.sequence(indent)
        return self.mapping(indent)

    def sequence(self, indent: int) -> list[Any]:
        items = []
        while self.i < len(self.lines):
            ind, content = self.lines[self.i]
            if ind != indent or not (content == "-" or content.startswith("- ")):
                break
            rest = content[1:].lstrip()
            if not rest:
                self.i += 1
                items.append(self.block(self.lines[self.i][0]) if self.i < len(self.lines) and self.lines[self.i][0] > indent else None)
            elif re.match(r"^[^'\"\[{][^:]*:(\s|$)", rest):
                # "- key: value": re-read the item as a mapping indented to where the key starts
                self.lines[self.i] = (indent + len(content) - len(rest), rest)
                items.append(self.mapping(self.lines[self.i][0]))
            else:
                self.i += 1
                items.append(scalar(rest))
        return items

    def mapping(self, indent: int) -> dict[str, Any]:
        result: dict[str, Any] = {}
        while self.i < len(self.lines):
            ind, content = self.lines[self.i]
            if ind != indent or content.startswith("- "):
                break
            key, _, rest = content.partition(":")
            self.i += 1
            if rest.strip():
                result[scalar(key)] = scalar(rest)
                continue
            nxt = self.lines[self.i] if self.i < len(self.lines) else None
            if nxt and (nxt[0] > indent or (nxt[0] == indent and nxt[1].startswith("-"))):
                result[scalar(key)] = self.block(nxt[0])
            else:
                result[scalar(key)] = None
        return result


def load_all(text: str) -> list[Any]:
    """Parse every `---` separated document in text."""
    docs, current = [], []
    for raw in text.splitlines() + ["---"]:
        if raw.strip() == "---" or raw.startswith("--- "):
            if current:
                docs.append(_Parser(current).block(current[0][0]))
            current = []
            continue
        line = _strip_comment(raw)
        if line.strip():
            current.append((len(line) - len(line.lstrip(" ")), line.strip()))
    return docs


def load(text: str) -> Any:
    docs = load_all(text)
    return docs[0] if docs else None
