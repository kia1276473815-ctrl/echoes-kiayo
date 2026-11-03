// ------------------------------------------------------------
// 내용을 고칠 곳은 대부분 여기에 있습니다.
// ------------------------------------------------------------

// 발표자 이름 (제목 화면 오른쪽 아래). 비워 두면 표시하지 않음.
export const PRESENTER = 'Kiayo · 欧阳俊玮';

// 내 곡. markers 가 비어 있으면 오디오 에너지에서 자동으로 세 지점을 찾는다.
// 직접 쓰려면: { t: 초, label: '화면에 보일 한 줄', sub: '작은 설명' }
export const MINE = {
  totem: {
    src: 'audio/mine/totem.wav', title: 'Totem', meta: 'v3 · 2:19 · 48 kHz / 24 bit',
    text: 'Alon Mor처럼 무겁고 두꺼운 전자음을 깔고, 그 위에 라틴 음악을 섞었다. 그의 곡에서 가끔 스페인이나 인도 느낌이 나는 것처럼, 이 곡에서는 무거운 저음 밑으로 라틴 리듬과 멜로디가 지나간다.',
    markers: [],
    bpm: null,   // 실제 BPM을 알면 적기 (비우면 자동 추정). 클라베가 이 템포로 돈다.
    // 곡의 구간이 바뀌는 시점(초). 오디오 분석으로 찾은 값. 화면이 이 시점마다 크게 바뀐다.
    sections: [0, 7.15, 29.05, 53.85, 77.85, 107.95, 133.15],
  },
  '114514': {
    src: 'audio/mine/114514.wav', title: 'Прокофьев', meta: 'v4 · 4:14 · 48 kHz / 16 bit',
    text: 'Floating Points가 Promises랑 Mere Mortals에서 오케스트라와 전자음을 한 곡에 넣은 것처럼, 이 곡에서는 클래식과 실험적인 전자음악을 섞어 봤다. 제목은 러시아 작곡가 프로코피예프에서 따왔다.',
    markers: [],
    bpm: 160,        // 악보 (현악 4중주, 4/4)
    sections: [0, 33.1, 94.35, 155.75, 205.05],
    drain: 218.45,   // 소리가 빠지기 시작하는 곳 (220.2–221.6초는 거의 무음)
    twist: 221.75,   // 3분 41초: 곡이 뒤집히는 곳
    twist2: 238.5,   // 3분 58초: 소리가 한꺼번에 꺼지는 곳 (끝까지 낮은 웅웅거림만 남아요)
  },
  sub: { src: 'audio/mine/sub.mp3', title: 'sub', meta: '0:34' },
};

// 30초 미리듣기 (Apple Music 공식 프리뷰). 파일은 assets/audio/
export const PREVIEWS = {
  'fp-promises-m1': { title: 'Movement 1', album: 'Promises', year: 2021 },
  'fp-silhouettes': { title: 'Silhouettes (I, II & III)', album: 'Elaenia', year: 2015 },
  'fp-kelso': { title: 'Kelso Dunes', album: 'Reflections – Mojave Desert', year: 2017 },
  'fp-lesalpx': { title: 'LesAlpx', album: 'Crush', year: 2019 },
  'fp-birth4000': { title: 'Birth4000', album: 'Cascade', year: 2024 },
  'fp-jar': { title: 'Movement 11 – Opening of the Jar', album: 'Mere Mortals', year: 2026 },
  'fp-falling': { title: 'Movement 8 – Falling to Earth', album: 'Mere Mortals', year: 2026 },
  'fp-hope': { title: 'Movement 2 – Hope', album: 'Mere Mortals', year: 2026 },
  'fp-rage': { title: 'Movement 3 – Rage of the Gods', album: 'Mere Mortals', year: 2026 },
  'am-echoes': { title: 'Echoes Follow', album: 'Lands of Delight', year: 2019 },
  'am-whogoes': { title: 'Who Goes There?', album: 'Non-Fiction', year: 2025 },
  'am-flame': { title: 'Flame Devourer', album: 'Lands of Delight', year: 2019 },
  'am-whale': { title: 'Whale Song (From ILL Soundtrack)', album: 'Whale Song', year: 2025 },
  'am-will': { title: 'Within Will', album: 'Within', year: 2024 },
  'am-skyline': { title: 'Late Night Skyline', album: 'Long Awaited Journey', year: 2017 },
  'am-beyond': { title: 'Beyond Stars', album: 'Masters of the Human Imagination', year: 2015 },
  'am-organon': { title: 'Organon', album: 'Organon', year: 2026 },
  'am-antesia': { title: 'Antesia', album: 'Escape to Antesia', year: 2013 },
  'am-study1': { title: 'Sequenced Study 1', album: '4 Sequenced Studies', year: 2024 },
};
export const previewSrc = (k) => `assets/audio/${k}.m4a`;

// A/B 비교: 들은 것 ↔ 만든 것
export const PAIRS = {
  am: { ref: 'am-echoes', mine: 'totem', label: 'Alon Mor — Echoes Follow', color: '#C8924A' },
  fp: { ref: 'fp-promises-m1', mine: '114514', label: 'Floating Points — Promises, Movement 1', color: '#F2EFEA' },
};

export const FP_ALBUMS = [
  { key: 'elaenia', cover: 'fp-elaenia', preview: 'fp-silhouettes', year: 2015, title: 'Elaenia', label: 'Pluto · Luaka Bop',
    text: '꿈에서 시작된 첫 정규 앨범. 재즈 앙상블의 악기와 신시사이저가 하나의 긴 호흡처럼 이어진다. Pharoah Sanders가 셰퍼드를 알게 된 앨범.' },
  { key: 'reflections', cover: 'fp-reflections', preview: 'fp-kelso', year: 2017, title: 'Reflections – Mojave Desert', label: 'EP',
    text: '밴드와 함께 모하비 사막 한가운데서 녹음했다. 반사가 없는 공간 자체를 악기로 쓴 기록.' },
  { key: 'crush', cover: 'fp-crush', preview: 'fp-lesalpx', year: 2019, title: 'Crush', label: 'Ninja Tune',
    text: 'The xx의 투어 오프닝에서 Buchla 신시사이저로 하던 즉흥 연주가 단 5주 만에 앨범이 되었다.' },
  { key: 'promises', cover: 'fp-promises', preview: 'fp-promises-m1', year: 2021, title: 'Promises', label: 'Luaka Bop · w/ Pharoah Sanders & LSO',
    text: '아홉 개의 악장으로 된 46분짜리 단 한 곡. 영국 앨범 차트 6위, 머큐리상 후보. Pharoah Sanders의 마지막 앨범.' },
  { key: 'cascade', cover: 'fp-cascade', preview: 'fp-birth4000', year: 2024, title: 'Cascade', label: 'Ninja Tune',
    text: 'Crush의 연장선에서 다시 플로어로. 곡 제목마다 그가 자란 맨체스터의 장소와 라디오가 숨어 있다.' },
  { key: 'meremortals', cover: 'fp-meremortals', preview: 'fp-falling', year: 2026, title: 'Mere Mortals', label: 'Deutsche Grammophon',
    text: '샌프란시스코 발레단을 위한 첫 전막 발레 음악. 2024년 초연 뒤, 2026년 8월 열네 곡의 음반으로 나왔다.' },
];

// 행성 크기는 대략적인 작품 규모(분)를 따름
export const AM_WORLDS = [
  { cover: 'am-antesia', preview: 'am-antesia', year: '2013', title: 'Escape to Antesia', size: 1.0,
    text: '첫 앨범. ‘Antesia’라는 상상의 땅으로의 탈출. 그의 세계 짓기는 여기서 시작됐다.' },
  { cover: 'am-masters', preview: 'am-beyond', year: '2015', title: 'Masters of the Human Imagination', size: 1.0,
    text: '두 번째 앨범, ‘인간 상상력의 대가들’.' },
  { cover: 'am-laj', preview: 'am-skyline', year: '2017', title: 'Long Awaited Journey', size: 1.15,
    text: '열한 곡. 청취자들은 투쟁과 행복을 찾는 자전적 여정이라 부른다. 곡 사이의 낭송은 그의 목소리다.' },
  { cover: 'am-lands', preview: 'am-echoes', year: '2019', title: 'Lands of Delight', size: 0.95,
    text: '일곱 곡, 38분. Echoes Follow, Flame Devourer. 이 발표의 제목 ‘메아리’도 여기서 왔다.' },
  { cover: 'am-within', preview: 'am-will', year: '2024', title: 'Within', size: 1.3,
    text: '다섯 개의 Within, 59분. 가사는 히브리 시인 비알리크의 시에서.' },
  { cover: 'am-4ss', preview: 'am-study1', year: '2024', title: '4 Sequenced Studies', size: 0.6,
    text: '네 개의 ‘시퀀스 연구’로 된 EP.' },
  { cover: 'am-nonfiction', preview: 'am-whogoes', year: '2025', title: '“Non-Fiction”', size: 0.6,
    text: '‘논픽션’이라는 제목의 EP. 첫 곡의 제목은 Who Goes There? — 거기 누구냐.' },
  { cover: 'am-whale', preview: 'am-whale', year: '2025', title: 'Whale Song (ILL)', size: 0.55, ill: true,
    text: '호러 게임 ILL 사운드트랙에서 싱글로 공개된 곡. 거대한 미지의 생명체의 일생.' },
  { cover: 'am-organon', preview: 'am-organon', year: '2026', title: 'Organon', size: 0.75,
    text: '베를린 갤러리 Chaussee36의 몰입형 전시. 사진가 Jaqueline Louan, 가수 Julianna Schreyer와 함께 “세 예술가가 하나의 유기체가 된다”.' },
];

// Promises 악장 길이(초) — Apple Music 트랙 정보. 주석은 위키백과의 악장 해설
export const PROMISES = [
  { n: 1, len: 384, note: '모티프가 처음 등장한다. 신시사이저, 피아노, 하프시코드.' },
  { n: 2, len: 151, note: '' },
  { n: 3, len: 152, note: '' },
  { n: 4, len: 152, note: 'Sanders가 색소폰을 내려놓고 말없는 목소리로 노래한다.' },
  { n: 5, len: 265, note: '' },
  { n: 6, len: 531, note: '현악이 점점 커져 전체를 덮고, 악장 끝에서 물러난다. 곡의 정점.' },
  { n: 7, len: 569, note: '악장이 끝나면서 Sanders의 색소폰도 끝난다.' },
  { n: 8, len: 443, note: '모티프가 서서히 사라진다.' },
  { n: 9, len: 150, note: '몇 번의 ‘거짓 끝’을 지나, 곡이 닫힌다.' },
];

export const BED_LEVEL = 0.5;

// Whale Song 미리듣기의 세 번의 임팩트(초). 저음 에너지가 갑자기 12–16 dB 뛰는 곳. 이 순간에만 크게 터진다.
export const WHALE_IMPACTS = [0.31, 4.57, 8.91];
