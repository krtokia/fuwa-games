#!/usr/bin/env python3
"""Create a self-contained HTML copy for local review; not required by Pages."""
from pathlib import Path
import base64
import sys
import re

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/fuwa-runner.html')
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
course = (root / 'course.mjs').read_text().replace('export ', '')
engine = re.sub(r'^(?:import .*|export \{.*\} from .*);\n', '', (root / 'engine.mjs').read_text(), flags=re.M).replace('export ', '')
viewport = (root / 'viewport.mjs').read_text().replace('export ', '')
audio = (root / 'audio.mjs').read_text().replace('export ', '')
animation = (root / 'animation.mjs').read_text().replace('export ', '')
game = re.sub(r'^import .*;\n', '', (root / 'game.mjs').read_text(), flags=re.M)
for asset in ['fuwa-generated.png', 'fuwa-motion-v1.png', 'fuwa-jump-land-v1.png', 'fuwa-hiss-front-v1.png', 'moonlit-alley-v1.png']:
    uri = 'data:image/png;base64,' + base64.b64encode((root / 'assets' / asset).read_bytes()).decode()
    html = html.replace('./assets/' + asset, uri)
    game = game.replace('./assets/' + asset, uri)
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="./game.mjs"></script>', '')
runtime = (root / 'vendor' / 'phaser-3.90.0.min.js').read_text().replace('</script', '<\\/script')
html = html.replace('<script src="./vendor/phaser-3.90.0.min.js"></script>', '<script>' + runtime + '</script>')
html = html.replace('href="../"', 'href="https://game.fuwa.dad/"')
head, tail = html.rsplit('</body>', 1)
html = head + '<script type="module">\n' + viewport + '\n' + audio + '\n' + course + '\n' + engine + '\n' + animation + '\n' + game + '\n</script>\n</body>' + tail
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(output)
