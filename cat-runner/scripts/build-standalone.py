#!/usr/bin/env python3
"""Create a self-contained HTML copy for local review; not required by Pages."""
from pathlib import Path
import base64
import sys

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fuwa-runner.html')
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
engine = (root / 'engine.mjs').read_text().replace('export ', '')
game = (root / 'game.mjs').read_text().split('\n', 1)[1]
for asset in ['fuwa.svg', 'fuwa-run.svg']:
    uri = 'data:image/svg+xml;base64,' + base64.b64encode((root / 'assets' / asset).read_bytes()).decode()
    html = html.replace('./assets/' + asset, uri)
    game = game.replace('./assets/' + asset, uri)
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="./game.mjs"></script>', '')
html = html.replace('href="../"', 'href="https://game.fuwa.dad/"')
html = html.replace('</body>', '<script type="module">\n' + engine + '\n' + game + '\n</script>\n</body>')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(output)
