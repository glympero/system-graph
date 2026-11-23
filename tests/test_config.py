import tempfile
import unittest
from pathlib import Path

from sysgraph.config import ConfigError, load_config


def config(text: str) -> Path:
    folder = Path(tempfile.mkdtemp(prefix="sysgraph-cfg-"))
    (folder / "sysgraph.yaml").write_text(text, encoding="utf-8")
    return folder


class ConfigTest(unittest.TestCase):
    def test_link_template_gets_the_repo_name(self):
        cfg = load_config(config("link: https://host/{repo}/{path}#L{line}\nrepos:\n  - name: web\n    path: web\n"))
        self.assertEqual(cfg.repos[0].link, "https://host/web/{path}#L{line}")

    def test_bad_entries_are_config_errors_not_crashes(self):
        for text in ("repos: [web]\n", "repos:\n  - name: ../evil\n    path: x\n",
                     "repos:\n  - name: web\n    path: a\n    git: b\n", "name: empty\n"):
            with self.subTest(text=text), self.assertRaises(ConfigError):
                load_config(config(text))


if __name__ == "__main__":
    unittest.main()
