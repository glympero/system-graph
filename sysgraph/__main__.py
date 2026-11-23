import argparse
import sys
from collections import Counter
from pathlib import Path

from sysgraph.build import build
from sysgraph.config import ConfigError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="sysgraph", description="Build an architecture graph from code and infra.")
    sub = parser.add_subparsers(dest="command", required=True)
    b = sub.add_parser("build", help="scan the repos in sysgraph.yaml and write graph.json and findings.json")
    b.add_argument("target", type=Path, help="folder with a sysgraph.yaml, or the file itself")
    b.add_argument("--out", type=Path, default=Path("out"), help="output folder (default: out)")
    args = parser.parse_args(argv)
    try:
        graph, findings = build(args.target, args.out)
    except ConfigError as err:
        print(f"sysgraph: {err}", file=sys.stderr)
        return 2
    labels = Counter(f["label"] for f in findings["findings"])
    print(f"{len(graph['nodes'])} nodes, {len(graph['edges'])} edges, {len(findings['findings'])} findings "
          f"({', '.join(f'{n} {label}' for label, n in sorted(labels.items()))}) -> {args.out}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
