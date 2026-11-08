#!/usr/bin/env python3
"""Install PC/Legacy Points and set the browser tab title to TTWL.

Run AFTER building _site and AFTER any scripts/add_seo.py/add_favicon.py steps.
Does not overwrite app.js, the original HTML, data JSON, or stylesheet.
"""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
SITE = Path('_site')

if not (SITE / 'index.html').is_file():
    raise SystemExit('Missing _site/index.html. Build _site BEFORE running install_points.py')
for name in ('ttwl-points.js', 'ttwl-points.css'):
    source = ROOT / name
    if not source.is_file():
        raise SystemExit(f'Missing {source}')
    shutil.copyfile(source, SITE / name)

html_files = sorted(SITE.glob('*.html'))
for html_file in html_files:
    # Keep HTML content, search metadata and scripts intact; replace only tab title.
    text = html_file.read_text(encoding='utf-8')
    if re.search(r'<title\b[^>]*>.*?</title\s*>', text, flags=re.I | re.S):
        text = re.sub(r'<title\b[^>]*>.*?</title\s*>', '<title>TTWL</title>', text, count=1, flags=re.I | re.S)
    elif re.search(r'</head\s*>', text, re.I):
        text = re.sub(r'</head\s*>', '<title>TTWL</title>\n</head>', text, count=1, flags=re.I)
    if html_file.name == 'index.html':
        if 'ttwl-points.css' not in text:
            text, changed = re.subn(r'</head\s*>', '  <link rel="stylesheet" href="./ttwl-points.css">\n</head>', text, count=1, flags=re.I)
            if changed != 1:
                raise SystemExit('Could not find </head> in _site/index.html')
        if 'ttwl-points.js' not in text:
            text, changed = re.subn(r'</body\s*>', '  <script defer src="./ttwl-points.js"></script>\n</body>', text, count=1, flags=re.I)
            if changed != 1:
                raise SystemExit('Could not find </body> in _site/index.html')
    html_file.write_text(text, encoding='utf-8')
print(f'TTWL Points installed for PC and Legacy; updated title on {len(html_files)} pages.')
