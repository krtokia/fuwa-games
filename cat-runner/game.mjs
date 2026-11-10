import { MODES, ROUND_SECONDS, GROUND, CAT_X, createGame, jump, pressJump, releaseJump, step, jumpCueSeconds, terrainSegments, nextCue, floorAt } from './engine.mjs';
import { worldViewport } from './viewport.mjs';
import { RunnerAudio } from './audio.mjs';

// Phaser owns rendering, scene timing, particles and tweens. Native input supplies tap edges.
// The deterministic rule model stays separate so the course is testable without a GPU.
const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STORAGE_KEY = 'fuwa-runner.v2';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch {}
if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
// Pace changed in v0.4: start everyone on the new runner speed once, then remember their choice.
let mode = saved.paceVersion === 4 && typeof saved.mode === 'string' && Object.hasOwn(MODES, saved.mode) ? saved.mode : 'normal';
let game = createGame(mode, 720);
let scene, renderer, loaded = false, soundOn = false;
const audio = new RunnerAudio();
let noticeUntil = 0, toastUntil = 0, lastSecond = -1, lastSnacks = -1, lastHearts = -1;
let lastSegment = '', finished = false, visualClock = 0;
let heldInput = null;
let terminalFeedbackUntil = 0;

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {} }
function announce(text) { $('announcement').textContent = text; }
function overlay(card) {
  $('overlay').hidden = !card;
  for (const id of ['start-card', 'result-card', 'pause-card']) $(id).hidden = id !== card;
}
function start() {
  if (!loaded) return;
  endJump();
  game = createGame(mode, scene.scale.width); game.status = 'running';
  noticeUntil = 0; toastUntil = 0; finished = false; lastSegment = '';
  lastSecond = lastSnacks = lastHearts = -1; visualClock = 0; terminalFeedbackUntil = 0;
  scene.resetRun(); overlay(null);
  $('pause').disabled = false; $('jump').disabled = false;
  $('jump').focus({ preventScroll: true });
  announce(`${MODES[mode].label} 시작. 한 번 톡 누르면 낮게, 공중에서 한 번 더 누르면 2단 점프해요.`);
  audio.start(); updateHUD();
}
function doJump() {
  if (game.status !== 'running' || heldInput !== null) return;
  if (jump(game)) jumpFeedback();
}
function jumpFeedback() {
  if (game.jumpCount === 1) { scene.jumpEffect(); audio.play('jump'); }
  updateHUD();
}
function beginJump(source) {
  if (game.status !== 'running' || heldInput !== null) return;
  heldInput = source;
  $('jump').classList.add('is-held');
  if (pressJump(game)) jumpFeedback();
}
function endJump(source = null) {
  if (source !== null && source !== heldInput) return;
  heldInput = null;
  releaseJump(game);
  $('jump').classList.remove('is-held');
}
function pointerPress(event) {
  if (!event.isPrimary || event.button !== 0 || game.status !== 'running') return;
  event.preventDefault();
  const source = `pointer:${event.pointerId}`;
  if (heldInput !== null) return;
  beginJump(source);
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
}
function pointerRelease(event) { endJump(`pointer:${event.pointerId}`); }
function pause() {
  endJump();
  if (game.status !== 'running') return;
  game.status = 'paused'; scene.tweens.pauseAll(); audio.pause();
  $('pause').disabled = $('jump').disabled = true;
  overlay('pause-card'); $('resume').focus({ preventScroll:true }); announce('잠깐 쉬는 중.');
}
function resume() {
  if (game.status !== 'paused') return;
  game.status = 'running'; scene.tweens.resumeAll(); audio.resume();
  overlay(null); $('pause').disabled = $('jump').disabled = false;
  $('jump').focus({ preventScroll:true }); announce('이어서 산책해요.');
}
function showStart() {
  endJump(); audio.stop();
  scene?.tweens.resumeAll(); game = createGame(mode, scene?.scale.width || 720); finished = false;
  terminalFeedbackUntil = 0; scene?.resetRun(); $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  overlay('start-card'); $('start').focus({preventScroll:true}); updateHUD();
}
function finish() {
  if (finished) return; finished = true;
  endJump();
  $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  const won = game.status === 'won', key = `score_v7_${game.mode}`;
  const previous = Number.isFinite(saved[key]) ? Math.max(0,saved[key]) : 0;
  saved[key] = Math.max(previous,game.score); saved.mode=mode; saved.paceVersion=4; save();
  $('result-kicker').textContent = won ? '집 앞 골목에서 달빛 정원까지' : '다음 산책도 함께해요';
  $('result-title').textContent = won ? '달빛 정원 도착!' : '다시 달려볼까요?';
  $('result-score').textContent = game.score.toLocaleString();
  const medal = won ? (game.hitCount === 0 ? 3 : game.hearts >= 2 ? 2 : 1) : 0;
  $('result-rating').textContent = `${'★'.repeat(medal)}${'☆'.repeat(3-medal)} · ${won ? (medal===3?'완벽한 달리기!':'코스 완주!'):'다음엔 더 멀리!'}`;
  $('result-copy').textContent = `${Math.floor(game.elapsed)}초 · 간식 ${game.snacks}개 · 별 ${game.stars}개 · 최장 ${game.bestStreak}연속`;
  $('record').textContent = `${game.score>previous?'새 기록! ':''}${MODES[mode].label} 최고 ${saved[key].toLocaleString()}점`;
  overlay('result-card'); $('again').focus({preventScroll:true});
  announce(`${$('result-title').textContent}. ${$('result-copy').textContent}`);
  audio.stop({ preserveHit: !won }); if(won) { audio.play('finish'); scene.finishEffect(); }
}
function toast(text, duration=1.5) {
  $('course-toast').textContent=text; $('course-toast').classList.add('visible'); toastUntil=game.elapsed+duration;
}
function updateHUD() {
  const seconds=Math.max(0,Math.ceil(ROUND_SECONDS-game.elapsed));
  $('score').textContent=game.score.toLocaleString();
  $('combo').textContent=game.streak>0?`${game.streak} COMBO`:'—';
  if(seconds!==lastSecond) {
    $('time').replaceChildren(document.createTextNode(String(seconds)),Object.assign(document.createElement('span'),{textContent:'초'}));
    document.querySelector('.progress').setAttribute('aria-valuenow',String(Math.floor(game.elapsed))); lastSecond=seconds;
  }
  if(lastSnacks!==game.snacks) {$('snacks').textContent=game.snacks;lastSnacks=game.snacks;}
  if(lastHearts!==game.hearts) {$('hearts').textContent='♥ '.repeat(game.hearts).trim()+(game.hearts<3?' '+'♡ '.repeat(3-game.hearts).trim():'');$('hearts').setAttribute('aria-label',`기운 ${game.hearts}개`);lastHearts=game.hearts;}
  $('progress-fill').style.width=`${game.elapsed/ROUND_SECONDS*100}%`;
  if(game.segment?.name) {
    $('segment-label').textContent=game.segment.name;
    if(lastSegment!==game.segment.id) {if(lastSegment && game.status==='running')toast(game.segment.name,2);lastSegment=game.segment.id;}
  }
  const airborne=game.status==='running' && !game.grounded;
  const canDouble=airborne && game.jumpCount===1;
  $('jump-label').textContent=canDouble?'한 번 더':'점프';
  $('jump').classList.toggle('can-double',canDouble);
  $('jump-state').textContent=canDouble?'공중에서 한 번 더 가능':airborne?'착지하면 다시 점프해요':'한 번 톡 = 낮은 점프';
  if(game.status!=='running') return;
  $('jump').disabled=game.elapsed<game.recoveryUntil;
  if(game.elapsed<game.recoveryUntil)$('jump-state').textContent='구조 뒤 다시 달려요';
  const next=nextCue(game);
  const longFlight=game.obstacles.find(o=>o.taps===2&&!o.hit&&!o.cleared&&game.elapsed>=o.encounterAt-jumpCueSeconds(game.mode,o)-.15&&game.elapsed<=o.encounterAt+o.duration);
  const jumpAge=game.jumpStartedAt===null?0:game.elapsed-game.jumpStartedAt;
  const secondCue=longFlight?.kind==='high'?.30:.40;
  const away=next?(next.x-CAT_X-70)/MODES[game.mode].speed:Infinity;
  let text='';
  if(game.elapsed<game.recoveryUntil)text='안전한 바닥으로 구조 중';
  else if(game.elapsed<noticeUntil)text='하악! 다시 달려요!';
  else if(longFlight&&game.jumpCount===1&&jumpAge<secondCue)text='조금 더 날아가요…';
  else if(longFlight&&game.jumpCount===1&&jumpAge>=secondCue&&jumpAge<=.85)text='지금 한 번 더 톡! ↑↑';
  else if(away<jumpCueSeconds(game.mode,next))text=next.taps===0?'낮아지는 길, 그대로 가요':next.taps===2?'지금 톡! 잠깐 뒤 다시 톡':'지금 톡! ↑';
  else if(away<1.3)text=next.hint || '앞에 장애물이 있어요';
  else if(game.elapsed<3)text='톡! 공중에서 한 번 더 톡!';
  $('hint').textContent=text;$('hint').classList.toggle('visible',Boolean(text));
  if(game.elapsed>=toastUntil)$('course-toast').classList.remove('visible');
}
function handleEvent(event) {
  if(event.type==='snack') {scene.collectEffect(event.x,event.y,event.value,event.kind);audio.play('collect',{combo:game.combo});}
  if(event.type==='land') scene.landEffect();
  if(event.type==='recover') { noticeUntil=game.elapsed+.9; scene.puff(CAT_X+66,GROUND-game.y-25,12,0xb6f0df); announce('안전한 바닥으로 돌아왔어요. 다시 달려요.'); }
  if(event.type==='boost') { scene.puff(event.x,event.y+26,8,0xffe8b1); audio.play('boost'); }
  if(event.type==='clear') {scene.clearEffect(event.x, event.y);if(game.streak && game.streak%3===0)toast(`${game.streak}번 연속 폴짝!`,1.25);}
  if(event.type==='hit') {noticeUntil=game.elapsed+1.4;scene.hitEffect();audio.play('hit');announce(`하악! ${event.reason==='fall'?'바닥에서 떨어졌어요.':'장애물에 닿았어요.'} 기운 ${game.hearts}개가 남았어요.`);}
}
for(const input of document.querySelectorAll('[name="mode"]')) {
  input.checked=input.value===mode;input.addEventListener('change',()=>{mode=input.value;saved.mode=mode;saved.paceVersion=4;save();});
}
$('start').addEventListener('click',start);$('again').addEventListener('click',start);
$('change-mode').addEventListener('click',showStart);$('restart').addEventListener('click',showStart);
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);
// Every release-then-press is one jump. Holding never changes height or repeats.
for (const target of [$('jump'), $('game-canvas')]) {
  target.addEventListener('pointerdown',pointerPress);
  target.addEventListener('pointerup',pointerRelease);
  target.addEventListener('pointercancel',pointerRelease);
  target.addEventListener('lostpointercapture',pointerRelease);
  target.addEventListener('contextmenu',event=>event.preventDefault());
}
window.addEventListener('pointerup',pointerRelease,true);
window.addEventListener('pointercancel',pointerRelease,true);
$('jump').addEventListener('click',event=>{if(event.detail===0)doJump();});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input'))return;
  if(game.status==='running'&&(event.code==='Space'||event.code==='ArrowUp')) {
    if(event.target.matches('button')&&event.target!==$('jump'))return;
    event.preventDefault();if(!event.repeat)beginJump(`key:${event.code}`);
  } else if((event.code==='Escape'||event.code==='KeyP')&&!event.repeat) {
    if(game.status==='running')pause();else if(game.status==='paused')resume();
  }
});
document.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='ArrowUp')endJump(`key:${event.code}`);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
$('sound').addEventListener('click',()=>{soundOn=audio.setEnabled(!soundOn);$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').textContent=soundOn?'소리 켜짐':'소리 꺼짐';if(soundOn&&game.status==='running'){audio.resume();audio.play('collect');}});
document.querySelector('.progress').setAttribute('aria-valuemax',String(ROUND_SECONDS));
document.querySelector('.card-note').textContent=`${ROUND_SECONDS}초 코스 · 기운 3개 · 점프 버튼 하나`;

function bootPhaser() {
  const Phaser = window.Phaser;
  class RunnerScene extends Phaser.Scene {
    constructor() { super('Runner'); this.boxes = new Map(); this.treats = new Map(); this.fx = []; this.lastFootstep = 0; this.landAt = -1; this.hissAt = -1; }
    preload() {
      this.load.image('fuwa', './assets/fuwa-generated.png');
      this.load.image('motion', './assets/fuwa-motion-v1.png');
      this.load.image('hiss', './assets/fuwa-hiss-v1.png');
      this.load.image('alley', './assets/moonlit-alley-v1.png');
      this.load.on('loaderror', () => { loaded = false; $('start').textContent = '그림을 불러오지 못했어요'; announce('그림을 불러오지 못했어요. 페이지를 새로고침해 주세요.'); });
    }
    create() {
      scene = this;
      if (!['fuwa', 'motion', 'hiss', 'alley'].every(key => this.textures.exists(key))) return;
      this.textures.get('fuwa').add('trimmed', 0, 51, 96, 1449, 810);
      this.textures.get('hiss').add('trimmed', 0, 50, 85, 1600, 740);
      const atlas = this.textures.get('motion');
      // Equal normalized cells, using rounded shared edges. Common registration
      // preserves the real flight poses instead of grounding every paw separately.
      for (let i = 0; i < 8; i++) {
        const x = Math.round((i % 4) * 443.5), next = Math.round((i % 4 + 1) * 443.5);
        atlas.add(`pose-${i}`, 0, x, Math.round(Math.floor(i / 4) * 443.5) + 65, next - x, 310);
      }
      this.makeTextures();
      this.backdrop = this.add.image(0, 0, 'alley').setOrigin(0).setDepth(-12);
      this.moonGlow = this.add.circle(this.scale.width * .8, 60, 40, 0xf4d99e, .06).setDepth(-11);
      this.moon = this.add.circle(this.scale.width * .8, 60, 19, 0xffeac2, .86).setDepth(-10);
      this.moonShade = this.add.circle(this.scale.width * .8 - 7, 54, 18, 0x143b4b).setDepth(-10);
      this.terrain = this.add.graphics().setDepth(-3);
      this.rescue = this.add.ellipse(CAT_X+66,GROUND-48,180,118).setStrokeStyle(4,0xb6f0df,.9).setVisible(false).setDepth(12);
      this.lamps = Array.from({length: 5}, () => this.add.image(0, GROUND - 23, 'lamp').setOrigin(.5, 1).setDepth(-6));
      this.fireflies = Array.from({length: 15}, (_, i) => this.add.circle((i * 137 + 40) % this.scale.width, 90 + (i * 43) % 170, i % 3 ? 1.5 : 2.2, 0xffdfa0, .25).setDepth(-4));
      this.shadow = this.add.ellipse(CAT_X + 65, GROUND + 5, 115, 13, 0x08252b, .36).setDepth(1);
      this.cat = this.add.image(CAT_X + 66, GROUND + 2, 'fuwa', 'trimmed').setOrigin(.5, 1).setDisplaySize(174, 97.3).setDepth(10);
      this.ring = this.add.ellipse(CAT_X + 70, GROUND - 47, 142, 108).setStrokeStyle(2, 0xffebad, .8).setVisible(false).setDepth(11);
      this.finishGate = this.add.container(0, GROUND).setDepth(4);
      this.finishGate.add(this.add.image(0, 0, 'garden-gate').setOrigin(.5, 1));
      this.finishGate.add(this.add.text(0, -125, '달빛 정원', {fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffedc7'}).setOrigin(.5));
      const resize = size => {
        this.cameraTop=GROUND-size.height*.82;
        this.cameras.main.setScroll(0,this.cameraTop);
        const backgroundWidth = Math.max(size.height*3, size.width + 220);
        this.backdrop.setDisplaySize(backgroundWidth, backgroundWidth / 3).setY(this.cameraTop+size.height-backgroundWidth/3);
        this.moon.x = this.moonGlow.x = size.width * .8; this.moonShade.x = size.width * .8 - 7;
        this.moon.y=this.moonGlow.y=this.cameraTop+80; this.moonShade.y=this.cameraTop+74;
        game.width = size.width;
      };
      this.scale.on('resize', resize); resize(this.scale);
      loaded = true; $('start').disabled = false; $('start').innerHTML = '달리기 시작 <span aria-hidden="true">→</span>';
      this.resetRun(); updateHUD();
    }
    makeTextures() {
      const make = (name, w, h, draw) => { const t = this.textures.createCanvas(name, w, h); draw(t.context); t.refresh(); };
      const rounded = (c, x, y, w, h, r, fill, stroke) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } };
      const star = (c, x, y, r, color) => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .46 : r; const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fillStyle = color; c.fill(); };
      const crate = (c, x, y, w, h) => {
        const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#e7b97e'); g.addColorStop(1, '#a86b45');
        rounded(c, x, y, w, h, 3, g, '#5a3c31');
        c.strokeStyle = '#895b3f'; c.lineWidth = 1.3;
        for (const offset of [.33, .67]) { c.beginPath(); c.moveTo(x + 2, y + h * offset); c.lineTo(x + w - 2, y + h * offset); c.stroke(); }
        rounded(c, x + w * .41, y + 1, w * .18, h - 2, 1, '#efcf9a');
        c.fillStyle = '#694a33'; for (const xx of [x + 5, x + w - 5]) for (const yy of [y + 5, y + h - 5]) c.fillRect(xx, yy, 1.5, 1.5);
      };
      make('crate', 54, 42, c => { c.fillStyle = '#08252b55'; c.beginPath(); c.ellipse(27, 35, 25, 5, 0, 0, Math.PI * 2); c.fill(); crate(c, 8, 2, 38, 30); });
      make('stack', 60, 124, c => {
        c.fillStyle = '#08252b55'; c.beginPath(); c.ellipse(30, 117, 29, 5, 0, 0, Math.PI * 2); c.fill();
        crate(c, 8, 2, 44, 36); crate(c, 8, 40, 44, 36); crate(c, 8, 78, 44, 36);
        c.strokeStyle = '#fff1bc'; c.lineWidth = 3; c.lineCap = 'round';
        for (const y of [50, 61]) { c.beginPath(); c.moveTo(22, y + 5); c.lineTo(30, y - 2); c.lineTo(38, y + 5); c.stroke(); }
      });
      make('planter', 94, 54, c => {
        c.fillStyle = '#08252b55'; c.beginPath(); c.ellipse(47, 47, 44, 5, 0, 0, Math.PI * 2); c.fill();
        rounded(c, 9, 17, 76, 27, 4, '#a66150', '#563b38'); rounded(c, 8, 16, 78, 8, 3, '#dc9b75', '#70493c');
        c.strokeStyle = '#cb8465'; c.lineWidth = 2; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(19 + i * 14, 26); c.lineTo(21 + i * 14, 42); c.stroke(); }
        for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#73996c' : '#99b181'; c.beginPath(); c.ellipse(15 + i * 8, 13 - i % 3 * 3, 9, 5, i % 2 ? .7 : -.7, 0, Math.PI * 2); c.fill(); }
        for (const x of [28, 59, 72]) { c.fillStyle = '#f0cca1'; c.beginPath(); c.arc(x, 8, 3, 0, Math.PI * 2); c.fill(); }
      });
      make('fish', 44, 32, c => {
        c.shadowColor = '#ffcc6d'; c.shadowBlur = 7; c.fillStyle = '#ffd478'; c.beginPath(); c.moveTo(4, 7); c.lineTo(4, 25); c.lineTo(18, 16); c.fill();
        c.beginPath(); c.ellipse(26, 16, 14, 10, 0, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#9d722b'; c.lineWidth = 1.5; c.stroke();
        c.fillStyle = '#fff2c8'; c.beginPath(); c.ellipse(24, 12, 7, 2, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#6c4b25'; c.beginPath(); c.arc(33, 14, 1.8, 0, Math.PI * 2); c.fill();
      });
      make('star', 48, 48, c => { c.shadowColor = '#ffe6a1'; c.shadowBlur = 12; star(c, 24, 24, 17, '#ffdb7c'); c.shadowBlur = 0; star(c, 24, 23, 10, '#fff2bc'); });
      make('fence', 240, 32, c => { c.fillStyle = '#183d40'; c.fillRect(0, 0, 240, 32); c.fillStyle = '#4e6c60'; c.fillRect(0, 0, 240, 3); c.strokeStyle = '#34534e'; c.lineWidth = 1; for (let x = 0; x < 240; x += 60) { c.strokeRect(x, 4, 60, 12); c.strokeRect(x - 30, 18, 60, 13); } });
      make('road', 320, 62, c => {
        const g = c.createLinearGradient(0, 0, 0, 62); g.addColorStop(0, '#75918a'); g.addColorStop(1, '#365b61'); c.fillStyle = g; c.fillRect(0, 0, 320, 62);
        c.fillStyle = '#c4c3a3'; c.fillRect(0, 0, 320, 4); c.fillStyle = '#264e55'; c.fillRect(0, 5, 320, 3);
        c.strokeStyle = '#9baba044'; c.lineWidth = 1; for (let i = 0; i < 5; i++) { c.strokeRect(i * 75 - 25, 13, 72, 16); c.strokeRect(i * 75 + 12, 34, 72, 18); }
      });
      make('lamp', 100, 215, c => {
        const glow = c.createRadialGradient(50, 43, 1, 50, 43, 45); glow.addColorStop(0, '#ffd58f33'); glow.addColorStop(1, '#ffd58f00'); c.fillStyle = glow; c.fillRect(0, 0, 100, 100);
        rounded(c, 47, 46, 6, 169, 2, '#284647'); rounded(c, 35, 17, 30, 43, 5, '#edc080', '#293f41');
        c.fillStyle = '#fff1bd'; c.fillRect(40, 23, 20, 31); c.strokeStyle = '#8c7654'; c.beginPath(); c.moveTo(50, 19); c.lineTo(50, 59); c.stroke();
        rounded(c, 31, 13, 38, 7, 3, '#355052'); rounded(c, 33, 60, 34, 6, 3, '#355052');
      });
      make('garden-gate', 200, 175, c => {
        for (const x of [25, 163]) rounded(c, x, 28, 12, 147, 4, '#42695b', '#173e42');
        rounded(c, 15, 20, 170, 45, 8, '#30554c', '#9da77a');
        c.strokeStyle = '#739373'; c.lineWidth = 3; c.beginPath(); c.moveTo(18, 172); c.quadraticCurveTo(0, 10, 100, 5); c.quadraticCurveTo(200, 10, 182, 172); c.stroke();
        for (let i = 0; i < 14; i++) { const x = i % 2 ? 180 : 20, y = 35 + i * 9; c.fillStyle = i % 3 ? '#799966' : '#a3b77c'; c.beginPath(); c.ellipse(x + (i % 3 - 1) * 8, y, 12, 5, i % 2 ? -.6 : .6, 0, Math.PI * 2); c.fill(); }
      });
    }
    resetRun() {
      this.tweens.killAll(); for (const item of this.fx) item.destroy(); this.fx = [];
      for (const item of this.boxes.values()) item.destroy(); for (const item of this.treats.values()) item.destroy(); this.boxes.clear(); this.treats.clear();
      this.lastFootstep = 0; this.landAt = -1; this.hissAt = -1; this.finishGate?.setVisible(false);
      this.cat?.setAngle(0).setAlpha(1).clearTint();
    }
    puff(x, y, count = 4, color = 0xf6e4b8) {
      if (reducedMotion.matches) return;
      for (let i = 0; i < count; i++) { const dot = this.add.circle(x, y, 2 + i % 3, color, .85).setDepth(13); this.fx.push(dot);
        this.tweens.add({targets: dot, x: x - 22 + i * 7, y: y - 14 - i % 3 * 7, alpha: 0, scale: .2, duration: 340 + i * 15, onComplete: () => this.removeEffect(dot)}); }
    }
    removeEffect(item) { item.destroy(); this.fx = this.fx.filter(o => o !== item); }
    jumpEffect() { this.puff(CAT_X + 66, GROUND - game.y - 2, 6); }
    landEffect() { this.landAt = visualClock; this.puff(CAT_X + 66, GROUND - game.y - 1, 6, 0xa5b8aa); }
    collectEffect(x, y, value = 10, kind = 'fish') {
      this.puff(x, y, kind === 'star' ? 10 : 5, kind === 'star' ? 0xffe6a1 : 0xffdf8d);
      const label = this.add.text(x, y - 10, `+${value}`, {fontFamily: 'sans-serif', fontSize: kind === 'star' ? '23px' : '17px', fontStyle: 'bold', color: '#fff1ba', stroke: '#21494b', strokeThickness: 3}).setOrigin(.5).setDepth(15); this.fx.push(label);
      this.tweens.add({targets: label, y: y - 45, alpha: 0, duration: 600, onComplete: () => this.removeEffect(label)});
    }
    clearEffect() { if (game.streak % 3 === 0) this.puff(CAT_X + 80, GROUND - game.y - 70, 8, 0xe5f4b9); }
    hitEffect() {
      this.hissAt = visualClock;
      if (!reducedMotion.matches) this.cameras.main.shake(100, .002);
      this.puff(CAT_X + 96, GROUND - game.y - 24, 7, 0xf7bd8b);
      const label=this.add.text(CAT_X+114,GROUND-game.y-115,'하악!',{fontFamily:'sans-serif',fontSize:'26px',fontStyle:'bold',color:'#ffe0bb',stroke:'#263b43',strokeThickness:4}).setOrigin(.5).setDepth(16);
      this.fx.push(label);
      this.tweens.add({targets:label,y:label.y-(reducedMotion.matches?0:12),alpha:0,duration:620,onComplete:()=>this.removeEffect(label)});
    }
    finishEffect() { if (!reducedMotion.matches) { this.puff(this.scale.width * .25, this.cameraTop+150, 14, 0xffd88f); this.puff(this.scale.width * .75, this.cameraTop+150, 14, 0xbfd9a8); } }
    drawTerrain() {
      const g=this.terrain, bottom=this.cameraTop+this.scale.height+100;
      g.clear();
      for(const hole of game.obstacles.filter(o=>o.kind==='gap')){g.fillStyle(0x071b28,.94);g.fillRect(hole.x,(hole.baseY??GROUND)+4,hole.w,bottom-(hole.baseY??GROUND));}
      // No road texture spans a hole. Exposed side faces make every lip explicit.
      for(const segment of terrainSegments(game)) {
        const left=Math.max(-50,segment.x),right=Math.min(this.scale.width+50,segment.x+segment.w);
        if(right<=left)continue;
        const top=segment.baseY;
        g.fillStyle(0x244b52);g.fillRect(left,top,right-left,bottom-top);
        g.fillStyle(0x527b78);g.fillRect(left,top,right-left,18);
        g.fillStyle(0xd2c398);g.fillRect(left,top,right-left,4);
        g.fillStyle(0x173840);g.fillRect(left,top+18,right-left,4);
        g.lineStyle(1,0x76928a,.4);
        const gridOffset=((game.distance%80)+80)%80;
        for(let x=Math.floor((left+gridOffset)/80)*80-gridOffset;x<right;x+=80){
          g.lineBetween(Math.max(left,x),top+37,Math.min(right,x+78),top+37);
          if(x>=left)g.lineBetween(x,top+22,x+8,top+36);
        }
        for(const edge of [segment.x,segment.x+segment.w])if(edge>=-8&&edge<=this.scale.width+8){
          g.fillStyle(0x112f38);g.fillRect(edge-4,top+4,8,bottom-top);
          g.fillStyle(0xf6d286);g.fillRect(edge-7,top,14,5);
        }
      }
    }
    hazardSprite(box) {
      const node=this.add.container(0,0).setDepth(5),g=this.add.graphics();node.add(g);
      if(box.kind==='crate') {
        const sx=box.w/38,sy=box.h/30;const image=this.add.image(-8*sx,10*sy,'crate').setOrigin(0,1);image.setScale(sx,sy);node.add(image);
      } else if(box.kind==='high') {
        // Visible edges match the full solid stack. Repeated slats read as a
        // much taller obstacle; the fixed two-chevron badge survives narrow viewports.
        const rows=3, gap=3, rowH=(box.h-gap*(rows-1))/rows;
        for(let i=0;i<rows;i++) {
          const y=-box.h+i*(rowH+gap);
          g.fillStyle(i%2?0xb3754f:0xc88c5a);g.fillRoundedRect(0,y,box.w,rowH,3);
          g.lineStyle(2,0x4b3430);g.strokeRoundedRect(0,y,box.w,rowH,3);
          g.lineStyle(2,0xe6b57a);g.lineBetween(4,y+4,box.w-4,y+4);
          g.lineStyle(2,0x87583f);g.lineBetween(5,y+rowH*.55,box.w-5,y+rowH*.55);
        }
        g.fillStyle(0x263e46,.96);g.fillRoundedRect(box.w/2-19,-box.h*.56-22,38,43,6);
        g.lineStyle(4,0xffe6a9);
        for(const y of [-box.h*.56-9,-box.h*.56+4]){g.lineBetween(box.w/2-10,y+5,box.w/2,y-4);g.lineBetween(box.w/2,y-4,box.w/2+10,y+5);}
      } else if(box.kind==='long') {
        // A continuous planter rail, with the exact collision width, not separate boxes.
        g.fillStyle(0x9c6650);g.fillRoundedRect(0,-box.h,box.w,box.h,4);
        g.lineStyle(2,0x392e2b);g.strokeRoundedRect(0,-box.h,box.w,box.h,4);
        g.fillStyle(0xd2a07b);g.fillRect(0,-box.h,box.w,6);
        g.lineStyle(2,0x674e42);
        for(let x=16;x<box.w;x+=32)g.lineBetween(x,-box.h+8,x,0);
        for(let x=12;x<box.w;x+=23){g.fillStyle(x%2?0x96b28a:0x73936b);g.fillEllipse(x,-box.h+2,20,8);}
        g.lineStyle(3,0xffe3a0);for(const x of [box.w*.45,box.w*.55]){g.lineBetween(x-6,-box.h-8,x,-box.h-14);g.lineBetween(x,-box.h-14,x+6,-box.h-8);}
      } else {
        const color=box.kind==='gap'?0xefb47b:0xb8d2a0;
        const edges=box.kind==='gap'?[0,box.w]:[0];
        for(const x of edges){g.lineStyle(3,color);g.lineBetween(x,-26,x,-4);g.fillStyle(color);g.fillTriangle(x,-27,x+15,-23,x,-17);}
        if(box.kind==='step') {g.lineStyle(3,color);g.lineBetween(12,-14,22,-24);g.lineBetween(22,-24,32,-14);}
        if(box.kind==='drop') {g.lineStyle(3,color);g.lineBetween(12,-24,22,-14);g.lineBetween(22,-14,32,-24);}
      }
      return node;
    }
    syncObjects() {
      this.drawTerrain();
      const boxes = new Set(game.obstacles.map(o => o.id)); for (const [id, sprite] of this.boxes) if (!boxes.has(id)) { sprite.destroy(); this.boxes.delete(id); }
      for (const box of game.obstacles) { let sprite = this.boxes.get(box.id); if (!sprite) { sprite = this.hazardSprite(box); this.boxes.set(box.id, sprite); } const markerY=box.kind==='drop'?GROUND-(floorAt(box.encounterAt-.001)??0):(box.baseY??GROUND);sprite.setPosition(box.x,markerY).setAlpha(box.hit ? .5 : 1); }
      const treats = new Set(game.treats.map(t => t.id)); for (const [id, sprite] of this.treats) if (!treats.has(id)) { sprite.destroy(); this.treats.delete(id); }
      for (const treat of game.treats) { let sprite = this.treats.get(treat.id); if (!sprite) { sprite = this.add.image(treat.x, treat.y, treat.kind || 'fish').setDepth(6); this.treats.set(treat.id, sprite); } const pulse = reducedMotion.matches ? 1 : 1 + Math.sin(visualClock * 5 + treat.id) * .05; sprite.setPosition(treat.x, treat.y).setScale(pulse); if (treat.kind === 'star') sprite.setAngle(reducedMotion.matches ? 0 : Math.sin(visualClock * 3) * 9); }
    }
    update(time, delta) {
      if (!loaded) return;
      if (game.status === 'running') {
        visualClock += Math.min(delta / 1000, .1); let remaining = Math.min(delta / 1000, .1);
        while (remaining > 0) { const dt = Math.min(remaining, 1 / 120); step(game, dt); for (const event of game.events || []) handleEvent(event); remaining -= dt; if (game.status !== 'running') break; }
        updateHUD();
        if(game.status==='won') finish();
        else if(game.status==='finished') {
          endJump(); $('pause').disabled=$('jump').disabled=true;
          terminalFeedbackUntil=visualClock+.62;
          // Stop the melody immediately, but let the last short hiss finish.
          audio.stop({preserveHit:true});
        }
      }
      if(game.status==='finished'&&!finished) {
        visualClock+=Math.min(delta/1000,.1);
        if(visualClock>=terminalFeedbackUntil) finish();
      }
      const running = game.status === 'running', activePose = game.status === 'running' || game.status === 'paused';
      const hissAge=this.hissAt<0?Infinity:visualClock-this.hissAt;
      const hissing=hissAge>=0&&hissAge<.55;
      if(hissing) {
        // One generated expression pose plus a short procedural recoil, not
        // a frame-by-frame facial animation. Its paws share the ground anchor.
        this.cat.setTexture('hiss','trimmed').setOrigin(.5,723/740).setDisplaySize(186,86.025).setAngle(reducedMotion.matches?0:-3*Math.sin(Math.PI*hissAge/.55));
      } else if (activePose) {
        const pose = !game.grounded ? (game.vy > 0 ? 6 : 7) : Math.floor(visualClock * 13 * MODES[game.mode].speed / 360) % 6;
        this.cat.setTexture('motion', `pose-${pose}`).setOrigin(.5, 295 / 310).setScale(.42).setAngle(0);
      } else this.cat.setTexture('fuwa', 'trimmed').setOrigin(.5, 1).setDisplaySize(174, 97.3).setAngle(0);
      const recoil=hissing&&!reducedMotion.matches?10*Math.sin(Math.PI*hissAge/.55):0;
      this.cat.setPosition(CAT_X + 66-recoil, GROUND - game.y + 1);
      const rescuing=game.elapsed<game.recoveryUntil;
      this.cat.setAlpha(rescuing?.45:game.invincible>0?.72:1);
      this.rescue.setPosition(CAT_X+66,GROUND-game.y-48).setVisible(rescuing);
      const heightAboveFloor=game.floorHeight===null?200:Math.max(0,game.y-game.floorHeight);
      this.shadow.setPosition(CAT_X+65,GROUND-(game.floorHeight??0)+5).setVisible(game.floorHeight!==null&&!rescuing).setScale(Math.max(.42,1-heightAboveFloor/400),1).setAlpha(Math.max(0,.34-heightAboveFloor/1000));
      this.ring.setPosition(CAT_X + 70, GROUND - game.y - 47).setVisible(game.invincible > 0);
      const distance = reducedMotion.matches ? 0 : game.distance;
      this.backdrop.x = -Math.min(200, distance * .012);
      for (let i = 0; i < this.lamps.length; i++) this.lamps[i].x = ((i * 340 + 240 - distance * .32) % 1700 + 1700) % 1700 - 100;
      for (let i = 0; i < this.fireflies.length; i++) { const dot = this.fireflies[i]; dot.x = ((i * 137 + 40 - distance * .08) % (this.scale.width + 40) + this.scale.width + 40) % (this.scale.width + 40); dot.y = 90 + (i * 43) % 170 + (reducedMotion.matches ? 0 : Math.sin(visualClock * .8 + i) * 7); dot.setAlpha(.18 + (reducedMotion.matches ? .1 : Math.sin(visualClock * 1.5 + i) * .12 + .12)); }
      this.syncObjects();
      if (running && game.grounded && !rescuing && visualClock - this.lastFootstep > .16) { this.lastFootstep = visualClock; this.puff(CAT_X + 42, GROUND-game.y, 2, 0xc0c1a8); }
      const gateX = CAT_X + 160 + (ROUND_SECONDS - game.elapsed) * MODES[game.mode].speed;
      this.finishGate.setPosition(gateX, GROUND).setVisible(gateX < this.scale.width + 140);
    }
  }
  const host=$('scene');
  let view=worldViewport(host.clientWidth,host.clientHeight);
  renderer = new Phaser.Game({type: Phaser.AUTO, parent: 'game-canvas', width:view.width, height:view.height, transparent: true, antialias: true, roundPixels: false,
    scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY}, scene: RunnerScene,
    input: {activePointers: 2}, audio: {noAudio: true}, fps: {target: 60, forceSetTimeOut: false}, banner: false});
  new ResizeObserver(() => {
    const next=worldViewport(host.clientWidth,host.clientHeight);
    if(next.width!==view.width||next.height!==view.height){pause();view=next;renderer.scale.setGameSize(view.width,view.height);}
    renderer.scale.refresh();
  }).observe(host);
}
if (window.Phaser) bootPhaser(); else { $('start').textContent = '게임을 불러오지 못했어요'; announce('게임 파일을 불러오지 못했어요. 새로고침해 주세요.'); }
updateHUD();
