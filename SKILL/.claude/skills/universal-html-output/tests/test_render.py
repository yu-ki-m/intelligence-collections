"""stdlib-only smoke and contract tests: python3 -m unittest discover -s tests -v"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from render import normalize_data, embed, ValidationError  # noqa: E402

class RenderTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / "examples/example.json").read_text(encoding="utf-8"))

    def test_valid_multiple_depths(self):
        data, metrics = normalize_data(self.data)
        self.assertEqual(metrics["depth"], 4)
        self.assertEqual(metrics["leaves"], 2)
        self.assertEqual(len(data["columns"]), 5)

    def test_embed_preserves_engine(self):
        data, _ = normalize_data(self.data)
        template = (ROOT / "assets/template.html").read_text(encoding="utf-8")
        html = embed(template, data)
        self.assertIn('function installColumnResizers', html)
        self.assertIn('table.style.tableLayout = "fixed"', html)
        self.assertIn('applied[applied.length - 1] +=', html)
        self.assertIn('"title": "サンプル：汎用的な情報整理"', html)

    def test_html_sanitize_and_script_terminator(self):
        self.data["rows"][0]["children"][0]["children"][0]["cells"]["content2"] = {
            "html": '<strong onclick="evil()">文字</strong><script>evil()</script><a href="javascript:evil()">危険</a><br>安全'
        }
        data, _ = normalize_data(self.data)
        rich = data["rows"][0]["children"][0]["children"][0]["cells"]["content2"]["html"]
        self.assertNotIn('evil()', rich)
        self.assertNotIn('<script', rich)
        self.assertIn('<strong>文字</strong>', rich)
        self.assertIn('<a>危険</a>', rich)
        html = embed((ROOT / "assets/template.html").read_text(encoding="utf-8"), data)
        self.assertIn('\\u003cstrong\\u003e', html)

    def test_unknown_column_fails(self):
        self.data["rows"][0]["children"][0]["children"][0]["cells"]["unknown"] = "no"
        with self.assertRaises(ValidationError):
            normalize_data(self.data)

    def test_badge_column_position_fails(self):
        self.data["columns"][1], self.data["columns"][3] = self.data["columns"][3], self.data["columns"][1]
        with self.assertRaises(ValidationError):
            normalize_data(self.data)

    def test_cli_real_file(self):
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "result.html"
            args = [sys.executable, str(ROOT / "scripts/render.py"), "-i", str(ROOT / "examples/example.json"), "-o", str(out)]
            p = subprocess.run(args, text=True, capture_output=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertTrue(out.exists())
            self.assertIn("VALID:", p.stdout)
            self.assertIn('meta charset="utf-8"', out.read_text(encoding="utf-8"))

if __name__ == "__main__":
    unittest.main()
