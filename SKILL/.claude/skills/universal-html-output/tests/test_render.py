"""Run: python -m unittest discover -s tests -v"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from render import normalize_document, embed, ValidationError  # noqa: E402


class RenderTests(unittest.TestCase):
    def setUp(self):
        self.mixed = json.loads((ROOT / "examples/mixed-report.json").read_text(encoding="utf-8"))

    def test_many_independent_tables_and_html(self):
        data, tables, stats = normalize_document(self.mixed, ROOT / "examples")
        self.assertEqual(stats["blocks"], 5)
        self.assertEqual(stats["tables"], 2)
        self.assertEqual(stats["html_blocks"], 3)
        self.assertEqual(stats["depth"], 3)
        self.assertEqual([len(t["columns"]) for t in tables], [4, 3])
        self.assertEqual([t["id"] for t in tables], ["tasks", "references"])
        template = (ROOT / "assets/template.html").read_text(encoding="utf-8")
        result = embed(template, data, tables)
        self.assertEqual(result.count('<section class="table-section"'), 2)
        self.assertLess(result.index('demo-panels'), result.index('data-table-id="tasks"'))
        self.assertLess(result.index('data-table-id="tasks"'), result.index('data-table-id="references"'))
        self.assertIn('hierarchy-table-widths-auto-v3:', result)
        self.assertIn('const PAGE_DATA =', result)
        self.assertIn('const TABLES_DATA =', result)
        self.assertIn('<svg viewBox="0 0 630 90"', result)
        self.assertIn('document.getElementById(\'demo-click\')', result)

    def test_html_only_zero_tables(self):
        example = json.loads((ROOT / "examples/html-only.json").read_text(encoding="utf-8"))
        doc, tables, metrics = normalize_document(example, ROOT / "examples")
        self.assertEqual(metrics["tables"], 0)
        rendered = embed((ROOT / "assets/template.html").read_text(encoding="utf-8"), doc, tables)
        self.assertIn('表を使わないページ', rendered)
        self.assertNotIn('<table class="tree">', rendered)

    def test_html_file(self):
        data = json.loads((ROOT / "examples/html-file.json").read_text(encoding="utf-8"))
        doc, tables, _ = normalize_document(data, ROOT / "examples")
        self.assertIn('外部HTML断片', doc["blocks"][0]["html"])
        self.assertEqual(tables, [])

    def test_html_file_escape_fails(self):
        data = {'title':'a','blocks':[{'type':'html','html_file':'../SKILL.md'}]}
        with self.assertRaises(ValidationError):
            normalize_document(data, ROOT / "examples")
        data['blocks'][0]['html_file'] = '/tmp/x.html'
        with self.assertRaises(ValidationError):
            normalize_document(data, ROOT / "examples")

    def test_unsanitized_trusted_raw_html_vs_sanitized_table_cell(self):
        html = '<form><button type="button" onclick="doThing()">Go</button></form><script>window.demo=1</script>'
        self.mixed['blocks'][0]['html'] = html
        # cell HTML remains sanitised even while raw blocks are fully expressive
        cell = self.mixed['blocks'][1]['rows'][0]['children'][0]['children'][0]['cells']['summary']
        cell['html'] = '<strong onclick="bad()">safe</strong><script>bad()</script>'
        doc, tables, _ = normalize_document(self.mixed, ROOT / "examples")
        self.assertNotIn('bad()', tables[0]['rows'][0]['children'][0]['children'][0]['cells']['summary']['html'])
        final = embed((ROOT / "assets/template.html").read_text(encoding="utf-8"), doc, tables)
        self.assertIn(html, final)
        self.assertIn('\\u003cstrong\\u003e', final)
        self.assertNotIn('onclick="bad()"', final)

    def test_duplicate_id_fails(self):
        self.mixed['blocks'][3]['id'] = self.mixed['blocks'][1]['id']
        with self.assertRaises(ValidationError):
            normalize_document(self.mixed, ROOT / "examples")

    def test_badge_position_restrictions_per_table(self):
        block = self.mixed['blocks'][1]
        block['columns'][1], block['columns'][3] = block['columns'][3], block['columns'][1]
        with self.assertRaises(ValidationError):
            normalize_document(self.mixed, ROOT / "examples")

    def test_legacy_single_table(self):
        data = json.loads((ROOT / "examples/legacy-table.json").read_text(encoding="utf-8"))
        doc, tables, stats = normalize_document(data, ROOT / "examples")
        self.assertEqual(stats['tables'], 1)
        self.assertEqual(stats['depth'], 4)
        self.assertEqual(len(tables[0]['columns']), 5)

    def test_input_with_script_close_no_breakout(self):
        self.mixed['blocks'][1]['rows'][0]['children'][0]['children'][0]['cells']['detail'] = '<script>hello()</script>'
        doc, tables, _ = normalize_document(self.mixed, ROOT / "examples")
        final = embed((ROOT / "assets/template.html").read_text(encoding="utf-8"), doc, tables)
        self.assertIn('\\u003cscript\\u003e', final)
        self.assertNotIn('"<script>hello()', final)

    def test_cli_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'out.html'
            cmd = [sys.executable, str(ROOT / 'scripts/render.py'), '-i', str(ROOT / 'examples/mixed-report.json'), '-o', str(dest)]
            process = subprocess.run(cmd, text=True, capture_output=True)
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertTrue(dest.exists())
            self.assertIn('2 テーブル', process.stdout)
            second = subprocess.run(cmd, text=True, capture_output=True)
            self.assertNotEqual(second.returncode, 0)
            cmd.append('--overwrite')
            third = subprocess.run(cmd, text=True, capture_output=True)
            self.assertEqual(third.returncode, 0, third.stderr)


if __name__ == '__main__':
    unittest.main()
