"""HTTP path normalisation shared by route and client extractors and the call matcher."""
import re

_EXPR = re.compile(r"\$\{([^}]*)\}")
_COLON_PARAM = re.compile(r"/:(\w+)")
_ANY_PARAM = re.compile(r"\{[^}]*\}")


def to_template(path: str) -> str:
    """`/books/:id` and `/books/${id}` both become `/books/{id}`; query strings are dropped."""
    path = _EXPR.sub(lambda m: "{" + m.group(1).strip() + "}", path)
    path = path.split("?", 1)[0]
    path = _COLON_PARAM.sub(r"/{\1}", path)
    if not path.startswith("/"):
        path = "/" + path
    return path.rstrip("/") or "/"


def match_key(path: str) -> str:
    """Parameter names do not matter when matching a call to a route."""
    return _ANY_PARAM.sub("{}", to_template(path))


def join(prefix: str, path: str) -> str:
    return to_template("/".join(part.strip("/") for part in (prefix, path) if part.strip("/")))
