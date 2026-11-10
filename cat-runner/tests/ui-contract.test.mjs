// Source/asset contracts, not a substitute for real browser and touch QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ROUND_SECONDS } from '../engine.mjs';
const file=p=>new URL('../'+p,import.meta.url);
const html=readFileSync(file('index.html'),'utf8');
const game=readFileSync(file('game.mjs'),'utf8');
test('all UI targets referenced by the Phaser controller exist',()=>{
 const ids=[...game.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of ids)assert(html.includes(`id="${id}"`),id);
});
test('local Phaser runtime loads before game module',()=>{
 const runtime='./vendor/phaser-3.90.0.min.js';assert(html.includes(runtime));
 assert(html.indexOf(runtime)<html.indexOf('./game.mjs'));
 assert(!/<script[^>]+src="https?:/.test(html));
});
test('all static relative page assets exist',()=>{
 for(const [,path] of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert(existsSync(file(path)),path);
});
test('generated PNG is a full-size RGBA raster, not an SVG replacement',()=>{
 const data=readFileSync(file('assets/fuwa-generated.png'));
 assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),1536);assert.equal(data.readUInt32BE(20),1024);
 assert.equal(data[25],6);assert(/this\.load\.image\('fuwa',\s*'\.\/assets\/fuwa-generated\.png'\)/.test(game));assert(!game.includes('fuwa.svg'));
});
test('HTML duration agrees with the authored course',()=>{
 assert(html.includes(`aria-valuemax="${ROUND_SECONDS}"`));assert(html.includes(`${ROUND_SECONDS}초 코스`));
});
test('jump acts on pointer-down, tab loss pauses, responsive resize pauses',()=>{
 assert(game.includes("target.addEventListener('pointerdown',pointerPress)"));
 assert(game.includes("$('jump'), $('game-canvas')"));
 assert(game.includes("target.addEventListener('pointercancel',pointerRelease)"));
 assert(game.includes("document.addEventListener('keyup'"));
 assert(game.includes("window.addEventListener('blur',pause)"));assert(game.includes("document.addEventListener('visibilitychange'"));assert(game.includes('next.width!==view.width||next.height!==view.height){pause()'));
});
test('Phaser MIT license is retained',()=>{const license=readFileSync(file('vendor/PHASER-LICENSE.md'),'utf8');assert(license.includes('MIT'));assert(readFileSync(file('vendor/phaser-3.90.0.min.js')).length>1000000);});

test('tutorial describes two separate taps and denies any hold-height effect',()=>{
 assert(html.includes('공중에서 잠깐 뒤 다시 톡'));assert(html.includes('꾹 눌러도 높아지지 않아요'));
 assert(html.includes('id="jump-label"'));assert(html.includes('id="jump-state"'));
 assert(!html.includes('꾹 누르면'));assert(!game.includes('hold threshold'));
});

test('real motion atlas and painted backdrop are local with registered runtime frames',()=>{
 const motion=readFileSync(file('assets/fuwa-motion-v1.png'));
 assert.equal(motion.readUInt32BE(16),1774);assert.equal(motion.readUInt32BE(20),887);assert.equal(motion[25],6);
 const background=readFileSync(file('assets/moonlit-alley-v1.png'));
 assert.equal(background.readUInt32BE(16),2172);assert.equal(background.readUInt32BE(20),724);
 assert(game.includes('i < 8'));assert(game.includes('295 / 310'));assert(game.includes("? 6 : 7"));
 assert(game.includes('distance * .012'));assert(game.includes('Math.min(200,'));
});
test('score, obstacle hints and audio lifecycle are connected',()=>{
 for(const id of ['score','combo','result-score','result-rating'])assert(html.includes(`id="${id}"`));
 assert(game.includes('jumpCueSeconds(game.mode,next)'));assert(game.includes("from './audio.mjs'"));
 for(const action of ['start','pause','resume','stop'])assert(game.includes(`audio.${action}()`));
 assert(game.includes("audio.play('finish')"));assert(game.includes("event.kind"));
});

test('jump cues live in controls so a high arc cannot cover the cat',()=>{
 assert(html.indexOf('id="hint"')>html.indexOf('class="controls"'));
 assert(html.indexOf('id="hint"')>html.indexOf('class="progress"'));
 assert(readFileSync(file('style.css'),'utf8').includes('.control-tip .hint{position:static'));
});

test('actual terrain replaces the old uninterrupted road and uses floor-aware rendering',()=>{
 assert(game.includes('terrainSegments(game)'));assert(game.includes('this.drawTerrain()'));
 assert(!game.includes('this.road.tilePositionX'));assert(game.includes('!game.grounded'));
 assert(game.includes('game.floorHeight!==null'));assert(game.includes('box.baseY??GROUND'));
 assert(game.includes("if(event.type==='recover')"));assert(game.includes('game.jumpStartedAt'));
 assert(game.includes("worldViewport(host.clientWidth,host.clientHeight)"));
});
