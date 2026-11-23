"""Outgoing HTTP calls: fetch and axios with an env var base URL, Spring RestClient with an `@Value` base URL.

The target service comes from the env var name: `VITE_ORDERS_SERVICE_URL` -> `orders-service`.
The merge step matches each call to the endpoint it hits.
"""
import re

from sysgraph.model import Edge, RepoContext, line_at
from sysgraph.paths import to_template

CONFIDENCE = 0.85
BLIND_SPOTS = [
    "Base URLs must come straight from an env var; URLs from config files or service discovery are not resolved.",
    "Java: one base URL per client class (the first `@Value(\"${..._URL}\")`).",
    "Calls through generated SDKs or wrapper functions are not seen.",
]

_ENV = r"(?:import\.meta\.env|process\.env)\.(\w+)"
_BASE_VAR = re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*" + _ENV)
_AXIOS = re.compile(r"(?:const|let|var)\s+(\w+)\s*=\s*axios\.create\(\s*\{\s*baseURL:\s*" + _ENV)
_FETCH = re.compile(r"\bfetch\(\s*`\$\{(\w+)\}([^`]*)`")
_METHOD = re.compile(r"method:\s*['\"](\w+)['\"]")
_AXIOS_CALL = re.compile(r"\b(\w+)\.(get|post|put|patch|delete)\(\s*(['\"`])([^'\"`]*)\3")
_JAVA_BASE = re.compile(r"@Value\(\s*\"\$\{(\w+_URL)\}\"\s*\)")
_JAVA_CALL = re.compile(r"\.(get|post|put|patch|delete)\(\)\s*\.uri\(\s*\"([^\"]+)\"")

_PREFIXES = ("VITE_", "REACT_APP_", "NEXT_PUBLIC_")
_SUFFIXES = ("_BASE_URL", "_URL")


def service_for_env(env: str, aliases: dict[str, str]) -> str:
    if env in aliases:
        return aliases[env]
    name = env
    for prefix in _PREFIXES:
        name = name.removeprefix(prefix)
    for suffix in _SUFFIXES:
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name.lower().replace("_", "-")


def _call(ctx, target: str, method: str, path: str, file: str, line: int, env: str) -> Edge:
    return Edge(ctx.service_id, f"call:{target}:{method.upper()} {to_template(path)}", "calls", file, line,
                props={"env": env})


def _js(ctx: RepoContext, text: str, file: str):
    bases = {m.group(1): m.group(2) for m in _BASE_VAR.finditer(text)}
    for m in _FETCH.finditer(text):
        env = bases.get(m.group(1))
        if not env:
            continue
        end = text.find(";", m.end())
        method = _METHOD.search(text[m.end(): end if end != -1 else None])  # options live in the same statement
        yield _call(ctx, service_for_env(env, ctx.env_aliases), method.group(1) if method else "GET",
                    m.group(2), file, line_at(text, m.start()), env)
    instances = {m.group(1): m.group(2) for m in _AXIOS.finditer(text)}
    for m in _AXIOS_CALL.finditer(text):
        env = instances.get(m.group(1))
        if env:
            yield _call(ctx, service_for_env(env, ctx.env_aliases), m.group(2), m.group(4), file,
                        line_at(text, m.start()), env)


def _java(ctx: RepoContext, text: str, file: str):
    base = _JAVA_BASE.search(text)
    if not base or "RestClient" not in text:
        return
    env = base.group(1)
    for m in _JAVA_CALL.finditer(text):
        yield _call(ctx, service_for_env(env, ctx.env_aliases), m.group(1), m.group(2), file,
                    line_at(text, m.start()), env)


def extract(ctx: RepoContext):
    if not ctx.service:
        return
    for path in ctx.files(".js", ".jsx", ".ts", ".tsx", ".mjs", ".java"):
        text = ctx.read(path)
        parse = _java if path.suffix == ".java" else _js
        yield from parse(ctx, text, ctx.rel(path))
