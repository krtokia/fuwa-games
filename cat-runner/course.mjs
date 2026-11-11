// Seeded selection of authored, independently traversable six-second patterns.
// Geometry is expressed in gameplay seconds so both speeds get the same flight budget.
export const CHUNK_SECONDS = 6;
export const POTION_SECONDS = 10;
export const SHAPES = Object.freeze(Object.fromEntries(Object.entries({
  crate: { duration: .12, h: 30, taps: 1, hint: '낮은 상자! 점프 준비', cueLead: .5 },
  long: { duration: .64, h: 32, taps: 2, hint: '긴 화분! 2단 점프 준비', cueLead: .5, secondCue: .18 },
  high: { duration: .16, h: 105, taps: 2, hint: '높은 상자! 2단 점프 준비', cueLead: .81, secondCue: .14 },
  gap: { duration: .70, h: 0, taps: 2, hint: '빈 바닥! 2단 점프 준비', cueLead: .5, secondCue: .18 },
  step: { duration: .18, h: 54, taps: 1, hint: '높아지는 길! 점프 준비', cueLead: .5 },
  drop: { duration: .18, h: 0, taps: 0, hint: '낮아지는 길, 사뿐!', cueLead: .5 },
}).map(([kind,shape])=>[kind,Object.freeze(shape)])));
const flat = [[0,6,0]];
// Every exit has at least 1.35 seconds of baseline ground. A potion belongs to the
// selected pattern's safe exit slot, after landing, rather than a timer spawner.
export const PATTERNS = Object.freeze([
  { id:'welcome', name:'가볍게 시작해요', difficulty:1, encounters:[[4,'crate']], terrain:flat },
  { id:'low-lane', name:'상자 사이 폴짝', difficulty:1, encounters:[[1.4,'crate',{bonusRoute:true,bonusSecondCue:.35}],[3.6,'crate',{bonusRoute:true,bonusSecondCue:.35}]], terrain:flat },
  { id:'long-garden', name:'긴 화분 너머', difficulty:2, encounters:[[1.4,'long'],[3.6,'crate']], terrain:flat },
  { id:'gap-hop', name:'빈 바닥을 훌쩍', difficulty:2, encounters:[[1.4,'gap'],[3.6,'crate']], terrain:[[0,1.4,0],[2.1,6,0]] },
  { id:'rise-lane', name:'올라갔다 사뿐히', difficulty:2, encounters:[[1.4,'step'],[3.6,'drop']], terrain:[[0,1.4,0],[1.4,3.6,48],[3.6,6,0]] },
  { id:'sunken-lane', name:'낮은 골목을 지나', difficulty:2, encounters:[[1.4,'drop'],[3.6,'step']], terrain:[[0,1.4,0],[1.4,3.6,-54],[3.6,6,0]] },
  { id:'high-stack', name:'높은 상자 훌쩍', difficulty:3, encounters:[[1.4,'high'],[3.6,'crate']], terrain:flat },
  { id:'gap-and-long', name:'두 번씩 리듬 타요', difficulty:3, encounters:[[1.4,'gap'],[3.6,'long']], terrain:[[0,1.4,0],[2.1,6,0]] },
  { id:'high-and-gap', name:'높이 멀리 날아요', difficulty:4, encounters:[[1.4,'high'],[3.6,'gap']], terrain:[[0,3.6,0],[4.3,6,0]] },
  // More shape, not more speed: each still asks for only two ground jumps.
  // Drops are automatic rests, and raised obstacles sit fully on their terrace.
  { id:'terrace-crate', name:'툇마루 위 상자', difficulty:2, encounters:[[1.4,'step'],[2.95,'crate'],[4.5,'drop']], terrain:[[0,1.4,0],[1.4,4.5,40],[4.5,6,0]] },
  { id:'valley-long', name:'낮은 정원의 화분', difficulty:3, encounters:[[1.15,'drop'],[2.4,'long'],[4.65,'step']], terrain:[[0,1.15,0],[1.15,4.65,-36],[4.65,6,0]] },
  { id:'stair-rise', name:'두 계단을 사뿐히', difficulty:2, encounters:[[1.4,'step'],[2.9,'step'],[4.35,'drop']], terrain:[[0,1.4,0],[1.4,2.9,28],[2.9,4.35,56],[4.35,6,0]] },
  { id:'raised-gap', name:'툇마루 사이 훌쩍', difficulty:3, encounters:[[1.4,'step'],[3.15,'gap'],[4.65,'drop']], terrain:[[0,1.4,0],[1.4,3.15,36],[3.85,4.65,36],[4.65,6,0]] },
  { id:'sunken-gap', name:'아래 골목으로 훌쩍', difficulty:2, encounters:[[1.55,'gap'],[3.9,'step']], terrain:[[0,1.55,0],[2.25,3.9,-32],[3.9,6,0]] },
].map(pattern=>Object.freeze({...pattern,
  encounters:Object.freeze(pattern.encounters.map(([at,kind,options])=>Object.freeze(
    options?[at,kind,Object.freeze(options)]:[at,kind]))),
  terrain:Object.freeze(pattern.terrain.map(Object.freeze)),
  potionSlot:Object.freeze([5.35,5.65]),
})));

export function normalizeSeed(seed=1) {
  return typeof seed === 'number' && Number.isFinite(seed) ? seed >>> 0 : 1;
}
// Mulberry32 keeps its complete state in the course; no Math.random or viewport input.
function random(course) {
  let t = course.rngState = (course.rngState + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export function difficultyWeights(time) {
  // Later play mixes in demanding combinations, while preserving easy breathers.
  return time < 24 ? [7,5,1,0] : time < 60 ? [3,5,3,1] : [2,4,5,3];
}
export function instantiatePattern(id,start=0,index=0) {
  const pattern=PATTERNS.find(p=>p.id===id);
  if (!pattern) throw new RangeError(`Unknown runner pattern: ${id}`);
  return { id:pattern.id, name:pattern.name, difficulty:pattern.difficulty,
    index,start,end:start+CHUNK_SECONDS,
    encounters:pattern.encounters.map(([at,kind,options],i)=>({ ...SHAPES[kind],...options,
      kind,encounterAt:start+at,patternId:id,chunkIndex:index,localIndex:i,
      // The cue's visible rise must match the actual adjoining surfaces, even
      // when a step begins below baseline or follows an earlier raised step.
      ...(kind==='step'?{h:pattern.terrain.find(([a,b])=>a<=at&&at<b)[2]
        -pattern.terrain.find(([a,b])=>a<at&&at<=b)[2]}:{}),tutorial:index<2 })),
    terrain:pattern.terrain.map(([a,b,height])=>({start:start+a,end:start+b,height})),
    pickups:[],potionSlot:pattern.potionSlot.map(at=>at+start) };
}
function appendChunk(course) {
  const index=course.nextChunkIndex++,start=index*CHUNK_SECONDS;
  let id='welcome';
  if (index) {
    const weights=difficultyWeights(start),options=PATTERNS.filter(p=>p.id!=='welcome');
    const weighted=options.map(p=>({pattern:p,weight:weights[p.difficulty-1]*(p.id===course.lastPatternId ? .6 : 1)}));
    let choice=random(course)*weighted.reduce((sum,p)=>sum+p.weight,0);
    id=weighted.find(p=>(choice-=p.weight)<0)?.pattern.id ?? weighted.at(-1).pattern.id;
  }
  const chunk=instantiatePattern(id,start,index);
  if(index===0) chunk.terrain[0].start=-10;
  for(const encounter of chunk.encounters) encounter.index=course.totalEncounters++;
  // Rest snacks are part of each pattern too; the exit remains on the safe baseline.
  chunk.pickups.push({encounterAt:start+5.05,kind:'fish',height:35,value:10});
  if(index===course.nextPotionChunk) {
    const [min,max]=chunk.potionSlot;
    chunk.pickups.push({encounterAt:min+random(course)*(max-min),kind:'potion',height:35,value:POTION_SECONDS});
    course.nextPotionChunk+=random(course)<.5?2:3;
  }
  for(const pickup of chunk.pickups) {
    pickup.index=course.totalPickups++;
    pickup.patternId=id;pickup.chunkIndex=index;
  }
  course.lastPatternId=id;course.generatedUntil=chunk.end;
  course.chunks.push(chunk);
}
export function createCourse(seed=1) {
  seed=normalizeSeed(seed);
  const course={seed,rngState:seed,nextChunkIndex:0,nextPotionChunk:0,totalEncounters:0,totalPickups:0,
    generatedUntil:0,lastPatternId:null,chunks:[],terrain:[],encounters:[],pickups:[]};
  // First potion is in chunk 1 or 2: 11.35–17.65 seconds into the run.
  course.nextPotionChunk=random(course)<.5?1:2;
  return course;
}
export function ensureCourse(course,throughTime,keepAfter=-Infinity) {
  if (!Number.isFinite(throughTime)) return course;
  if(course.generatedUntil>=throughTime&&!course.chunks.some(chunk=>chunk.end<keepAfter)) return course;
  while(course.generatedUntil<throughTime) appendChunk(course);
  // Never drop the one chunk containing the cat. Normal engine use retains at
  // most a few chunks, irrespective of total run duration.
  course.chunks=course.chunks.filter(chunk=>chunk.end>=keepAfter);
  course.terrain=course.chunks.flatMap(chunk=>chunk.terrain);
  course.terrainEdges=[...new Set(course.terrain.flatMap(s=>[s.start,s.end]))].sort((a,b)=>a-b);
  course.encounters=course.chunks.flatMap(chunk=>chunk.encounters);
  course.pickups=course.chunks.flatMap(chunk=>chunk.pickups);
  return course;
}
