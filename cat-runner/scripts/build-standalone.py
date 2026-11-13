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
def inline_module(name):
    text = (root / name).read_text()
    return re.sub(r'^(?:import [\s\S]*? from [^\n]+|export \{[\s\S]*?\} from [^\n]+);\n', '', text, flags=re.M).replace('export ', '')

physics = inline_module('physics.mjs')
course = inline_module('course.mjs')
rewards = inline_module('rewards.mjs')
engine = inline_module('engine.mjs')
viewport = (root / 'viewport.mjs').read_text().replace('export ', '')
audio = (root / 'audio.mjs').read_text().replace('export ', '')
animation = (root / 'animation.mjs').read_text().replace('export ', '')
characters = inline_module('characters.mjs')
game = re.sub(r'^import .*;\n', '', (root / 'game.mjs').read_text(), flags=re.M)
for asset in ['fuwa-generated.png', 'fuwa-motion-v1.png', 'fuwa-jump-land-v1.png', 'fuwa-hiss-front-v1.png', 'moonlit-alley-v1.png', 'shuri-motion-v1.png', 'shuri-tumble-v1.png', 'nabi-motion-v1.png', 'nabi-punch-v1.png']:
    uri = 'data:image/png;base64,' + base64.b64encode((root / 'assets' / asset).read_bytes()).decode()
    html = html.replace('./assets/' + asset, uri)
    game = game.replace('./assets/' + asset, uri)
    characters = characters.replace('./assets/' + asset, uri)
    css = css.replace('./assets/' + asset, uri)
html = html.replace('<link rel="stylesheet" href="./style.css">', '<style>\n' + css + '\n</style>')
html = html.replace('<script type="module" src="./game.mjs"></script>', '')
runtime = (root / 'vendor' / 'phaser-3.90.0.min.js').read_text().replace('</script', '<\\/script')
html = html.replace('<script src="./vendor/phaser-3.90.0.min.js"></script>', '<script>' + runtime + '</script>')
html = html.replace('href="../"', 'href="https://game.fuwa.dad/"')
head, tail = html.rsplit('</body>', 1)
html = head + '<script type="module">\n' + viewport + '\n' + audio + '\n' + physics + '\n' + course + '\n' + rewards + '\n' + engine + '\n' + animation + '\n' + characters + '\n' + game + '\n</script>\n</body>' + tail
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(output)
