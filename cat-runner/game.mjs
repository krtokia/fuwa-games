import { MODES, STARTING_SECONDS, POTION_SECONDS, COLLISION_PENALTY_SECONDS, GROUND, CAT_X, createGame, jump, pressJump, releaseJump, step, jumpCueSeconds, terrainSegments, nextCue, floorAt, advanceReaction, HIT_REACTION_SECONDS, secondJumpCueSeconds } from './engine.mjs';
import { worldViewport } from './viewport.mjs';
import { RunnerAudio } from './audio.mjs';
import { runnerPose, actionFloorLift, reactionPose } from './animation.mjs';
import { CHARACTER_IDS, CHARACTERS, getCharacter, movementFrame, characterAtlases, atlasFrame, atlasAnchor } from './characters.mjs';

// Phaser owns rendering, scene timing, particles and tweens. Native input supplies tap edges.
// The deterministic rule model stays separate so the course is testable without a GPU.
const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STORAGE_KEY = 'fuwa-runner.v2';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch {}
if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
// Pace changed in v0.4: start everyone on the new runner speed once, then remember their choice.
let selectedCharacterId = getCharacter(saved.character).id;
const character = () => getCharacter(selectedCharacterId);
let mode = saved.paceVersion === 4 && typeof saved.mode === 'string' && Object.hasOwn(MODES, saved.mode) ? saved.mode : 'normal';
function freshSeed() {
  if(globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return (Date.now() ^ Math.floor(Math.random()*0x100000000)) >>> 0;
}
function linkSeed() {
  const value=new URLSearchParams(globalThis.location?.search || '').get('seed');
  return value && /^[0-9a-f]{1,8}$/i.test(value) ? parseInt(value,16) >>> 0 : null;
}
const seedLabel=seed=>(seed>>>0).toString(16).padStart(8,'0');
let nextSeed=linkSeed() ?? freshSeed();
let game = createGame(mode, 720, {seed:nextSeed});
let scene, renderer, loaded = false, soundOn = false;
const audio = new RunnerAudio();
let noticeUntil = 0, toastUntil = 0, lastSecond = -1, lastSnacks = -1, lastPotions = -1;
let lastSegment = '', finished = false, visualClock = 0;
let heldInput = null;
let pausedStatus = null;
let restoreJumpFocus = false;

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {} }
function announce(text) { $('announcement').textContent = text; }
function paintPortrait(element, record) {
  const art=record.portrait, crop=art.crop ?? [0,0,1,1];
  element.style.backgroundImage=`url("${art.path}")`;
  element.style.backgroundSize=art.columns===1?'contain':`${art.columns/crop[2]*100}% ${art.rows/crop[3]*100}%`;
  element.style.backgroundPosition=art.columns===1?'center':`${crop[0]/(art.columns-crop[2])*100}% ${crop[1]/(art.rows-crop[3])*100}%`;
  element.style.aspectRatio=String((art.cellAspect ?? 1.5)*crop[2]/crop[3]);
}
function updateCharacterUI() {
  const current = character();
  for (const id of CHARACTER_IDS) {
    const input = $(`character-${id}`), preview = $(`character-preview-${id}`), record = CHARACTERS[id];
    input.checked = id === current.id;
    paintPortrait(preview,record);
  }
  const portrait = $('character-portrait');
  paintPortrait(portrait,current);
  portrait.setAttribute('aria-label', current.description);
  $('start-title').textContent = `오늘 밤, ${current.withName} 달려요`;
  $('character-reaction').textContent = `부딪히면 ${current.reaction.description}`;
  $('pause-copy').textContent = `${current.subject} 기다리고 있어요.`;
  $('runner-name').textContent = current.name;
  const star=Object.assign(document.createElement('span'),{className:'title-star',textContent:'✦'});star.setAttribute('aria-hidden','true');
  $('page-title').replaceChildren(document.createTextNode(`${current.name} 달리기`),star);
  $('game-canvas').setAttribute('aria-label', `달빛 비치는 골목을 달리는 ${current.name}. 장애물을 넘고 간식과 시간 포션을 모아요.`);
  $('game-shell').setAttribute('aria-label', `${current.name} 달리기 게임`);
  document.title = `${current.name} 달리기 · 후와 게임`;
}
function selectCharacter(id) {
  // The picker is only active on the start screen. A resumed/fatal reaction
  // cannot change character or leak a new pose/sound into an ongoing run.
  if (game.status !== 'ready' || $('start-card').hidden || !CHARACTER_IDS.includes(id)) return false;
  selectedCharacterId = id; saved.character = id; save();
  updateCharacterUI(); scene?.resetRun();
  announce(`${character().name} 선택. 부딪히면 ${character().reaction.description}.`);
  return true;
}
function overlay(card) {
  $('overlay').hidden = !card;
  for (const id of CHARACTER_IDS) $(`character-${id}`).disabled = card !== 'start-card';
  for (const id of ['start-card', 'result-card', 'pause-card']) $(id).hidden = id !== card;
}
function start(seed=nextSeed) {
  if (!loaded) return;
  endJump();
  game = createGame(mode, scene.scale.width, {seed}); game.status = 'running';
  nextSeed=game.seed;
  noticeUntil = 0; toastUntil = 0; finished = false; lastSegment = '';
  lastSecond = lastSnacks = lastPotions = -1; visualClock = 0; pausedStatus = null; restoreJumpFocus = false;
  scene.resetRun(); overlay(null);
  $('pause').disabled = false; $('jump').disabled = false;
  $('jump').focus({ preventScroll: true });
  announce(`${character().name}, ${MODES[mode].label} 시작. 한 번 톡 누르면 낮게, 공중에서 한 번 더 누르면 2단 점프해요.`);
  audio.start(); updateHUD();
}
function doJump() {
  if (game.status !== 'running' || game.reactionRemaining > 0 || heldInput !== null) return;
  if (jump(game)) jumpFeedback();
}
function jumpFeedback() {
  if (game.jumpCount === 1) { scene.jumpEffect(); audio.play('jump'); }
  else if (game.jumpCount === 2) { scene.boostEffect(); audio.play('boost'); }
  updateHUD();
}
function beginJump(source) {
  if (game.status !== 'running' || game.reactionRemaining > 0 || heldInput !== null) return;
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
  if (!event.isPrimary || event.button !== 0 || game.status !== 'running' || game.reactionRemaining > 0) return;
  event.preventDefault();
  const source = `pointer:${event.pointerId}`;
  if (heldInput !== null) return;
  beginJump(source);
  try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
}
function pointerRelease(event) { endJump(`pointer:${event.pointerId}`); }
function pause() {
  endJump();
  if (game.status !== 'running' && !(game.status === 'finished' && game.reactionRemaining > 0)) return;
  pausedStatus = game.status; game.status = 'paused'; scene.tweens.pauseAll(); audio.pause();
  $('pause').disabled = $('jump').disabled = true;
  overlay('pause-card'); $('resume').focus({ preventScroll:true }); announce('잠깐 쉬는 중.');
}
function resume() {
  if (game.status !== 'paused') return;
  game.status = pausedStatus === 'finished' ? 'finished' : 'running'; pausedStatus = null;
  restoreJumpFocus = game.reactionRemaining > 0;
  if (game.reactionRemaining <= 0) { scene.tweens.resumeAll(); audio.resume(); }
  overlay(null); $('pause').disabled = false; $('jump').disabled = game.reactionRemaining > 0;
  (game.reactionRemaining > 0 ? $('pause') : $('jump')).focus({ preventScroll:true });
  updateHUD(); announce(game.reactionRemaining > 0 ? `${character().reaction.name} 동작이 끝나면 이어서 달려요.` : '이어서 산책해요.');
}
function showStart() {
  endJump(); audio.stop();
  scene?.tweens.resumeAll(); game = createGame(mode, scene?.scale.width || 720, {seed:nextSeed}); finished = false;
  pausedStatus = null; restoreJumpFocus = false; scene?.resetRun(); $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  overlay('start-card'); $('start').focus({preventScroll:true}); updateHUD();
}
function finish() {
  if (finished) return; finished = true; restoreJumpFocus = false;
  endJump();
  $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  const key = `score_v11_${game.mode}`;
  const previous = Number.isFinite(saved[key]) ? Math.max(0,saved[key]) : 0;
  saved[key] = Math.max(previous,game.score); saved.mode=mode; saved.paceVersion=4; save();
  $('result-kicker').textContent = `${character().name} · 달빛 골목 · 시간 기록`;
  $('result-title').textContent = '오늘은 여기까지!';
  $('result-score').textContent = game.score.toLocaleString();
  $('result-rating').textContent = game.hitCount===0 ? '깔끔한 달리기!' : '다음엔 조금 더 멀리!';
  $('result-copy').textContent = `${game.elapsed.toFixed(1)}초 달리기 · 포션 ${game.potions}개 · 충돌 ${game.hitCount}번 · 간식 ${game.snacks}개 · 별 ${game.stars}개`;
  $('result-seed').textContent = `길 번호 ${seedLabel(game.seed)} · 같은 길로 다시 도전할 수 있어요`;
  $('record').textContent = `${game.score>previous?'새 기록! ':''}${MODES[mode].label} 최고 ${saved[key].toLocaleString()}점`;
  overlay('result-card'); $('again').focus({preventScroll:true});
  announce(`${$('result-title').textContent}. ${$('result-copy').textContent}`);
  audio.stop(); audio.play('finish');
}
function toast(text, duration=1.5) {
  $('course-toast').textContent=text; $('course-toast').classList.add('visible'); toastUntil=game.elapsed+duration;
}
function updateHUD() {
  const seconds=Math.max(0,Math.ceil(game.remainingTime));
  $('score').textContent=game.score.toLocaleString();
  $('combo').textContent=game.streak>0?`${game.streak} COMBO`:'—';
  if(seconds!==lastSecond) {
    $('time').replaceChildren(document.createTextNode(String(seconds)),Object.assign(document.createElement('span'),{textContent:'초'}));
    document.querySelector('.progress').setAttribute('aria-valuenow',String(seconds));
    document.querySelector('.progress').setAttribute('aria-valuemax',String(Math.max(STARTING_SECONDS,seconds))); lastSecond=seconds;
  }
  if(lastSnacks!==game.snacks) {$('snacks').textContent=game.snacks;lastSnacks=game.snacks;}
  if(lastPotions!==game.potions) {$('potions').textContent=game.potions;lastPotions=game.potions;}
  $('seed-label').textContent=seedLabel(game.seed);
  $('time').classList.toggle('low-time',game.remainingTime<=10);
  $('progress-fill').style.width=`${Math.min(1,Math.max(0,game.remainingTime/STARTING_SECONDS))*100}%`;
  document.querySelector('.progress').classList.toggle('low-time',game.remainingTime<=10);
  if(game.segment?.name) {
    $('segment-label').textContent=game.segment.name;
    if(lastSegment!==game.segment.id) {if(lastSegment && game.status==='running')toast(game.segment.name,2);lastSegment=game.segment.id;}
  }
  const reacting=game.reactionRemaining>0;
  const airborne=game.status==='running' && !reacting && !game.grounded;
  const canDouble=airborne && game.jumpCount===1;
  $('jump-label').textContent=canDouble?'한 번 더':'점프';
  $('jump').classList.toggle('can-double',canDouble);
  $('jump-state').textContent=canDouble?'공중에서 한 번 더 가능':airborne?'착지하면 다시 점프해요':'한 번 톡 = 낮은 점프';
  if(reacting) {
    $('jump').disabled=true; $('jump-label').textContent='잠깐';
    $('jump-state').textContent=game.remainingTime>0?character().reaction.waiting:character().reaction.terminal;
    $('hint').textContent=`${character().reaction.label} -${game.collisionPenaltySeconds}초 · 잠깐만요…`; $('hint').classList.add('visible');
    $('course-toast').classList.remove('visible'); return;
  }
  if(game.status!=='running') return;
  $('jump').disabled=game.elapsed<game.recoveryUntil;
  if(restoreJumpFocus&&!$('jump').disabled) {
    if(document.activeElement===$('pause')||document.activeElement===$('resume'))$('jump').focus({preventScroll:true});
    restoreJumpFocus=false;
  }
  if(game.elapsed<game.recoveryUntil)$('jump-state').textContent='구조 뒤 다시 달려요';
  const next=nextCue(game);
  const longFlight=game.obstacles.find(o=>o.taps===2&&!o.hit&&!o.cleared&&game.elapsed>=o.encounterAt-jumpCueSeconds(game.mode,o)-.15&&game.elapsed<=o.encounterAt+o.duration);
  const jumpAge=game.jumpStartedAt===null?Infinity:game.elapsed-game.jumpStartedAt;
  // Optional star branches never replace a required obstacle cue.
  const bonusFlight=game.obstacles.find(o=>Number.isFinite(o.bonusSecondCue)&&!o.hit&&
    game.jumpStartedAt!==null&&game.jumpStartedAt>=o.encounterAt-jumpCueSeconds(game.mode,o)-.15&&
    game.jumpStartedAt<=o.encounterAt+.1&&game.elapsed<=o.encounterAt+1.05);
  const secondCue=secondJumpCueSeconds(game.mode,longFlight);
  const away=next?(next.x-CAT_X-70)/MODES[game.mode].speed:Infinity;
  let text='';
  if(game.elapsed<game.recoveryUntil)text='안전한 바닥으로 구조 중';
  else if(game.elapsed<noticeUntil)text=character().reaction.resumed;
  else if(!game.grounded&&game.jumpCount>=2)text='사뿐히 착지해요';
  else if(longFlight&&game.jumpCount===1&&jumpAge<secondCue)text='조금 더 날아가요…';
  else if(longFlight&&game.jumpCount===1&&jumpAge>=secondCue)text='지금 한 번 더 톡! ↑↑';
  else if(bonusFlight&&game.jumpCount===1&&next&&next!==bonusFlight&&away<jumpCueSeconds(game.mode,next))text=next.taps===0?'낮아지는 길, 그대로 가요':next.taps===2?'지금 톡! 잠깐 뒤 다시 톡':'지금 톡! ↑';
  else if(bonusFlight&&game.jumpCount===1&&jumpAge>=bonusFlight.bonusSecondCue)text='별길은 선택! 한 번 더 톡';
  else if(bonusFlight&&game.jumpCount===1)text='민트 별은 선택 도전이에요';
  else if(away<jumpCueSeconds(game.mode,next))text=next.taps===0?'낮아지는 길, 그대로 가요':next.taps===2?'지금 톡! 잠깐 뒤 다시 톡':'지금 톡! ↑';
  else if(away<1.3)text=next.hint || '앞에 장애물이 있어요';
  else if(game.elapsed<3)text='톡! 공중에서 한 번 더 톡!';
  $('hint').textContent=text;$('hint').classList.toggle('visible',Boolean(text));
  if(game.elapsed>=toastUntil)$('course-toast').classList.remove('visible');
}
function handleEvent(event) {
  if(event.type==='snack') {scene.collectEffect(event.x,event.y,event.value,event.optional?'bonus-star':event.kind);audio.play('collect',{combo:game.combo});}
  if(event.type==='potion') {scene.collectEffect(event.x,event.y,event.seconds,'potion');audio.play('potion');toast(`시간 포션 +${event.seconds}초`,1.4);announce(`시간 포션! ${event.seconds}초 추가, ${Math.ceil(game.remainingTime)}초 남았어요.`);}
  if(event.type==='land') scene.landEffect(event.impactSpeed);
  if(event.type==='recover') { noticeUntil=game.elapsed+.9; scene.puff(CAT_X+66,GROUND-game.y-25,12,0xb6f0df); if(game.remainingTime>0)announce('안전한 바닥으로 돌아왔어요. 다시 달려요.'); }
  if(event.type==='clear') {scene.clearEffect(event.x, event.y);if(game.streak && game.streak%3===0)toast(`${game.streak}번 연속 폴짝!`,1.25);}
  if(event.type==='hit') {noticeUntil=game.elapsed+.6;endJump();scene.hitEffect();audio.play('hit',{reaction:character().reaction.sound});audio.pause({preserveHit:true});$('jump').disabled=true;$('pause').disabled=false;announce(`${character().name}, ${character().reaction.label} ${event.reason==='fall'?'바닥에서 떨어졌어요.':'장애물에 닿았어요.'} ${game.collisionPenaltySeconds}초 감소. ${Math.ceil(game.remainingTime)}초가 남았어요.`);}
}
for (const id of CHARACTER_IDS) $(`character-${id}`).addEventListener('change', () => { if (!selectCharacter(id)) updateCharacterUI(); });
for(const input of document.querySelectorAll('[name="mode"]')) {
  input.checked=input.value===mode;input.addEventListener('change',()=>{if(game.status!=='ready')return;mode=input.value;saved.mode=mode;saved.paceVersion=4;save();});
}
$('start').addEventListener('click',()=>start(nextSeed));
$('again').addEventListener('click',()=>start(game.seed));
$('new-course').addEventListener('click',()=>{nextSeed=freshSeed();if(nextSeed===game.seed)nextSeed=(nextSeed+1)>>>0;start(nextSeed);});
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
    if(game.status==='paused')resume();else pause();
  }
});
document.addEventListener('keyup',event=>{if(event.code==='Space'||event.code==='ArrowUp')endJump(`key:${event.code}`);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('blur',pause);
$('sound').addEventListener('click',()=>{soundOn=audio.setEnabled(!soundOn);$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').textContent=soundOn?'소리 켜짐':'소리 꺼짐';if(soundOn&&game.status==='running'&&game.reactionRemaining<=0){audio.resume();audio.play('collect');}});
updateCharacterUI();
document.querySelector('.progress').setAttribute('aria-valuemax',String(STARTING_SECONDS));
document.querySelector('.card-note').textContent=`${STARTING_SECONDS}초 시작 · 포션 +${POTION_SECONDS}초 · 충돌 -${COLLISION_PENALTY_SECONDS}초`;

function bootPhaser() {
  const Phaser = window.Phaser;
  class RunnerScene extends Phaser.Scene {
    constructor() { super('Runner'); this.boxes = new Map(); this.treats = new Map(); this.fx = []; this.lastFootstep = 0; this.landAt = -1; this.landImpact = 0; this.reactionFootY = GROUND + 1; }
    preload() {
      this.load.image('fuwa', './assets/fuwa-generated.png');
      this.load.image('motion', './assets/fuwa-motion-v1.png');
      this.load.image('jump-land', './assets/fuwa-jump-land-v1.png');
      this.load.image('hiss', './assets/fuwa-hiss-front-v1.png');
      this.load.image('alley', './assets/moonlit-alley-v1.png');
      for (const atlas of characterAtlases()) this.load.image(atlas.key, atlas.path);
      this.load.on('loaderror', () => { loaded = false; $('start').textContent = '그림을 불러오지 못했어요'; announce('그림을 불러오지 못했어요. 페이지를 새로고침해 주세요.'); });
    }
    create() {
      scene = this;
      if (!['fuwa', 'motion', 'jump-land', 'hiss', 'alley', ...characterAtlases().map(atlas => atlas.key)].every(key => this.textures.exists(key))) return;
      this.textures.get('fuwa').add('trimmed', 0, 51, 96, 1449, 810);
      this.textures.get('hiss').add('trimmed', 0, 0, 150, 1170, 1000);
      const atlas = this.textures.get('motion');
      // Equal normalized cells, using rounded shared edges. Common registration
      // preserves the real flight poses instead of grounding every paw separately.
      for (let i = 0; i < 8; i++) {
        const x = Math.round((i % 4) * 443.5), next = Math.round((i % 4 + 1) * 443.5);
        atlas.add(`pose-${i}`, 0, x, Math.round(Math.floor(i / 4) * 443.5) + 65, next - x, 310);
      }
      const actionAtlas=this.textures.get('jump-land');
      for(let i=0;i<4;i++)actionAtlas.add(`action-${i}`,0,(i%2)*627,Math.floor(i/2)*627+105,627,445);
      for (const sheet of characterAtlases()) {
        const texture = this.textures.get(sheet.key), image = texture.getSourceImage();
        for (let i = 0; i < sheet.count; i++) {
          const frame = atlasFrame(sheet, i, image.width, image.height);
          texture.add(`character-${i}`, 0, frame.x, frame.y, frame.width, frame.height);
        }
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
      this.reactionLabel = this.add.text(CAT_X+66,GROUND-130,'하악!',{fontFamily:'sans-serif',fontSize:'28px',fontStyle:'bold',color:'#ffe0bb',stroke:'#263b43',strokeThickness:4}).setOrigin(.5).setDepth(16).setVisible(false);
      this.boostRing=this.add.ellipse(CAT_X+66,GROUND+8,78,24).setStrokeStyle(3,0xffdfa0,.9).setVisible(false).setDepth(9);
      this.ring = this.add.ellipse(CAT_X + 70, GROUND - 47, 142, 108).setStrokeStyle(2, 0xffebad, .8).setVisible(false).setDepth(11);
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
      this.resetRun(); updateCharacterUI(); updateHUD();
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
      make('bonus-star', 52, 52, c => {
        c.shadowColor='#a8ffe0';c.shadowBlur=8;star(c,26,26,15,'#bff5de');c.shadowBlur=0;
        star(c,26,25,8,'#f2fff4');c.strokeStyle='#8cdec7';c.lineWidth=2;
        c.beginPath();c.arc(26,26,23,0,Math.PI*2);c.stroke();
      });
      make('potion', 56, 66, c => {
        c.shadowColor='#a7ffe0'; c.shadowBlur=10;
        rounded(c,14,21,28,35,10,'#6bd3ba','#e8fff3'); c.shadowBlur=0;
        rounded(c,20,11,16,17,3,'#d7f5d7','#365f59');
        rounded(c,18,7,20,8,3,'#d6b379','#745b40');
        c.fillStyle='#c8ffe9'; c.beginPath(); c.ellipse(22,32,3,7,0,0,Math.PI*2); c.fill();
        c.fillStyle='#164e4b'; c.font='bold 16px sans-serif'; c.textAlign='center';c.fillText('+10',28,46);
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

    }
    resetRun() {
      this.tweens.killAll(); for (const item of this.fx) item.destroy(); this.fx = [];
      for (const item of this.boxes.values()) item.destroy(); for (const item of this.treats.values()) item.destroy(); this.boxes.clear(); this.treats.clear();
      this.lastFootstep = 0; this.landAt = -1; this.landImpact = 0; this.reactionFootY = GROUND + 1;
      this.cat?.setAngle(0).setAlpha(1).clearTint(); this.reactionLabel?.setVisible(false); this.boostRing?.setVisible(false);
      this.rescue?.setVisible(false); this.ring?.setVisible(false);
    }
    puff(x, y, count = 4, color = 0xf6e4b8) {
      if (reducedMotion.matches) return;
      for (let i = 0; i < count; i++) { const dot = this.add.circle(x, y, 2 + i % 3, color, .85).setDepth(13); this.fx.push(dot);
        this.tweens.add({targets: dot, x: x - 22 + i * 7, y: y - 14 - i % 3 * 7, alpha: 0, scale: .2, duration: 340 + i * 15, onComplete: () => this.removeEffect(dot)}); }
    }
    removeEffect(item) { item.destroy(); this.fx = this.fx.filter(o => o !== item); }
    jumpEffect() { this.puff(CAT_X + 66, GROUND - game.y - 2, 6); }
    boostEffect() { this.puff(CAT_X+66,GROUND-game.y+10,9,0xffdfa0); }
    landEffect(impactSpeed=0) {
      this.landAt=visualClock;this.landImpact=impactSpeed;
      this.puff(CAT_X+66,GROUND-game.y-1,6+Math.min(4,Math.floor(impactSpeed/180)),0xa5b8aa);
    }
    collectEffect(x, y, value = 10, kind = 'fish') {
      this.puff(x, y, kind === 'fish' ? 5 : 10, (kind === 'potion'||kind === 'bonus-star') ? 0xa4ffe0 : kind === 'star' ? 0xffe6a1 : 0xffdf8d);
      const label = this.add.text(x, y - 10, kind==='potion'?`+${value}초`:`+${value}`, {fontFamily: 'sans-serif', fontSize: kind !== 'fish' ? '23px' : '17px', fontStyle: 'bold', color: (kind==='potion'||kind==='bonus-star')?'#b8ffe9':'#fff1ba', stroke: '#21494b', strokeThickness: 3}).setOrigin(.5).setDepth(15); this.fx.push(label);
      this.tweens.add({targets: label, y: y - 45, alpha: 0, duration: 600, onComplete: () => this.removeEffect(label)});
    }
    clearEffect() { if (game.streak % 3 === 0) this.puff(CAT_X + 80, GROUND - game.y - 70, 8, 0xe5f4b9); }
    hitEffect() {
      // Freeze every world tween. The expression uses its own reaction clock.
      this.tweens.pauseAll();
      this.reactionFootY=Math.min(GROUND-game.y+1,this.cameraTop+this.scale.height-24);
    }

    paintCharacterFrame(atlas,index,pose={stretchX:1,stretchY:1,angle:0}) {
      const frame=this.textures.get(atlas.key).get(`character-${index}`);
      const anchor=atlasAnchor(atlas,index), scale=atlas.scale ?? atlas.displayWidth/frame.width;
      this.cat.setTexture(atlas.key,`character-${index}`).setOrigin(anchor[0],anchor[1]).setScale(scale*pose.stretchX,scale*pose.stretchY).setAngle(pose.angle);
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
        for(const x of edges){
          // The far lip can be lower than the takeoff lip: put its flag on the
          // actual landing floor, not on an imaginary level bridge over the gap.
          const dy=box.kind==='gap'&&x===box.w ? (box.floorHeight??0)-(floorAt(box.encounterAt+box.duration+.001,game)??box.floorHeight??0) : 0;
          g.lineStyle(3,color);g.lineBetween(x,dy-26,x,dy-4);g.fillStyle(color);g.fillTriangle(x,dy-27,x+15,dy-23,x,dy-17);
        }
        if(box.kind==='step') {g.lineStyle(3,color);g.lineBetween(12,-14,22,-24);g.lineBetween(22,-24,32,-14);}
        if(box.kind==='drop') {g.lineStyle(3,color);g.lineBetween(12,-24,22,-14);g.lineBetween(22,-14,32,-24);}
      }
      return node;
    }
    syncObjects() {
      this.drawTerrain();
      const boxes = new Set(game.obstacles.map(o => o.id)); for (const [id, sprite] of this.boxes) if (!boxes.has(id)) { sprite.destroy(); this.boxes.delete(id); }
      for (const box of game.obstacles) { let sprite = this.boxes.get(box.id); if (!sprite) { sprite = this.hazardSprite(box); this.boxes.set(box.id, sprite); } const markerY=box.kind==='drop'?GROUND-(floorAt(box.encounterAt-.001,game)??0):(box.baseY??GROUND);sprite.setPosition(box.x,markerY).setAlpha(box.hit ? .5 : 1); }
      const treats = new Set(game.treats.map(t => t.id)); for (const [id, sprite] of this.treats) if (!treats.has(id)) { sprite.destroy(); this.treats.delete(id); }
      for (const treat of game.treats) {
        let sprite = this.treats.get(treat.id);
        if (!sprite) { sprite = this.add.image(treat.x,treat.y,treat.optional?'bonus-star':treat.kind||'fish').setDepth(6); this.treats.set(treat.id,sprite); }
        const pulse=reducedMotion.matches?1:1+Math.sin(visualClock*5+treat.id)*.035;
        const size=treat.kind==='potion'?1:treat.kind==='star'?.85:.8;
        sprite.setPosition(treat.x,treat.y).setScale(size*pulse);
        if(treat.kind==='star')sprite.setAngle(reducedMotion.matches?0:Math.sin(visualClock*3)*7);
      }
    }
    update(time, delta) {
      if (!loaded) return;
      const frameDt=Math.min(delta/1000,.1);
      if(game.reactionRemaining>0) {
        // Consume only reaction time. Even the frame completing it never
        // catches the world up or spends the user's remaining run time.
        if(game.status==='running'||game.status==='finished') {
          let left=frameDt, completed=false;
          while(left>0&&game.reactionRemaining>0) {
            const dt=Math.min(left,1/120); completed=advanceReaction(game,dt)||completed; left-=dt;
          }
          if(completed) {
            if(game.status==='finished') finish();
            else {
              this.tweens.resumeAll();audio.resume({fromGesture:false});
              announce(`${character().subject} 다시 달려요.`);
            }
          }
        }
        updateHUD();
      } else if(game.status==='running') {
        let remaining=frameDt;
        while(remaining>0) {
          const dt=Math.min(remaining,1/120), before=game.elapsed;
          step(game,dt); visualClock+=game.elapsed-before;
          for(const event of game.events||[])handleEvent(event);
          if(game.reactionRemaining>0)this.tweens.pauseAll();
          remaining-=dt;
          if(game.reactionRemaining>0||game.status!=='running')break;
        }
        updateHUD();
        if(game.status==='finished'&&game.reactionRemaining<=0)finish();
      }
      const reacting=game.reactionRemaining>0, current=character();
      const running=game.status==='running'&&!reacting, activePose=game.status==='running'||game.status==='paused';
      let poseLift=0, offsetX=0, offsetY=0;
      if(reacting) {
        const reaction = reactionPose(current,game.reactionElapsed,{reducedMotion:reducedMotion.matches});
        offsetX=reaction.offsetX; offsetY=reaction.offsetY;
        if(current.id==='fuwa') this.cat.setTexture('hiss','trimmed').setOrigin(.5,.974).setDisplaySize(124.02*reaction.stretchX,106*reaction.stretchY).setAngle(0);
        else this.paintCharacterFrame(current.reaction.atlas,reaction.frame,reaction);
      } else if(activePose) {
        const pose=runnerPose(game,visualClock,{landAt:this.landAt,landImpact:this.landImpact,reducedMotion:reducedMotion.matches});
        if(current.id==='fuwa') {
          poseLift=actionFloorLift(pose,game);
          if(pose.texture==='jump-land')this.cat.setTexture('jump-land',`action-${pose.frame}`).setOrigin(.5,351/445).setScale(.32*pose.stretchX,.32*pose.stretchY).setAngle(pose.angle);
          else this.cat.setTexture('motion',`pose-${pose.frame}`).setOrigin(.5,295/310).setScale(.42*pose.stretchX,.42*pose.stretchY).setAngle(pose.angle);
        } else {
          const frame=movementFrame(pose);
          this.paintCharacterFrame(current.movement,frame,pose);
          const overhang=current.movement.floorOverhang?.[frame] ?? 0;
          if(Number.isFinite(game.floorHeight))poseLift=Math.max(0,overhang*pose.stretchY-Math.max(0,game.y-game.floorHeight));
        }
      } else if(current.id==='fuwa') this.cat.setTexture('fuwa','trimmed').setOrigin(.5,1).setDisplaySize(174,97.3).setAngle(0);
      else this.paintCharacterFrame(current.movement,0);
      const catFootY=reacting?this.reactionFootY:GROUND-game.y+1-poseLift;
      this.cat.setPosition(CAT_X+66+offsetX,catFootY+offsetY);
      this.reactionLabel.setText(current.reaction.label).setPosition(CAT_X+66,catFootY-135).setVisible(reacting).setAlpha(reacting?Math.min(1,game.reactionRemaining/.12):0);
      const boostAge=game.lastBoostAt===null?Infinity:game.elapsed-game.lastBoostAt;
      const boostVisible=running&&!reducedMotion.matches&&game.jumpCount===2&&boostAge>=0&&boostAge<.2;
      this.boostRing.setPosition(CAT_X+66,catFootY+10).setVisible(boostVisible).setScale(.5+Math.min(.2,boostAge)*3).setAlpha(boostVisible?1-boostAge/.2:0);
      const rescuing=game.elapsed<game.recoveryUntil;
      this.cat.setAlpha(reacting?1:rescuing?.45:game.invincible>0?.72:1);
      this.rescue.setPosition(CAT_X+66,GROUND-game.y-48).setVisible(rescuing&&!reacting);
      const heightAboveFloor=game.floorHeight===null?200:Math.max(0,game.y-game.floorHeight);
      this.shadow.setPosition(CAT_X+65,GROUND-(game.floorHeight??0)+5).setVisible(game.floorHeight!==null&&!rescuing&&!reacting).setScale(Math.max(.42,1-heightAboveFloor/400),1).setAlpha(Math.max(0,.34-heightAboveFloor/1000));
      this.ring.setPosition(CAT_X+70,catFootY-48).setVisible(game.invincible>0&&!reacting);
      const distance = reducedMotion.matches ? 0 : game.distance;
      this.backdrop.x = -Math.min(200, distance * .012);
      for (let i = 0; i < this.lamps.length; i++) this.lamps[i].x = ((i * 340 + 240 - distance * .32) % 1700 + 1700) % 1700 - 100;
      for (let i = 0; i < this.fireflies.length; i++) { const dot = this.fireflies[i]; dot.x = ((i * 137 + 40 - distance * .08) % (this.scale.width + 40) + this.scale.width + 40) % (this.scale.width + 40); dot.y = 90 + (i * 43) % 170 + (reducedMotion.matches ? 0 : Math.sin(visualClock * .8 + i) * 7); dot.setAlpha(.18 + (reducedMotion.matches ? .1 : Math.sin(visualClock * 1.5 + i) * .12 + .12)); }
      this.syncObjects();
      if (running && game.grounded && !rescuing && visualClock - this.lastFootstep > .16) { this.lastFootstep = visualClock; this.puff(CAT_X + 42, GROUND-game.y, 2, 0xc0c1a8); }

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
