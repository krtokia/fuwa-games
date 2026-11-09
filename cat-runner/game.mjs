import { MODES, ROUND_SECONDS, GROUND, CAT_X, createGame, jump, step, jumpCueSeconds } from './engine.mjs';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const sprite = new Image();
sprite.src = './assets/fuwa-run.svg';
const STORAGE_KEY = 'fuwa-runner.v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch { /* Private browsing still works. */ }
if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
let mode = typeof saved.mode === 'string' && Object.hasOwn(MODES, saved.mode) ? saved.mode : 'gentle';
let game = createGame(mode);
let previousTime = 0;
let finishShown = false;
let soundOn = false;
let audioContext;
let noticeUntil = 0;
let lastHeartCount = 3;
let lastSecond = -1;
let lastSnackCount = -1;
let sceneWidth = 720;
let resultWasRecord = false;

for (const input of document.querySelectorAll('[name="mode"]')) {
  input.checked = input.value === mode;
  input.addEventListener('change', () => { mode = input.value; saved.mode = mode; save(); });
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* No storage is required to play. */ } }
function announce(text) { $('announcement').textContent = text; }
function overlay(card) {
  $('overlay').hidden = !card;
  for (const id of ['start-card', 'result-card', 'pause-card']) $(id).hidden = id !== card;
}
function beep(frequency = 600, duration = 0.08, gain = 0.04) {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(gain, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(volume); volume.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Sound is optional. */ }
}
function start() {
  game = createGame(mode, sceneWidth);
  game.status = 'running';
  previousTime = 0; finishShown = false; noticeUntil = 0; lastHeartCount = 3;
  lastSecond = -1; lastSnackCount = -1;
  overlay(null);
  $('pause').disabled = false; $('jump').disabled = false;
  $('jump').focus({ preventScroll: true });
  announce(`${MODES[mode].label} 시작. 화면이나 점프 버튼을 누르면 점프해요.`);
  beep(440, 0.12);
  updateHUD();
}
function doJump() {
  if (game.status !== 'running') return;
  if (jump(game)) beep(520, 0.1, 0.025);
}
function pause() {
  if (game.status !== 'running') return;
  game.status = 'paused';
  $('pause').disabled = true; $('jump').disabled = true;
  overlay('pause-card'); $('resume').focus({ preventScroll: true });
  announce('잠깐 쉬는 중. 이어서 산책 버튼을 누르면 계속합니다.');
}
function resume() {
  if (game.status !== 'paused') return;
  game.status = 'running'; previousTime = 0;
  overlay(null); $('pause').disabled = false; $('jump').disabled = false;
  $('jump').focus({ preventScroll: true }); announce('이어서 산책해요.');
}
function showStart() {
  mode = typeof saved.mode === 'string' && Object.hasOwn(MODES, saved.mode) ? saved.mode : mode;
  game = createGame(mode, sceneWidth); finishShown = false;
  $('pause').disabled = true; $('jump').disabled = true;
  $('hint').classList.remove('visible');
  overlay('start-card'); $('start').focus({ preventScroll: true }); updateHUD();
}
function finish() {
  if (finishShown) return;
  finishShown = true;
  $('pause').disabled = true; $('jump').disabled = true;
  $('hint').classList.remove('visible');
  const won = game.status === 'won';
  const recordKey = `best_${game.mode}`;
  const best = Number.isFinite(saved[recordKey]) ? Math.max(0, saved[recordKey]) : 0;
  resultWasRecord = game.snacks > best;
  saved[recordKey] = Math.max(best, game.snacks); saved.mode = game.mode; save();
  $('result-kicker').textContent = won ? '달빛 골목 한 바퀴' : '오늘도 즐거운 산책';
  $('result-title').textContent = won ? '잘 다녀왔어요!' : '잠깐 쉬어 갈까요?';
  $('result-copy').textContent = `${Math.floor(game.elapsed)}초 동안 간식 ${game.snacks}개를 모았어요.`;
  $('record').textContent = `${resultWasRecord ? '새 기록! ' : ''}${MODES[game.mode].label} 최고 간식 ${saved[recordKey]}개`;
  overlay('result-card'); $('again').focus({ preventScroll: true });
  announce(`${$('result-title').textContent} ${$('result-copy').textContent}`);
  beep(won ? 780 : 330, 0.2);
}
function updateHUD() {
  const remaining = Math.max(0, Math.ceil(ROUND_SECONDS - game.elapsed));
  if (remaining !== lastSecond) {
    $('time').replaceChildren(document.createTextNode(String(remaining)), Object.assign(document.createElement('span'), { textContent: '초' }));
    document.querySelector('.progress').setAttribute('aria-valuenow', String(Math.floor(game.elapsed)));
    lastSecond = remaining;
  }
  if (lastSnackCount !== game.snacks) { $('snacks').textContent = game.snacks; lastSnackCount = game.snacks; }
  $('hearts').textContent = '♥ '.repeat(game.hearts).trim() + (game.hearts < 3 ? ' ' + '♡ '.repeat(3 - game.hearts).trim() : '');
  $('hearts').setAttribute('aria-label', `기운 ${game.hearts}개`);
  $('progress-fill').style.width = `${game.elapsed / ROUND_SECONDS * 100}%`;
  if (game.status !== 'running') return;
  const nextBox = game.obstacles.find(o => !o.hit && o.x > CAT_X + 70);
  const secondsAway = nextBox ? (nextBox.x - CAT_X - 70) / MODES[game.mode].speed : Infinity;
  const jumpCue = jumpCueSeconds(game.mode);
  let hint = '';
  if (game.elapsed < noticeUntil) hint = '괜찮아요! 계속 가요';
  else if (secondsAway < jumpCue) hint = '지금 눌러요 · 폴짝!';
  else if (secondsAway < 1.35) hint = '앞에 상자가 있어요';
  else if (game.elapsed < 4) hint = '화면을 톡 눌러 보세요 ↑';
  $('hint').textContent = hint; $('hint').classList.toggle('visible', Boolean(hint));
}
$('start').addEventListener('click', start);
$('again').addEventListener('click', start);
$('change-mode').addEventListener('click', showStart);
$('restart').addEventListener('click', showStart);
$('pause').addEventListener('click', pause);
$('resume').addEventListener('click', resume);
$('jump').addEventListener('click', doJump);
$('scene').addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || event.target.closest('button,input,label,.overlay')) return;
  if (game.status === 'running') { event.preventDefault(); doJump(); }
});
document.addEventListener('keydown', event => {
  // Let focused form controls keep their native keyboard behavior.
  if (event.target.matches('input')) return;
  const jumpKey = event.code === 'Space' || event.code === 'ArrowUp';
  if (game.status === 'running' && jumpKey) {
    // Do not intercept Space on Pause/Sound or another focused button.
    if (event.target.matches('button') && event.target !== $('jump')) return;
    event.preventDefault(); if (!event.repeat) doJump();
  } else if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
    if (game.status === 'running') pause();
    else if (game.status === 'paused') resume();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
$('sound').addEventListener('click', () => {
  soundOn = !soundOn; $('sound').setAttribute('aria-pressed', String(soundOn));
  $('sound').textContent = soundOn ? '소리 켜짐' : '소리 꺼짐'; beep(660, 0.08);
});

function rounded(x, y, w, h, radius, fill, stroke = '') {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function ellipse(x, y, rx, ry, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function star(x, y, size, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * .28, y - size * .28); ctx.lineTo(x + size, y); ctx.lineTo(x + size * .28, y + size * .28); ctx.lineTo(x, y + size); ctx.lineTo(x - size * .28, y + size * .28); ctx.lineTo(x - size, y); ctx.lineTo(x - size * .28, y - size * .28); ctx.closePath(); ctx.fill();
}
function house(x, y, w, h, fill, windows = 2) {
  rounded(x,y,w,h,4,fill);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(x - 7,y + 5); ctx.lineTo(x + w / 2,y - 22); ctx.lineTo(x + w + 7,y + 5); ctx.fill();
  for(let i = 0; i < windows; i++) {
    rounded(x + 17 + i * 36,y + 24,17,24,2,'#d6b770');
    ctx.fillStyle = '#a08b5b'; ctx.fillRect(x + 24 + i * 36,y + 24,2,24); ctx.fillRect(x + 17 + i * 36,y + 34,17,2);
  }
}
function plant(x,y,scale = 1) {
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.strokeStyle = '#6f8f72'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(1,-49); ctx.stroke();
  for(let i = 0;i < 3;i++) { ellipse(-8,-16-i*12,10,5,'#88a17b'); ellipse(9,-23-i*10,10,5,'#9cb183'); }
  ctx.fillStyle = '#a17e62'; ctx.beginPath(); ctx.moveTo(-16,-5); ctx.lineTo(16,-5); ctx.lineTo(12,17); ctx.lineTo(-12,17); ctx.fill();
  rounded(-18,-10,36,9,3,'#c29872'); ctx.restore();
}
function drawBackground() {
  const w = game.width;
  const gradient = ctx.createLinearGradient(0,0,0,GROUND);
  gradient.addColorStop(0,'#263b45'); gradient.addColorStop(1,'#526c68'); ctx.fillStyle=gradient; ctx.fillRect(0,0,w,400);
  ellipse(w*.78,70,27,27,'#e8d8a3'); ellipse(w*.78-10,62,25,25,'#2c424b');
  for(let i=0;i<24;i++) { const x=(i*137.3+42)%w; const y=28+(i*43)%143; if(i%4===0) star(x,y,3,'#c2cbb9'); else ellipse(x,y,1,1,'#acbdb4'); }
  const parallax = reducedMotion.matches ? 0 : game.distance * .12;
  for(let i=-1;i<Math.ceil(w/230)+2;i++) {
    const x=i*230 - parallax%230;
    house(x,190+(i%2)*12,98,120,'#354f52',2); house(x+116,212,92,115,'#3c5859',1);
  }
  // Garden wall, gate and softly lit path.
  ctx.fillStyle='#55736b'; ctx.fillRect(0,286,w,52);
  ctx.fillStyle='#708b78'; ctx.fillRect(0,286,w,6);
  const offset = reducedMotion.matches ? 0 : game.distance*.35;
  for(let i=-1;i<Math.ceil(w/74)+1;i++) { ctx.fillStyle='#617d70'; ctx.fillRect(i*74-offset%74,310,50,2); ctx.fillRect(i*74+28-offset%74,294,2,16); }
  for(let i=-1;i<Math.ceil(w/340)+1;i++) plant(i*340+270-offset%340,319,.75);
  ctx.fillStyle='#c2c5a4'; ctx.fillRect(0,GROUND,w,62);
  ctx.fillStyle='#ece4bf'; ctx.fillRect(0,GROUND,w,5);
  ctx.fillStyle='#a0ac91'; ctx.fillRect(0,GROUND+5,w,3);
  for(let i=-1;i<Math.ceil(w/100)+1;i++) { const x=i*100-(reducedMotion.matches?0:game.distance)%100; rounded(x,GROUND+33,39,3,2,'#a6b293'); rounded(x+51,GROUND+49,21,3,2,'#b0b89a'); }
}
function drawTreat(treat) {
  ctx.save(); ctx.translate(treat.x,treat.y);
  ellipse(0,15,12,3,'#142d3122');
  ctx.strokeStyle='#8b6326'; ctx.lineWidth=2;
  ctx.fillStyle='#f5cd70'; ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(-22,-9); ctx.lineTo(-22,9); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0,0,13,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); ellipse(5,-2,1.7,1.7,'#71542e');
  ctx.strokeStyle='#fff0b2'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-5,-4);ctx.lineTo(1,-5);ctx.stroke(); ctx.restore();
}
function drawBox(box) {
  const x=box.x, y=GROUND-box.h;
  ellipse(x+22,GROUND+3,28,5,'#263f3633');
  rounded(x,y,box.w,box.h,5,box.hit?'#ac8c72':'#c48760','#684b3d');
  rounded(x+3,y+3,box.w-6,8,2,'#dda278');
  ctx.fillStyle='#ead1a0';ctx.fillRect(x+18,y+1,8,box.h-2);
  ctx.strokeStyle='#79533d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+7,y+25);ctx.lineTo(x+13,y+19);ctx.lineTo(x+18,y+25);ctx.stroke();
}
function drawCat() {
  const moving = game.status==='running';
  const phase = moving && game.y===0 ? Math.floor(game.elapsed*9)%4 : (game.y>0?2:0);
  const bob = moving && game.y===0 && !reducedMotion.matches ? Math.sin(game.elapsed*18)*1.3 : 0;
  ellipse(CAT_X+78,GROUND+3,47-game.y*.09,6,'#263b3e35');
  ctx.save();
  if(game.invincible>0) {
    // A steady protective ring replaces flashing hit feedback.
    ctx.strokeStyle='#fff0b3';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(CAT_X+86,GROUND-game.y-45,59,45,0,0,Math.PI*2);ctx.stroke();
  }
  if(sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite,phase*180,0,180,122,CAT_X,GROUND-game.y-87+bob,144,97.6);
  else { // Visible fallback even if the sprite is unavailable.
    ellipse(CAT_X+75,GROUND-game.y-31,45,28,'#b4b0a5');ellipse(CAT_X+111,GROUND-game.y-53,23,23,'#d7c8b0');
  }
  ctx.restore();
}
function render() {
  ctx.setTransform(canvas.width/game.width,0,0,canvas.height/400,0,0);
  ctx.clearRect(0,0,game.width,400);
  drawBackground(); for(const treat of game.treats) drawTreat(treat);
  for(const box of game.obstacles) drawBox(box); drawCat();
  if(game.status==='ready') {
    drawTreat({x:game.width-78,y:GROUND-34});drawBox({x:game.width-185,w:44,h:42,hit:false});
  }
}
function resize() {
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr);
  sceneWidth=Math.max(440,Math.round(rect.width));
  // Keep approaching obstacles at the same relative travel distance after rotation.
  const delta=sceneWidth-game.width;
  for(const obstacle of game.obstacles) if(obstacle.x>CAT_X+170) obstacle.x=Math.max(CAT_X+170,obstacle.x+delta);
  for(const treat of game.treats) if(treat.x>CAT_X+170) treat.x=Math.max(CAT_X+170,treat.x+delta);
  game.width=sceneWidth;
  render();
}
new ResizeObserver(resize).observe($('scene'));
function frame(timestamp) {
  const dt=previousTime?(timestamp-previousTime)/1000:0;
  previousTime=timestamp;
  if(game.status==='running') {
    // Fixed small steps make jump height/collisions stable at 30, 60 and 120 Hz.
    let remaining=Math.min(dt,.1);
    while(remaining>0) {const slice=Math.min(remaining,1/120); step(game,slice);remaining-=slice;}
    if(game.hearts<lastHeartCount) {
      lastHeartCount=game.hearts;noticeUntil=game.elapsed+1.7;beep(180,.14,.035);
      announce(`상자에 닿았어요. 기운 ${game.hearts}개가 남았어요.`);
    } else if(game.snacks!==lastSnackCount) beep(780,.05,.018);
    updateHUD();
    if(game.status==='won'||game.status==='finished') finish();
  }
  render(); requestAnimationFrame(frame);
}
updateHUD(); resize(); requestAnimationFrame(frame);
