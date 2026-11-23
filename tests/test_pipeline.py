"""The pipeline end to end on the demo estate: golden findings, call matching and determinism."""
import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from sysgraph.build import build

ESTATE = Path(__file__).resolve().parent.parent / "examples" / "bookshop"


def expected_findings() -> set[tuple[str, str]]:
    rows = re.findall(r"^\| `(R\d:[^`]+)` \| (\w+) \|", (ESTATE / "EXPECTED.md").read_text(encoding="utf-8"), re.M)
    return set(rows)


class BookshopTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = Path(tempfile.mkdtemp(prefix="sysgraph-out-")) / "out"
        cls.graph, cls.findings = build(ESTATE, cls.out)

    def test_findings_match_expected_md_exactly(self):
        actual = {(f["id"], f["label"]) for f in self.findings["findings"]}
        self.assertEqual(len(expected_findings()), 11)
        self.assertEqual(actual, expected_findings())

    def test_every_finding_carries_evidence(self):
        for finding in self.findings["findings"]:
            self.assertTrue(finding["evidence"], finding["id"])
            for ev in finding["evidence"]:
                self.assertTrue((ESTATE / ev["file"]).is_file(), ev)

    def test_calls_are_matched_to_the_endpoint_they_hit(self):
        calls = {(e["from"], e["to"]) for e in self.graph["edges"] if e["rel"] == "calls"}
        self.assertIn(("service:payments-service", "endpoint:orders-service:GET /orders/{id}"), calls)
        self.assertIn(("service:storefront-web", "endpoint:search-service:GET /search"), calls)

    def test_bare_table_names_resolve_to_the_migration_table(self):
        writes = {(e["from"], e["to"]) for e in self.graph["edges"] if e["rel"] == "writes_table"}
        self.assertIn(("service:payments-service", "table:orders.orders"), writes)

    def test_publish_keeps_the_previous_output(self):
        build(ESTATE, self.out)
        self.assertTrue((self.out.with_name("out.prev") / "graph.json").is_file())
        self.assertFalse(self.out.with_name("out.next").exists())


class DeterminismTest(unittest.TestCase):
    def test_same_input_gives_byte_identical_output(self):
        root = Path(tempfile.mkdtemp(prefix="sysgraph-det-"))
        with mock.patch.dict(os.environ, {"SOURCE_DATE_EPOCH": "1700000000"}):
            build(ESTATE, root / "a")
            build(ESTATE, root / "b")
        for name in ("graph.json", "findings.json", "COVERAGE.md"):
            self.assertEqual((root / "a" / name).read_bytes(), (root / "b" / name).read_bytes(), name)
        self.assertEqual(json.loads((root / "a" / "graph.json").read_text())["built"], "2023-11-14T22:13:20Z")


if __name__ == "__main__":
    unittest.main()
