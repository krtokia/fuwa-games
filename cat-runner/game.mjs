import { MODES, ROUND_SECONDS, GROUND, CAT_X, createGame, jump, pressJump, releaseJump, step, jumpCueSeconds } from './engine.mjs';

// Phaser owns rendering, scene timing, pointer input, particles and tweens.
// The deterministic rule model stays separate so the course is testable without a GPU.
const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const STORAGE_KEY = 'fuwa-runner.v2';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch {}
if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
let mode = typeof saved.mode === 'string' && Object.hasOwn(MODES, saved.mode) ? saved.mode : 'gentle';
let game = createGame(mode, 720);
let scene, renderer, loaded = false, soundOn = false, audioContext;
let noticeUntil = 0, toastUntil = 0, lastSecond = -1, lastSnacks = -1, lastHearts = -1;
let lastSegment = '', finished = false, visualClock = 0;
let heldInput = null;

function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {} }
function announce(text) { $('announcement').textContent = text; }
function overlay(card) {
  $('overlay').hidden = !card;
  for (const id of ['start-card', 'result-card', 'pause-card']) $(id).hidden = id !== card;
}
function beep(frequency = 660, duration = .09, volume = .035) {
  if (!soundOn) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch {}
}
function start() {
  if (!loaded) return;
  endJump();
  game = createGame(mode, scene.scale.width); game.status = 'running';
  noticeUntil = 0; toastUntil = 0; finished = false; lastSegment = '';
  lastSecond = lastSnacks = lastHearts = -1; visualClock = 0;
  scene.resetRun(); overlay(null);
  $('pause').disabled = false; $('jump').disabled = false;
  $('jump').focus({ preventScroll: true });
  announce(`${MODES[mode].label} 시작. 짧게 누르면 낮게, 꾹 누르면 높게 점프해요.`);
  beep(440,.12); updateHUD();
}
function doJump() {
  if (game.status !== 'running' || heldInput !== null) return;
  if (jump(game)) { scene.jumpEffect(); beep(520,.1,.025); }
}
function beginJump(source) {
  if (game.status !== 'running' || heldInput !== null) return;
  heldInput = source;
  $('jump').classList.add('is-held');
  if (pressJump(game)) { scene.jumpEffect(); beep(520,.1,.025); }
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
  game.status = 'paused'; scene.tweens.pauseAll();
  $('pause').disabled = $('jump').disabled = true;
  overlay('pause-card'); $('resume').focus({ preventScroll:true }); announce('잠깐 쉬는 중.');
}
function resume() {
  if (game.status !== 'paused') return;
  game.status = 'running'; scene.tweens.resumeAll();
  overlay(null); $('pause').disabled = $('jump').disabled = false;
  $('jump').focus({ preventScroll:true }); announce('이어서 산책해요.');
}
function showStart() {
  endJump();
  scene?.tweens.resumeAll(); game = createGame(mode, scene?.scale.width || 720); finished = false;
  scene?.resetRun(); $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  overlay('start-card'); $('start').focus({preventScroll:true}); updateHUD();
}
function finish() {
  if (finished) return; finished = true;
  endJump();
  $('pause').disabled = $('jump').disabled = true;
  $('hint').classList.remove('visible'); $('course-toast').classList.remove('visible');
  const won = game.status === 'won', key = `best_${game.mode}`;
  const previous = Number.isFinite(saved[key]) ? Math.max(0,saved[key]) : 0;
  saved[key] = Math.max(previous,game.snacks); saved.mode=mode; save();
  $('result-kicker').textContent = won ? '집 앞 골목에서 달빛 정원까지' : '다음 산책도 함께해요';
  $('result-title').textContent = won ? '잘 다녀왔어요!' : '잠깐 쉬어 갈까요?';
  $('result-copy').textContent = `${Math.floor(game.elapsed)}초 · 간식 ${game.snacks}개 · 상자 ${game.cleared || 0}개 통과`;
  $('record').textContent = `${game.snacks>previous?'새 기록! ':''}${MODES[mode].label} 최고 간식 ${saved[key]}개`;
  overlay('result-card'); $('again').focus({preventScroll:true});
  announce(`${$('result-title').textContent}. ${$('result-copy').textContent}`); beep(won?880:330,.22);
}
function toast(text, duration=1.5) {
  $('course-toast').textContent=text; $('course-toast').classList.add('visible'); toastUntil=game.elapsed+duration;
}
function updateHUD() {
  const seconds=Math.max(0,Math.ceil(ROUND_SECONDS-game.elapsed));
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
  if(game.status!=='running') return;
  const next=game.obstacles.find(o=>!o.hit&&!o.cleared&&o.x>CAT_X+70);
  const away=next?(next.x-CAT_X-70)/MODES[game.mode].speed:Infinity;
  let text='';
  if(game.elapsed<noticeUntil)text='괜찮아요! 계속 가요';
  else if(away<jumpCueSeconds(game.mode))text='지금 톡!  ↑';
  else if(away<1.3)text='앞에 상자가 있어요';
  else if(game.elapsed<3)text='톡 = 낮게 · 꾹 = 높게';
  $('hint').textContent=text;$('hint').classList.toggle('visible',Boolean(text));
  if(game.elapsed>=toastUntil)$('course-toast').classList.remove('visible');
}
function handleEvent(event) {
  if(event.type==='snack') {scene.collectEffect(event.x,event.y);beep(680+(game.snacks%4)*90,.055,.018);}
  if(event.type==='land') scene.landEffect();
  if(event.type==='boost') { scene.puff(CAT_X+66,GROUND-game.y-4,4,0xffe8b1); beep(660,.08,.02); }
  if(event.type==='clear') {scene.clearEffect(event.x, event.y);if(game.streak && game.streak%3===0)toast(`${game.streak}번 연속 폴짝!`,1.25);}
  if(event.type==='hit') {noticeUntil=game.elapsed+1.4;scene.hitEffect();beep(180,.16,.035);announce(`상자에 닿았어요. 기운 ${game.hearts}개가 남았어요.`);}
}
for(const input of document.querySelectorAll('[name="mode"]')) {
  input.checked=input.value===mode;input.addEventListener('change',()=>{mode=input.value;saved.mode=mode;save();});
}
$('start').addEventListener('click',start);$('again').addEventListener('click',start);
$('change-mode').addEventListener('click',showStart);$('restart').addEventListener('click',showStart);
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);
// Start immediately; release before the hold threshold keeps the lower jump.
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
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').textContent=soundOn?'소리 켜짐':'소리 꺼짐';beep();});
document.querySelector('.progress').setAttribute('aria-valuemax',String(ROUND_SECONDS));
document.querySelector('.card-note').textContent=`${ROUND_SECONDS}초 산책 · 기운 3개 · 점프 버튼 하나`;

function bootPhaser() {
  const Phaser=window.Phaser;
  class RunnerScene extends Phaser.Scene {
    constructor(){super('Runner');this.boxes=new Map();this.treats=new Map();this.fx=[];this.lastFootstep=0;}
    preload(){this.load.image('fuwa','./assets/fuwa-generated.png');this.load.on('loaderror',()=>{loaded=false;$('start').textContent='그림을 불러오지 못했어요';announce('그림을 불러오지 못했어요. 페이지를 새로고침해 주세요.');});}
    create(){
      scene=this;
      if(!this.textures.exists('fuwa'))return;
      this.textures.get('fuwa').add('trimmed',0,51,96,1449,810);
      this.makeTextures();
      this.sky=this.add.tileSprite(0,0,this.scale.width,400,'sky').setOrigin(0).setDepth(-10);
      this.houses=this.add.tileSprite(0,122,this.scale.width,216,'houses').setOrigin(0).setDepth(-8);
      this.wall=this.add.tileSprite(0,286,this.scale.width,52,'wall').setOrigin(0).setDepth(-5);
      this.road=this.add.tileSprite(0,GROUND,this.scale.width,400-GROUND,'road').setOrigin(0).setDepth(-4);
      this.moon=this.add.circle(this.scale.width*.79,64,25,0xf4e4ad).setAlpha(.94).setDepth(-9);
      this.moonShade=this.add.circle(this.scale.width*.79-9,57,23,0x2d444d).setDepth(-9);
      this.shadow=this.add.ellipse(CAT_X+65,GROUND+4,112,12,0x1a3537,.22).setDepth(1);
      this.cat=this.add.image(CAT_X+66,GROUND+2,'fuwa','trimmed').setOrigin(.5,1).setDisplaySize(174,97.3).setDepth(10);
      this.ring=this.add.ellipse(CAT_X+70,GROUND-47,142,108).setStrokeStyle(3,0xffebad,.95).setVisible(false).setDepth(11);
      this.finishGate=this.add.container(this.scale.width+100,GROUND).setDepth(3);
      const pole1=this.add.rectangle(0,-40,8,80,0x4d6e5d),pole2=this.add.rectangle(100,-40,8,80,0x4d6e5d);
      const banner=this.add.rectangle(50,-73,112,29,0xf1d796).setStrokeStyle(2,0x8b7445);
      const label=this.add.text(50,-73,'도착!',{fontFamily:'sans-serif',fontSize:'17px',fontStyle:'bold',color:'#435a40'}).setOrigin(.5);
      this.finishGate.add([pole1,pole2,banner,label]);
      // Native Pointer Events unify mouse, pen and real touch hold/release input.
      this.scale.on('resize',size=>{for(const layer of [this.sky,this.houses,this.wall,this.road])layer.setSize(size.width,layer.height);this.moon.x=size.width*.79;this.moonShade.x=size.width*.79-9;game.width=size.width;});
      loaded=true;$('start').disabled=false;$('start').innerHTML='산책 시작 <span aria-hidden="true">→</span>';
      this.resetRun();updateHUD();
    }
    makeTextures(){
      const sky=this.textures.createCanvas('sky',1200,400),c=sky.context;
      const grad=c.createLinearGradient(0,0,0,400);grad.addColorStop(0,'#263c48');grad.addColorStop(1,'#617b72');c.fillStyle=grad;c.fillRect(0,0,1200,400);
      for(let i=0;i<47;i++){const x=(i*127+31)%1200,y=21+(i*41)%164;c.fillStyle=i%4?'#a7bbb4':'#e6dcad';c.fillRect(x,y,i%4?1.5:2.5,i%4?1.5:2.5);}sky.refresh();
      const g=this.make.graphics({x:0,y:0,add:false});
      for(let i=0;i<6;i++){
        const x=i*200,y=62+(i%3)*20,w=111+(i%2)*30;g.fillStyle([0x385458,0x3e5c5e,0x456461][i%3]);g.fillRoundedRect(x,y,w,220-y,4);g.fillTriangle(x-6,y+4,x+w/2,y-28,x+w+6,y+4);
        for(let j=0;j<2;j++){g.fillStyle(i%2?0xd4ba78:0xb9bb83,.78);g.fillRoundedRect(x+20+j*40,y+24,19,26,2);g.lineStyle(2,0x6e7b66);g.lineBetween(x+29+j*40,y+24,x+29+j*40,y+50);g.lineBetween(x+20+j*40,y+36,x+39+j*40,y+36);}
      }g.generateTexture('houses',1200,216);g.clear();
      g.fillStyle(0x587b70);g.fillRect(0,0,160,52);g.fillStyle(0x86a185);g.fillRect(0,0,160,6);g.fillStyle(0x6a8a79);g.fillRect(8,25,55,2);g.fillRect(83,25,55,2);g.fillRect(38,6,2,19);g.fillRect(115,27,2,25);g.generateTexture('wall',160,52);g.clear();
      g.fillStyle(0xc4caaa);g.fillRect(0,0,200,62);g.fillStyle(0xf0e7bd);g.fillRect(0,0,200,5);g.fillStyle(0x9fae90);g.fillRect(0,5,200,3);g.fillRoundedRect(12,31,49,3,2);g.fillRoundedRect(111,45,33,3,2);g.generateTexture('road',200,62);g.clear();
      g.fillStyle(0x263f36,.15);g.fillEllipse(28,48,52,9);g.fillStyle(0xd69668);g.fillRoundedRect(4,4,44,42,5);g.lineStyle(2,0x76513a);g.strokeRoundedRect(4,4,44,42,5);g.fillStyle(0xeebc88);g.fillRoundedRect(7,7,38,8,3);g.fillStyle(0xf1d8a5);g.fillRect(22,5,9,40);g.lineStyle(2,0x805b3c);g.lineBetween(11,30,16,24);g.lineBetween(16,24,21,30);g.generateTexture('box',56,55);g.clear();
      g.fillStyle(0xffd276);g.fillTriangle(4,7,4,25,17,16);g.fillEllipse(25,16,29,20);g.lineStyle(2,0x9d722b);g.strokeEllipse(25,16,29,20);g.fillStyle(0xffedb6);g.fillEllipse(23,12,12,3);g.fillStyle(0x77552d);g.fillCircle(32,14,1.8);g.generateTexture('treat',44,32);g.clear();
      g.fillStyle(0xffe4a1);g.fillCircle(5,5,4);g.generateTexture('spark',10,10);g.destroy();
    }
    resetRun(){
      this.tweens.killAll();for(const item of this.fx)item.destroy();this.fx=[];
      for(const item of this.boxes.values())item.destroy();for(const item of this.treats.values())item.destroy();this.boxes.clear();this.treats.clear();
      if(this.cat){this.cat.setAngle(0).setAlpha(1).clearTint();this.cat.setDisplaySize(174,97.3);}
      this.lastFootstep=0;this.finishGate?.setVisible(false);
    }
    puff(x,y,count=4,color=0xf6e4b8){
      if(reducedMotion.matches)return;
      for(let i=0;i<count;i++) {const dot=this.add.circle(x,y,2+(i%3),color,.8).setDepth(13);this.fx.push(dot);
        this.tweens.add({targets:dot,x:x-16+i*9,y:y-12-(i%3)*6,alpha:0,scale:.2,duration:350+i*20,onComplete:()=>{dot.destroy();this.fx=this.fx.filter(o=>o!==dot);}});}
    }
    jumpEffect(){this.puff(CAT_X+66,GROUND-3,5);}
    landEffect(){this.puff(CAT_X+66,GROUND-1,5,0xc6b995);}
    collectEffect(x,y){
      this.puff(x,y,6,0xffdf8d);
      const label=this.add.text(x,y-15,'+1',{fontFamily:'sans-serif',fontSize:'19px',fontStyle:'bold',color:'#fff0b9',stroke:'#4a6251',strokeThickness:3}).setOrigin(.5).setDepth(15);this.fx.push(label);
      this.tweens.add({targets:label,y:y-48,alpha:0,duration:650,onComplete:()=>{label.destroy();this.fx=this.fx.filter(o=>o!==label);}});
    }
    clearEffect(x,y){if(game.streak%3===0)this.puff(CAT_X+80,GROUND-game.y-70,8,0xe5f4b9);}
    hitEffect(){if(!reducedMotion.matches)this.cameras.main.shake(90,.0015);this.puff(CAT_X+96,GROUND-24,5,0xf7bd8b);}
    syncObjects(){
      const boxes=new Set(game.obstacles.map(o=>o.id));for(const [id,sprite] of this.boxes)if(!boxes.has(id)){sprite.destroy();this.boxes.delete(id);}
      for(const box of game.obstacles){const sx=box.w/44,sy=box.h/42;let sprite=this.boxes.get(box.id);if(!sprite){sprite=this.add.image(0,0,'box').setOrigin(0,1).setDepth(5);this.boxes.set(box.id,sprite);}sprite.setPosition(box.x-4*sx,GROUND+9*sy).setScale(sx,sy).setAlpha(box.hit?.55:1);}
      const treats=new Set(game.treats.map(t=>t.id));for(const [id,sprite] of this.treats)if(!treats.has(id)){sprite.destroy();this.treats.delete(id);}
      for(const treat of game.treats){let sprite=this.treats.get(treat.id);if(!sprite){sprite=this.add.image(treat.x,treat.y,'treat').setDepth(6);this.treats.set(treat.id,sprite);}sprite.setPosition(treat.x,treat.y);sprite.setScale(1+(reducedMotion.matches?0:Math.sin(visualClock*5+(treat.id||0))*.035));}
    }
    update(time,delta){
      if(!loaded)return;
      if(game.status==='running'){
        visualClock+=Math.min(delta/1000,.1);let remaining=Math.min(delta/1000,.1);
        while(remaining>0){const dt=Math.min(remaining,1/120);step(game,dt);for(const event of game.events||[])handleEvent(event);remaining-=dt;if(game.status!=='running')break;}
        updateHUD();if(game.status==='won'||game.status==='finished')finish();
      }
      const moving=game.status==='running', bob=moving&&game.y===0&&!reducedMotion.matches?Math.sin(visualClock*15)*2:0;
      this.cat.setPosition(CAT_X+66,GROUND-game.y+2+bob);
      const scaleX=game.y>0?1.02:1,scaleY=game.y>0?.98:1;
      this.cat.setDisplaySize(174*scaleX,97.3*scaleY).setAngle(game.y>0&&!reducedMotion.matches?-Math.max(-7,Math.min(7,game.vy/100)):0);
      this.shadow.setScale(Math.max(.45,1-game.y/420),1).setAlpha(.25-game.y/1400);
      this.ring.setPosition(CAT_X+70,GROUND-game.y-47).setVisible(game.invincible>0);
      this.cat.setAlpha(game.invincible>0?.84:1);
      const distance=reducedMotion.matches?0:game.distance;
      this.houses.tilePositionX=distance*.13;this.wall.tilePositionX=distance*.38;this.road.tilePositionX=distance;
      this.syncObjects();
      if(moving&&game.y===0&&!reducedMotion.matches&&visualClock-this.lastFootstep>.19){this.lastFootstep=visualClock;this.puff(CAT_X+42,GROUND,2,0xded4ae);}
      const gateX=CAT_X+140+(ROUND_SECONDS-game.elapsed)*MODES[game.mode].speed;
      this.finishGate.setPosition(gateX,GROUND).setVisible(gateX<this.scale.width+140);
    }
  }
  const width=Math.max(440,Math.round($('scene').clientWidth));
  renderer=new Phaser.Game({type:Phaser.AUTO,parent:'game-canvas',width,height:400,transparent:true,antialias:true,roundPixels:false,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY},scene:RunnerScene,
    input:{activePointers:2},audio:{noAudio:true},fps:{target:60,forceSetTimeOut:false},banner:false});
  let oldWidth=width;
  new ResizeObserver(()=>{const next=Math.max(440,Math.round($('scene').clientWidth));if(next!==oldWidth){pause();oldWidth=next;renderer.scale.setGameSize(next,400);}renderer.scale.refresh();}).observe($('scene'));
}
if(window.Phaser)bootPhaser();else {$('start').textContent='게임을 불러오지 못했어요';announce('게임 파일을 불러오지 못했어요. 새로고침해 주세요.');}
updateHUD();
