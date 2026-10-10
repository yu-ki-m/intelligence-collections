"""Optional browser regression: python tests/browser_resize_optional.py

Requires Playwright + installed Chromium. Render/test only; not needed for using the skill.
"""
from pathlib import Path
import sys
import shutil

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print('SKIP: pip install playwright and run playwright install chromium to enable browser tests')
    sys.exit(0)

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / 'assets/template.html'
with sync_playwright() as p:
    system_chromium = shutil.which("chromium") or shutil.which("google-chrome")
    try:
        browser = p.chromium.launch(headless=True, executable_path=system_chromium) if system_chromium else p.chromium.launch(headless=True)
    except Exception as exc:
        print(f"SKIP: Chromium is not available ({exc})")
        sys.exit(0)
    for width in (850, 1300, 1680):
        page = browser.new_page(viewport={'width': width, 'height': 900})
        page.set_content(HTML.read_text(encoding='utf-8'))
        read = '''() => ({x:[...document.querySelectorAll('thead th')].map(e=>e.getBoundingClientRect().x),
             w:document.querySelector('table').getBoundingClientRect().width,
             panel:document.querySelector('.panel').clientWidth})'''
        before = page.evaluate(read)
        assert abs(before['w'] - before['panel']) < 3, before
        grip = page.locator('thead th').nth(2).locator('.resize-handle')
        box = grip.bounding_box()
        x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        start = page.evaluate(read)
        page.mouse.move(x-120, y, steps=6)
        changed = page.evaluate(read)
        page.mouse.up()
        for i in (0,1,2):
            assert abs(start['x'][i] - changed['x'][i]) <= 1, (width, start, changed)
        assert abs(changed['w'] - changed['panel']) < 3, (width, changed)
        grip.dblclick(force=True)
        assert abs(page.evaluate(read)['w']-before['panel']) < 3
        page.close()
        print('PASS', width)
    browser.close()
