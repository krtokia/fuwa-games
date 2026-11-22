// Character metadata is presentation only. Every runner uses the same engine,
// collision body, course, speed and time budget.
export const CHARACTER_IDS = Object.freeze(['fuwa', 'shuri', 'nabi']);

// Generated cells are measured independently: movement 362-square for each
// cat; reactions 627-square. Crops/anchors are source-pixel registrations,
// never collision-body sizes. Airborne paws deliberately retain their lift.
export const CHARACTERS = Object.freeze({
  fuwa: {
    id: 'fuwa', name: '후와', withName: '후와와', subject: '후와가',
    description: '풍성한 회색 털과 연두빛 눈을 가진 후와',
    portrait: { path: './assets/fuwa-generated.png', columns: 1, rows: 1, cellAspect: 1.5 },
    reaction: { kind: 'hiss', sound: 'hiss', label: '하악!', name: '하악', description: '앞을 보고 하악!', waiting: '후와가 진정하면 다시 달려요', terminal: '후와가 잠깐 진정하는 중', resumed: '하악! 다시 달려요!' },
  },
  shuri: {
    id: 'shuri', name: '슈리', withName: '슈리와', subject: '슈리가',
    description: '날씬한 몸과 선명한 갈색 줄무늬, 큰 귀를 가진 슈리',
    portrait: { path: './assets/shuri-motion-v1.png', columns: 4, rows: 3, cellAspect: 1, crop: [0, 90/362, 1, 210/362] },
    movement: { key: 'shuri-motion', path: './assets/shuri-motion-v1.png', columns: 4, rows: 3, count: 12, scale: .55, crops: Array.from({length:12},()=>[0,45,362,270]), anchors: Array.from({length:12},(_,i)=>[.5,(i<10?240:225)/270]), floorOverhang: [0,0,0,0,0,0,.55,0,0,2.2,0,0] },
    reaction: { kind: 'tumble', sound: 'roll', label: '데굴!', name: '앞구르기', description: '몸을 둥글게 말아 앞구르기', waiting: '슈리가 앞구르기를 마치면 다시 달려요', terminal: '슈리가 앞구르기를 마치는 중', resumed: '데굴! 다시 달려요!', atlas: { key: 'shuri-tumble', path: './assets/shuri-tumble-v1.png', columns: 2, rows: 2, count: 4, scale: .38, crops: Array.from({length:4},()=>[0,110,627,390]), anchors: [375,376,322,322].map(y=>[.5,y/390]) } },
  },
  nabi: {
    id: 'nabi', name: '나비', withName: '나비와', subject: '나비가',
    description: '짙은 회색 털과 하얀 턱·가슴·발, 노란 눈을 가진 나비',
    portrait: { path: './assets/nabi-motion-v1.png', columns: 4, rows: 3, cellAspect: 1, crop: [30/362, 100/362, 305/362, 195/362] },
    movement: { key: 'nabi-motion', path: './assets/nabi-motion-v1.png', columns: 4, rows: 3, count: 12, scale: .70, anchors: Array.from({length:12},(_,i)=>[.5,(i===10?250:i===11?252:274)/362]), floorOverhang: [0,0,0,0,0,0,.7,0,0,0,.7,0] },
    reaction: { kind: 'punch', sound: 'punch', label: '냥펀치!', name: '냥냥펀치', description: '이쪽을 보고 앞발로 냥냥펀치', waiting: '나비가 냥냥펀치를 마치면 다시 달려요', terminal: '나비가 냥냥펀치를 마치는 중', resumed: '냥펀치! 다시 달려요!', atlas: { key: 'nabi-punch', path: './assets/nabi-punch-v1.png', columns: 2, rows: 2, count: 4, scale: .20, anchors: [575,575,573,569].map(y=>[.5,y/627]) } },
  },
});

export function getCharacter(id) {
  return typeof id === 'string' && Object.hasOwn(CHARACTERS, id) ? CHARACTERS[id] : CHARACTERS.fuwa;
}

// Preserve Fuwa's existing two-atlas animation API. New atlases contain the
// same twelve movement states in one sheet, with independent registration.
export function movementFrame(pose) {
  return pose.texture === 'jump-land' ? 8 + pose.frame : pose.frame;
}

export function characterAtlases() {
  return CHARACTER_IDS.flatMap(id => {
    const character = CHARACTERS[id];
    return character.movement ? [character.movement, character.reaction.atlas] : [];
  });
}

// Rounded shared boundaries support non-square cells and odd-size generation.
export function atlasFrame(atlas, index, width, height) {
  const column = index % atlas.columns, row = Math.floor(index / atlas.columns);
  const x = Math.round(column * width / atlas.columns), y = Math.round(row * height / atlas.rows);
  const right = Math.round((column + 1) * width / atlas.columns), bottom = Math.round((row + 1) * height / atlas.rows);
  const crop = atlas.crops?.[index];
  return crop ? { x: x + crop[0], y: y + crop[1], width: crop[2], height: crop[3] } : { x, y, width: right - x, height: bottom - y };
}

export function atlasAnchor(atlas, index) {
  return atlas.anchors?.[index] ?? atlas.anchor;
}
