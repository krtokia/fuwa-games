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
 assert.equal(data[25],6);assert(game.includes("this.load.image('fuwa','./assets/fuwa-generated.png')"));assert(!game.includes('fuwa.svg'));
});
test('HTML duration agrees with the authored course',()=>{
 assert(html.includes(`aria-valuemax="${ROUND_SECONDS}"`));assert(html.includes(`${ROUND_SECONDS}초 산책`));
});
test('jump acts on pointer-down, tab loss pauses, responsive resize pauses',()=>{
 assert(game.includes("target.addEventListener('pointerdown',pointerPress)"));
 assert(game.includes("$('jump'), $('game-canvas')"));
 assert(game.includes("target.addEventListener('pointercancel',pointerRelease)"));
 assert(game.includes("document.addEventListener('keyup'"));
 assert(game.includes("window.addEventListener('blur',pause)"));assert(game.includes("document.addEventListener('visibilitychange'"));assert(game.includes('next!==oldWidth){pause()'));
});
test('Phaser MIT license is retained',()=>{const license=readFileSync(file('vendor/PHASER-LICENSE.md'),'utf8');assert(license.includes('MIT'));assert(readFileSync(file('vendor/phaser-3.90.0.min.js')).length>1000000);});

test('tutorial describes two separate taps and denies any hold-height effect',()=>{
 assert(html.includes('공중에서 한 번 더 톡'));assert(html.includes('꾹 눌러도 높아지지 않아요'));
 assert(html.includes('id="jump-label"'));assert(html.includes('id="jump-state"'));
 assert(!html.includes('꾹 누르면'));assert(!game.includes('hold threshold'));
});
