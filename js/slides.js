// Per-slide behaviour. S (from main.js): el, q(), eng, add(), later(), every(), t, toStage(), state
import { Raster, InkLine, Sand, Score, Layers, Stave, Blast, Arch, Flock, Spin, Spectrogram, LowVsHigh, Scrub, Spiral, Coda, Picado, Clave, Page116, C, rgba, fmt, clamp } from './viz.js';
import { Vinyl, Jar, Worlds, Wave, Totem, Leviathan, Monument, COLLAGE } from './scenes3d.js';
import { MINE, PREVIEWS, PAIRS, FP_ALBUMS, AM_WORLDS, PROMISES, PRESENTER, WHALE_IMPACTS } from './config.js';
import { t } from './i18n.js';
import { asset } from './assets.js';
import { Wall } from './wall.js';
import { PRO_EVENTS } from './pro-events.js';
import { PRO_SCORE } from './pro-score.js';
import { PRO_BARS } from './pro-bars.js';
import { BIRDS } from './birds.js';

// the events of a list ([time, ...] sorted by time) in (a, b]
const between = (list, a, b) => {
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] <= a) lo = m + 1; else hi = m; }
  const out = [];
  for (let i = lo; i < list.length && list[i][0] <= b; i++) out.push(list[i]);
  return out;
};

const mk = (tag, cls, css, html) => { const d = document.createElement(tag); d.className = cls; if (css) d.style.cssText = css; if (html != null) d.innerHTML = html; return d; };
// the album rail is part of the page from the start: the Elaenia cover on the page before lands on its first sleeve
{
  const rail = document.querySelector('#alb-rail');
  FP_ALBUMS.forEach((a, i) => {
    const d = mk('div', 'sleeve', '', `<img src="${asset(`assets/covers/${a.cover}.jpg`)}" alt=""><p class="cap"><b>${a.title}</b><br>${a.year}</p>`);
    if (i === 0) d.querySelector('img').dataset.morph = 'cover-elaenia';
    rail.appendChild(d);
  });
}
const stage = () => document.getElementById('stage');

// strongest note onset within 1.3 s of each target time (envelope hop = 10 ms)
function motifOnsets(env, targets) {
  const on = new Float32Array(env.length);
  for (let i = 30; i < env.length; i++) {
    let m = 0;
    for (let j = i - 30; j < i; j++) m += env[j];
    on[i] = Math.max(0, env[i] - (m / 30) * 1.35);
  }
  return targets.map((t) => {
    let best = Math.round(t * 100), bv = 0;
    for (let i = Math.max(0, Math.round((t - 1.3) * 100)); i < Math.min(on.length, Math.round((t + 1.3) * 100)); i++) if (on[i] > bv) { bv = on[i]; best = i; }
    return best / 100;
  });
}

// a woodblock: two short partials, scheduled `dt` seconds ahead
function woodblock(eng, dt) {
  const c = eng.ctx, t = c.currentTime + Math.max(0, dt);
  [[2550, 0.16], [1720, 0.07]].forEach(([f, g0]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(eng.fxBus);
    o.start(t); o.stop(t + 0.09);
  });
}

// a blot of ink: a soft disc whose edge is torn by noise, used as a growing mask (interlude 1)
let INK_MASK = null;
function inkMask() {
  if (INK_MASK) return INK_MASK;
  const n = 384, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  const rnd = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = (x - xi) ** 2 * (3 - 2 * (x - xi)), v = (y - yi) ** 2 * (3 - 2 * (y - yi));
    const a = rnd(xi, yi), b = rnd(xi + 1, yi), c2 = rnd(xi, yi + 1), d = rnd(xi + 1, yi + 1);
    return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x / n - 0.5, dy = y / n - 0.5, r = Math.hypot(dx, dy) * 2;
    let f = 0, amp = 0.5, fr = 4;
    for (let o = 0; o < 4; o++) { f += amp * noise(dx * fr + 9, dy * fr + 3); amp *= 0.5; fr *= 2.1; }
    img.data[(y * n + x) * 4 + 3] = Math.max(0, Math.min(1, (0.78 - (r + (f - 0.47) * 0.55)) / 0.16)) * 255;
  }
  g.putImageData(img, 0, 0);
  return (INK_MASK = `url(${c.toDataURL()})`);
}

// a small bird's call: four quick chirps. slow > 1 stretches it down in pitch and time, toward a moan
function birdCall(eng, slow, gain) {
  let t = eng.now + 0.02;
  for (const [f0, f1, d] of [[3800, 2600, 0.07], [4300, 3100, 0.06], [3400, 4400, 0.09], [3900, 2400, 0.13]]) {
    eng.chirp(f0 / slow, f1 / slow, d * slow, { when: t, gain, verb: slow > 1 ? 0.9 : 0.25, pan: (Math.random() - 0.5) * 0.6, type: slow > 2 ? 'triangle' : 'sine', mid: (f0 * 1.12) / slow });
    t += (d + 0.045) * slow;
  }
}

// the tonearm reaches the record 2.1 s after the page opens: a click and a little surface noise
function needle(S) {
  S.later(2100, () => {
    S.eng.noiseHit({ f0: 5200, f1: 2600, dur: 0.05, attack: 0.002, gain: 0.07 });
    S.eng.noiseHit({ f0: 1800, f1: 900, dur: 0.9, attack: 0.01, gain: 0.025 });
  });
}

// shared logic for my two tracks
function myTrack(id, prefix, build) {
  return {
    bed: { id, gain: 1, restart: true, loop: false },
    enter(S) {
      const tr = MINE[id];
      S.q(`#${prefix}-meta`).textContent = tr.meta + (S.state.extraMeta || '');
      S.q(`#${prefix}-text`) && (S.q(`#${prefix}-text`).textContent = t(tr.text));
      const btn = S.q(`#${prefix}-play`);
      btn.onclick = () => this.toggle(S);
      S.state.btn = btn;
      this.label(S, S.eng.bedKey === id);
      S.eng.need(id).then((buf) => { if (buf && S.alive) build(S, buf); });
    },
    label(S, playing) { S.state.btn.innerHTML = `${t(playing ? '일시정지' : '재생')} <span class="kbd">K</span>`; },
    toggle(S) {
      if (S.eng.bedKey === id) { S.eng.setBed(null, 0.4); this.label(S, false); }
      else { S.eng.setBed({ id, gain: 1, keepPos: true, loop: false }, 0.4); this.label(S, true); }
    },
    seek(S, at) {
      if (S.eng.bedKey === id && S.eng.bed) S.eng.bed.seek(at);
      else { S.eng.setBed({ id, offset: at, gain: 1, restart: true, loop: false }, 0.2); this.label(S, true); }
    },
    key(S, e) { if (e.key === 'k' || e.key === 'K') { this.toggle(S); return true; } },
    frame(S) {
      const buf = S.eng.buffers[id];
      if (buf) S.q(`#${prefix}-time`).textContent = `${fmt(S.eng.bedPos(id))} / ${fmt(buf.duration)}`;
    },
  };
}

export const SLIDES = {
  gate: { bed: null, notes: '시작 전에 조명 낮추고 볼륨 확인. 스페이스를 누르면 바로 시작해요. 처음 30초쯤은 말하지 않습니다. 발표 중에 ↑를 누르면 음악이 잠깐 올라오고, ↓를 누르면 다시 내려가요. 마침표(.)는 화면과 소리를 잠깐 끄는 키예요. 프로젝터에서 작은 글씨가 흐리면 H를 눌러 보세요.' },

  cold: {
    bed: { id: 'fp-promises-m1', gain: 0.95, restart: true, offset: 0 },
    notes: '(말하지 않습니다. 세 줄이 다 뜰 때까지 12초쯤, Promises 모티프만 듣게 둡니다.)',
    enter(S) {
      // each line lands on a note of the motif: the onset nearest to 2.4 s, 5.4 s, 8.4 s
      const lines = [...S.el.querySelectorAll('.cold-line')];
      lines.forEach((l) => (l.style.opacity = 0));
      const buf = S.eng.buffers['fp-promises-m1'];
      const times = buf ? motifOnsets(S.eng.envelope('fp-promises-m1', 0.01), [2.4, 5.4, 8.4]) : [2.4, 5.4, 8.4];
      const lead = performance.now() - S.bedT0;
      lines.forEach((l, i) => S.later(Math.max(0, times[i] * 1000 - lead), () => l.animate(
        [{ opacity: 0, filter: 'blur(12px)', transform: 'translateY(10px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }],
        { duration: 2200, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' })));
    },
  },

  title: {
    gain: 0.75,
    notes: '안녕하세요. 오늘은 제가 좋아하는 프로듀서 두 명, Floating Points와 Alon Mor 이야기를 하려고 해요. 두 사람한테 배워서 만든 제 곡 두 개도 들려드릴게요.',
    enter(S) { if (PRESENTER) S.el.appendChild(mk('p', 'cap abs gen', 'right:var(--m);top:250px', `${t('발표 · ')}${PRESENTER}`)); },
  },

  pair: { gain: 0.55, notes: '왼쪽이 Floating Points, 런던에서 활동하고 신경과학 박사예요. 오른쪽이 Alon Mor, 베를린에 사는 작곡가고요. 두 사람은 같이 작업한 적이 없어요. 제 작업실 스피커에서만 자주 만나죠. 왼쪽 사람부터 볼게요.' },

  'side-a': { enter: (S) => needle(S), notes: '오늘 발표는 레코드처럼 A면, B면, C면으로 나눴어요. A면은 Floating Points. 가운데 레이블은 그의 첫 앨범 Elaenia 커버고, 오른쪽이 A면에서 볼 내용이에요.' },
  'side-b': { enter: (S) => needle(S), notes: 'B면은 Alon Mor예요. 레이블 안에 있는 사람이 그고요. 지금 나오는 곡이 Echoes Follow인데, 발표 제목의 ‘메아리’를 여기서 가져왔어요.' },
  'side-c': {
    bed: null,
    notes: '마지막 C면은 제 곡이에요. 두 사람한테 배워서 만든 곡 두 개요. 물결 두 개가 만나면 겹치는 데에 새 무늬가 생기잖아요. 하얀 게 Floating Points, 금색이 Alon Mor예요. 저는 두 사람을 완전히 다르게 만났어요. Floating Points는 음악 선생님이 들어 보라고 해서 알게 됐고, Alon Mor는 집에 가다가 우연히 들었어요. 하나는 추천, 하나는 우연. 빨갛게 솟은 데가 둘이 겹친 곳이고, 제 레코드는 거기서 올라와요. 제 곡 두 개가 거기서 나왔다고 생각해요. (곡을 누르면 그쪽 물결이 커져요. 1은 맨 처음에 나왔던 Promises 1악장, 2는 제목의 ‘메아리’가 나온 Echoes Follow예요.)',
    enter(S) {
      needle(S);
      const wave = (S.state.wave = S.add(new Wave(S.q('#cv-wave'))));
      S.state.crest = S.q('#me-crest');
      S.state.cards = [S.q('#src-fp'), S.q('#src-am')];
      const songs = S.state.cards.map((c) => c.querySelector('.meet-song'));
      songs.forEach((el) => el.classList.remove('playing'));
      S.state.play = (k) => {
        const el = songs[k], on = !el.classList.contains('playing');
        songs.forEach((x) => x.classList.toggle('playing', on && x === el));
        wave.focus(on ? k : -1);
        S.eng.setBed(on ? { id: el.dataset.song, gain: 0.8 } : null, 0.8);
        if (on) { S.eng.need(el.dataset.song); S.accent(5); }
      };
      songs.forEach((el, k) => (el.onclick = () => S.state.play(k)));
      ['fp-promises-m1', 'am-echoes'].forEach((id) => S.eng.need(id));
    },
    // each label rides on its source
    frame(S) {
      const P = S.state.wave.pinXY, R = [], [cx, cy] = S.state.wave.crestXY;
      S.state.crest.style.translate = `${(cx - 115).toFixed(1)}px ${(cy - 115).toFixed(1)}px`;
      S.state.cards.forEach((c, k) => {
        // Floating Points opens to the left of its source, so its label never lies under the crest between them
        const w = c.offsetWidth, h = c.offsetHeight, [x, y] = P[k], flip = k === 0 ? x - w > 20 : x + w > 1880;
        c.classList.toggle('flip', flip);
        const left = Math.max(20, Math.min(1900 - w, flip ? x - w : x));
        let top = Math.max(20, Math.min(1060 - h, y - 14));
        // the two labels never sit on each other: the second one steps down below the first
        const o = R[0];
        if (o && left < o.left + o.w && left + w > o.left && top < o.top + o.h + 16 && top + h > o.top) top = o.top + o.h + 16;
        R.push({ left, top, w, h });
        c.style.translate = `${left.toFixed(1)}px ${top.toFixed(1)}px`;
      });
    },
    key(S, e) { if (e.key === '1' || e.key === '2') { S.state.play(+e.key - 1); return true; } },
  },

  'fp-hero': {
    gain: 0.6,
    notes: 'Floating Points, 본명은 샘 셰퍼드예요. 1986년에 맨체스터에서 태어났고요. 클럽 DJ도 하고, 곡도 쓰고, 신경과학 박사이기도 해요. 레이블을 두 개 만들었고, 레코드를 만 장 넘게 모았어요.',
    enter(S) {
      // the record count runs up as it appears
      const tn = S.q('.num').firstChild, t0 = performance.now() + 1700;
      const step = () => {
        if (!S.alive) return;
        const u = Math.min(1, Math.max(0, (performance.now() - t0) / 2200));
        tn.textContent = Math.round(10000 * (1 - Math.pow(1 - u, 4))).toLocaleString('en-US');
        if (u < 1) requestAnimationFrame(step);
      };
      step();
    },
  },

  'fp-roots': { gain: 0.45, notes: '시작은 맨체스터예요. 음악학교에서 피아노를 배웠고, 수업에서 안 가르치는 음악은 학교 바로 옆 레코드 가게들에서 들었대요. 2024년 앨범 Cascade를 보면 그때 다니던 곳이랑 듣던 라디오 이름이 곡 제목으로 들어가 있어요.' },

  'fp-neuro': {
    gain: 0.45,
    notes: 'UCL에서 신경과학 박사 학위를 받았어요. 낮에는 실험실에 있다가, 밤에는 런던 클럽 Plastic People에서 DJ를 했고요. 오른쪽 아래는 지금 나오는 음악을, 신경과학자들이 뉴런 발화를 기록하는 방식으로 그려 본 거예요. 리듬이 정말 발화처럼 찍혀요. (넘기면 밤이 돼요. 실험실이 클럽으로 바뀌어요.)',
    steps: 1,
    enter(S) { S.add(new Raster(S.q('#cv-raster'))); },
  },

  'fp-elaenia': {
    gain: 0.5,
    notes: '2015년 첫 정규 앨범 Elaenia예요. 제목은 꿈에서 나왔어요. 새 한 마리가 숲에 삼켜지는 꿈이요. 이 새는 2부에 한 번 더 나오니까 기억해 주세요. 오른쪽 선은 커버 그림처럼 그린 건데, 지금 나오는 소리가 펜을 움직여요.',
    enter(S) { S.add(new InkLine(S.q('#cv-ink'))); },
  },

  'fp-albums': {
    ownAudio: true,
    notes: '그의 앨범 여섯 장이에요. 커버를 누르면 레코드가 나오고 30초씩 들을 수 있어요. (Crush랑 Promises를 틀어 주세요.) 클럽 음악, 재즈, 오케스트라, 발레까지 장르는 계속 바뀌는데, 들어 보면 같은 사람이 만든 게 느껴져요.',
    enter(S) {
      const vinyl = S.add(new Vinyl(S.q('#cv-vinyl')));
      FP_ALBUMS.forEach((x) => S.eng.need(x.preview));
      const sleeves = [...S.q('#alb-rail').children];
      sleeves.forEach((d, i) => { d.onclick = () => select(i); });
      const info = [S.q('#alb-meta'), S.q('#alb-title'), S.q('#alb-text')];
      const select = (i) => {
        const a = FP_ALBUMS[i];
        S.state.sel = i;
        sleeves.forEach((s, k) => { s.classList.toggle('sel', k === i); s.classList.toggle('dim', k !== i); });
        info[0].textContent = `${a.year} · ${a.label}`;
        info[1].textContent = a.title;
        info[2].textContent = t(a.text);
        info.forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 600, delay: k * 60, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'backwards' }));
        vinyl.setAlbum(`assets/covers/${a.cover}.jpg`);
        S.eng.setBed({ id: a.preview, gain: 0.8 }, 1.2);
        if (S.state.ready) S.accent();
      };
      S.state.select = select;
      select(0);
      S.state.ready = true;
    },
    key(S, e) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 6) { S.state.select(n - 1); return true; } },
  },

  'fp-sanders': { steps: 1, gain: 0.5, notes: '2015년에 재즈 색소폰 연주자 Pharoah Sanders가 이 사람 첫 앨범을 들었어요. 존 콜트레인이랑 같이 연주했던 사람이고, 그때 일흔다섯 살이었어요. 앨범을 같이 만들자고 먼저 말한 것도 Sanders였고요. 그렇게 6년 뒤에 나온 게 Promises예요. (처음엔 그가 한 말만 보여요. 넘기면 이야기가 나와요.)' },

  'fp-score': {
    gain: 0.6,
    notes: 'Promises는 악장 아홉 개로 된 46분짜리 한 곡이에요. 막대 길이가 실제 악장 길이고요. 짧은 모티프가 곡의 절반 가까이 계속 돌아오고, 6악장에서 현악이 제일 커지고, 7악장 끝에서 Sanders의 색소폰이 끝나요. (악장을 누르면 설명이 나와요.)',
    enter(S) {
      const note = mk('p', 'lead abs gen', 'left:var(--m);top:470px;width:1300px;font-size:24px;color:var(--ink)');
      S.el.appendChild(note);
      const show = (i) => {
        const m = PROMISES[i];
        note.innerHTML = `<b>${t('{n}악장').replace('{n}', m.n)}</b> · ${fmt(m.len)}${m.note ? ' — ' + t(m.note) : ''}`;
        note.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      };
      S.add(new Score(S.q('#cv-score'), { movements: PROMISES.map((m) => ({ ...m })), onSelect: show }));
      show(0);
    },
  },

  'fp-mojave': {
    gain: 0.7,
    notes: '2016년에 밴드를 데리고 모하비 사막에 갔어요. 벽이 없으니까 소리가 어디에도 안 부딪혀요. 곡 제목 Kelso Dunes가 바로 이 모래 언덕이고, 지금 나오는 게 그 곡이에요.',
    enter(S) { S.add(new Sand(S.q('#cv-sand'))); },
  },

  'fp-crush': {
    gain: 0.7,
    notes: 'Crush는 2017년 The xx 투어 오프닝 무대에서 나왔어요. Buchla 신시사이저로 즉흥 연주를 하다가 5주 만에 앨범을 냈대요. 오른쪽 아래는 이 곡을 저음, 중음, 고음으로 나눈 건데, 클럽 음악이 이렇게 층층이 쌓이는 게 보여요.',
    enter(S) { S.add(new Layers(S.q('#cv-layers'))); },
  },

  'fp-mortals': {
    gain: 0.6,
    steps: 1,
    oneWay: true,
    step(S, k) { if (k === 1) S.state.open(); },
    bed: { id: 'fp-hope', gain: 0.6, offset: 0, restart: true, loop: false },
    notes: '2024년 샌프란시스코 발레단 공연 Mere Mortals, 판도라 이야기예요. 판도라라는 이름이 원래 ‘주는 사람’이라는 뜻이었다는 해석을 읽고 작업했대요. 항아리를 열기 전에는 2악장 Hope(희망)가 나와요. 항아리를 한번 열어 볼게요. (클릭) 다 빠져나가고, 음악도 3악장 Rage of the Gods(신들의 분노)로 바뀌어요. Hope가 끝날 때까지 안 열면 저절로 열려요.',
    enter(S) {
      const jar = S.add(new Jar(S.q('#cv-jar')));
      S.state.jar = jar;
      const song = S.q('#jar-song');
      song.innerHTML = `<b>Hope</b> · ${t('2악장, 지금 나오는 곡')}`;
      S.state.opened = false;
      // the picture is cut into uneven bands that the music can tear sideways once the gods are here
      const fig = S.q('#pandora'), src = fig.querySelector('img').src;
      let y = 0;
      S.state.strips = [];
      while (y < 100) {
        const h = Math.min(100 - y, 3 + Math.random() * 13);
        const d = mk('div', 'strip gen', `clip-path:inset(${y}% 0 ${100 - y - h}% 0);opacity:0`, `<img src="${src}" alt="">`);
        fig.appendChild(d);
        S.state.strips.push(d);
        y += h;
      }
      // what leaves the jar, by its Greek names: sickness, toil, old age, strife, famine, fear, grief, deceit, envy, madness
      const EVILS = ['ΝΟΣΟΣ', 'ΠΟΝΟΣ', 'ΓΗΡΑΣ', 'ΕΡΙΣ', 'ΛΙΜΟΣ', 'ΦΟΒΟΣ', 'ΛΥΠΗ', 'ΑΠΑΤΗ', 'ΦΘΟΝΟΣ', 'ΜΑΝΙΑ'];
      S.state.evil = 0; S.state.evilAt = 0;
      S.state.release = () => {
        const w = EVILS[S.state.evil++ % EVILS.length], a = (-165 + Math.random() * 120) * (Math.PI / 180), d = 520 + Math.random() * 420;
        const size = 46 + Math.random() * 70, rot = (Math.random() - 0.5) * 24;
        const e = mk('p', 'evil gen', `font-size:${size}px`, w);
        S.el.insertBefore(e, S.q('.eyebrow'));
        e.animate([
          { opacity: 0, transform: `translate(-50%,-50%) scale(.3)`, filter: 'blur(4px)', letterSpacing: '0em' },
          { opacity: 0.62, filter: 'blur(0px)', offset: 0.22 },
          { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) rotate(${rot}deg) scale(1.25)`, filter: 'blur(7px)', letterSpacing: '.4em' },
        ], { duration: 3800 + Math.random() * 1600, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.then(() => e.remove(), () => {});
      };
      S.state.tear = (n, amp) => {
        const st = S.state.strips;
        for (let k = 0; k < n; k++) {
          const d = st[(Math.random() * st.length) | 0], x = (Math.random() < 0.5 ? -1 : 1) * amp * (0.4 + Math.random() * 0.6);
          d.animate([{ opacity: 1, transform: `translateX(${x}px)` }, { opacity: 1, transform: `translateX(${x * 0.3}px)`, offset: 0.5 }, { opacity: 0, transform: 'none' }], { duration: 240 + Math.random() * 260, easing: 'steps(4, end)' });
        }
      };
      S.state.open = () => {
        if (S.state.opened || !jar.open()) return;
        S.state.opened = true;
        if (S.step < 1) S.toStep(1);
        S.eng.noiseHit({ f0: 260, f1: 5200, dur: 2.6, attack: 1.3, gain: 0.18, verb: 0.6, q: 0.8 });
        S.eng.thump({ when: S.eng.now + 1.3, gain: 0.5 });
        // the gods arrive as the lid comes off
        S.eng.setBed({ id: 'fp-rage', gain: 0.8, offset: 0, restart: true, fadeIn: 1.2 }, 1.4);
        S.accent(7);
        // the moment the music lands, the dark floods the whole page and the type turns over with it
        S.later(1300, () => {
          const OUT = 'cubic-bezier(.23,1,.32,1)';
          S.q('#jar-dark').animate([{ transform: 'scaleX(1)' }, { transform: `scaleX(${1920 / 1180})` }], { duration: 700, easing: OUT, fill: 'forwards' });
          S.el.dataset.theme = 'red';
          S.el.classList.add('rage');
          const flash = mk('div', 'jar-flash gen');
          S.el.appendChild(flash);
          flash.animate([{ opacity: 0 }, { opacity: 0.95, offset: 0.08 }, { opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' });
          S.el.animate([{ translate: '0 0' }, { translate: '-14px 9px' }, { translate: '11px -7px' }, { translate: '-6px 4px' }, { translate: '0 0' }], { duration: 420, easing: 'linear' });
          S.state.tear(S.state.strips.length, 90);
          S.state.release(); S.later(180, S.state.release); S.later(420, S.state.release);
          S.state.evilAt = performance.now();
        });
        S.later(3500, () => S.eng.pluck(1046.5, { gain: 0.1, decay: 5, verb: 0.8, type: 'sine' }));
        S.q('#jar-open').innerHTML = t('희망 — <span class="it">elpis</span>');
        song.innerHTML = `<b>Rage of the Gods</b> · ${t('3악장 · 항아리가 열렸다')}`;
        song.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'none' }], { duration: 700, easing: 'cubic-bezier(.23,1,.32,1)' });
      };
      S.q('#jar-open').onclick = S.state.open;
      S.eng.need('fp-rage');
    },
    frame(S) {
      // Hope has run out and nobody opened it: it opens itself
      if (!S.state.opened && S.t > 3 && S.eng.bedKey === 'fp-hope' && S.eng.bed && S.eng.bed.ended) S.state.open();
      // every hit of the drums tears a few bands of the picture
      if (S.state.jar && S.state.jar.kickHit) {
        S.state.tear(2 + ((Math.random() * 3) | 0), 46);
        // and now and then another name gets out
        if (performance.now() - S.state.evilAt > 1700) { S.state.evilAt = performance.now(); S.state.release(); }
      }
    },
    leave(S) { S.el.dataset.theme = 'paper'; S.el.classList.remove('rage'); },
    key(S, e) { if (e.key === 'o' || e.key === 'O') { S.state.open(); return true; } },
  },

  'fp-lessons': { steps: 1, gain: 0.4, enter: (S) => { S.add(new Arch(S.q('#cv-arch'), { lit: () => S.el.dataset.step === '1' })); S.add(new Flock(S.q('#cv-flock'), { birds: BIRDS, sheet: asset('assets/collage/birds.webp') })); }, notes: 'Floating Points한테 배운 게 세 가지예요. 같은 걸 오래 반복해도 된다는 것, 머리로 따지되 마지막엔 몸으로 들으라는 것. 그리고 제일 중요한 두 번째, 장르는 섞어도 된다는 거요. 클래식이랑 실험적인 전자음악을 섞은 제 곡 Прокофьев가 여기서 나왔어요. (넘기면 두 번째만 남고, 3부의 Прокофьев로 이어져요.)' },

  inter1: {
    gain: 0.9,
    notes: '(말하지 않습니다. 10초쯤.) 1부의 새가 2부로 넘어가요. 새가 두 번 울고, 음악이 Alon Mor로 바뀌면서 같은 울음이 여섯 배 느리게 다시 들려요. Floating Points의 Falling to Earth가 Alon Mor의 Echoes Follow로 바뀝니다.',
    enter(S) {
      const el = S.el, bird = S.q('#i1-bird'), a = S.q('#i1-a'), b = S.q('#i1-b'), ink = S.q('#i1-ink'), echo = S.q('#i1-echo');
      const OUT = 'cubic-bezier(.23,1,.32,1)', SOFT = 'cubic-bezier(.45,.05,.25,1)';
      el.style.transition = 'color 3s, background-color 1.5s';
      echo.innerHTML = '';
      // the bird surfaces out of the paper and drifts very slowly toward us
      bird.animate([{ opacity: 0, transform: 'scale(.96)', filter: 'blur(16px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' }], { duration: 1800, easing: OUT, fill: 'forwards' });
      bird.animate([{ translate: '0 0', scale: '1' }, { translate: '0 -16px', scale: '1.035' }], { duration: 12000, easing: SOFT, fill: 'forwards' });
      S.later(700, () => a.animate([{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(8px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }], { duration: 1400, easing: OUT, fill: 'forwards' }));
      // it sings, twice
      S.later(1300, () => birdCall(S.eng, 1, 0.05));
      S.later(2400, () => birdCall(S.eng, 1, 0.045));
      S.later(3800, () => {
        S.eng.setBed({ id: 'am-echoes', gain: 0.75 }, 5);
        // the night spreads out of the bird like ink; the page's own colours follow
        el.style.background = 'var(--paper)';
        el.dataset.theme = 'night';
        ink.style.maskImage = ink.style.webkitMaskImage = inkMask();
        ink.animate([{ maskSize: '0px 0px', webkitMaskSize: '0px 0px' }, { maskSize: '4400px 4400px', webkitMaskSize: '4400px 4400px' }], { duration: 4200, easing: SOFT, fill: 'forwards' });
        S.later(4300, () => (el.style.background = ''));
        a.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(8px)' }], { duration: 1400, easing: SOFT, fill: 'forwards' });
        bird.animate([{ filter: 'grayscale(0) brightness(1)' }, { filter: 'grayscale(1) brightness(.45)' }], { duration: 5000, easing: SOFT, fill: 'forwards' });
        // and it is slowed down: the same call six times slower, almost a voice, while echoes of the bird peel away into the dark
        S.later(500, () => birdCall(S.eng, 6, 0.08));
        // each echo leaves from exactly where the bird is now (drift and colour included) and rises out of it from nothing
        for (let k = 0; k < 5; k++) S.later(250 + k * 360, () => {
          const cs = getComputedStyle(bird), [tx = '0px', ty = '0px'] = cs.translate === 'none' ? [] : cs.translate.split(' ');
          const sc = parseFloat(cs.scale) || 1, f0 = cs.filter === 'none' ? 'grayscale(0) brightness(1)' : cs.filter;
          const g = bird.cloneNode(true);
          g.removeAttribute('id');
          g.style.filter = '';
          echo.appendChild(g);
          g.animate([
            { opacity: 0, translate: `${tx} ${ty}`, scale: `${sc}`, filter: `${f0} blur(0px)` },
            { opacity: 0.34 - k * 0.04, offset: 0.22 },
            { opacity: 0, translate: `calc(${tx} - ${140 + k * 80}px) calc(${ty} + ${12 + k * 8}px)`, scale: `${sc * (1.05 + k * 0.05)}`, filter: 'grayscale(1) brightness(.6) blur(7px)' },
          ], { duration: 4200 + k * 350, easing: SOFT, fill: 'forwards' });
        });
      });
      // the second line takes the first one's place, so the eye never has to move
      S.later(6200, () => b.animate([{ opacity: 0, filter: 'blur(10px)', transform: 'translateY(8px)' }, { opacity: 1, filter: 'blur(0px)', transform: 'none' }], { duration: 1800, easing: OUT, fill: 'forwards' }));
    },
    leave(S) {
      S.el.dataset.theme = 'paper';
      S.el.style.transition = '';
      S.el.style.background = '';
      S.q('#i1-echo').innerHTML = '';
      const ink = S.q('#i1-ink');
      ink.style.maskImage = ink.style.webkitMaskImage = '';   // back to the empty mask: the page starts as paper
    },
  },

  'am-hero': { gain: 0.7, notes: '두 번째 사람, Alon Mor예요. 이스라엘에서 태어나서 지금은 베를린에 살아요. 작곡도 하고 사운드 디자인도 하고요. 오케스트라에 베이스 음악, 글리치, 생활 소음 같은 소리까지 한 곡에 다 넣어요. 지금 나오는 게 Echoes Follow예요.' },

  'am-who': { gain: 0.7, notes: '(잠깐 쉬고) 이 사람은 인터뷰를 한 번도 안 했어요. 그래서 저는 음악으로만 이 사람을 알게 됐어요. 홈페이지에 본인이 쓴 짧은 글이 하나 있긴 해요.' },

  'am-story': {
    gain: 0.55,
    notes: '어릴 때 그는 빙글빙글 돌면서 입으로 효과음을 냈대요. 어른들은 그걸 폭발이라고 불렀고요. 스무 살 돼서도 폭발 만들 거냐고 물었더니 그렇다고 했대요. 그리고 그가 쓴 문장이 이거예요. “나는 폭발을 멈춘 적이 없다. 다른 건, 이제 모두가 그것을 들을 수 있다는 것.”',
    enter(S) {
      S.state.blast = S.add(new Blast(S.q('#cv-blast'), { x: 1500, y: 320 }));
      S.state.h = S.q('h2.echo');
    },
    // the word itself goes off with the music: it swells with the low end, and each hard hit jolts it and throws its
    // echoes wide
    frame(S, A, t) {
      const b = S.state.blast, h = S.state.h;
      if (!b || !h) return;
      const k = b.hit, sc = 1 + b.bass * 0.05 + k * 0.09, j = k > 0.15 ? k * 14 : 0;
      h.style.scale = sc.toFixed(4);
      h.style.translate = `${((Math.random() - 0.5) * j).toFixed(1)}px ${((Math.random() - 0.5) * j * 0.6).toFixed(1)}px`;
      h.style.color = k > 0.55 ? '#EDE4D6' : '';
      (h.ghosts || []).forEach((g, i) => (g.style.scale = (sc * (1 + k * 0.05 * (i + 1))).toFixed(4)));
    },
    leave(S) {
      const h = S.state.h;
      if (h) { h.style.scale = ''; h.style.translate = ''; h.style.color = ''; (h.ghosts || []).forEach((g) => (g.style.scale = '')); }
    },
  },

  'am-worlds': {
    ownAudio: true,
    warm: AM_WORLDS.map((w) => `assets/covers/${w.cover}.jpg`),
    notes: '이 사람은 앨범마다 상상 속 나라를 하나씩 만들어요. 첫 앨범 제목부터 지어낸 땅으로 탈출하는 이야기였어요. 행성을 누르면 그 앨범을 들을 수 있어요. 그리고 이 앨범들, 전부 무료예요.',
    enter(S) {
      S.eng.setBed({ id: 'am-echoes', gain: 0.55 }, 1.5);
      // the previews are only needed on a click: decode them once the page has settled, one at a time
      AM_WORLDS.forEach((w, k) => S.later(2600 + k * 220, () => S.eng.need(w.preview)));
      const labels = mk('div', 'full gen', 'pointer-events:none');
      S.el.appendChild(labels);
      const card = S.q('#world-card');
      card.style.opacity = 0;
      S.add(new Worlds(S.q('#cv-worlds'), {
        items: AM_WORLDS, labels,
        onSelect: (i) => {
          if (i < 0) { card.style.opacity = 0; S.eng.setBed({ id: 'am-echoes', gain: 0.55 }, 1.2); return; }
          const w = AM_WORLDS[i];
          S.q('#wc-img').src = asset(`assets/covers/${w.cover}.jpg`);
          S.q('#wc-meta').textContent = `${w.year} · ${PREVIEWS[w.preview].title}`;
          S.q('#wc-title').textContent = w.title;
          S.q('#wc-text').textContent = t(w.text);
          card.style.opacity = 1;
          S.eng.setBed({ id: w.preview, gain: 0.8 }, 1.2);
          S.accent();
        },
      }));
    },
    leave(S) { S.q('#world-card').style.opacity = 0; },
  },

  'am-within': { gain: 0.6, notes: '2024년 앨범 Within은 가사를 백 년 전 히브리 시인 비알리크의 시에서 가져왔어요. 사진 속 비알리크는 1920년에 베를린에 있었고요. 백 년 뒤에 같은 도시에 사는 작곡가가 그 시로 노래를 만든 거죠.' },

  'am-ill': {
    ownAudio: true,
    notes: '요즘은 2027년에 나올 호러 게임 ILL 음악을 만들고 있어요. 리게티, 슈톡하우젠, 셰페르 같은 20세기 작곡가들을 참고한대요. 새소리를 느리게 하면 어떻게 되는지 직접 해 볼게요. (슬라이더를 천천히 오른쪽으로) 사람이 신음하는 것처럼 들리죠. 1부에 나온 꿈속의 새가 여기서 합창이 돼요.',
    enter(S) {
      S.eng.setBed(null, 1.2);
      S.add(new Spectrogram(S.q('#cv-bird')));
      const sl = S.q('#bird-range'), out = S.q('#bird-speed');
      sl.value = 0; S.state.v = 0; out.textContent = '1×';
      sl.oninput = () => { S.state.v = +sl.value; const s = Math.pow(2, S.state.v * 4); out.textContent = s < 1.05 ? '1×' : `1/${s < 10 ? s.toFixed(1) : Math.round(s)}×`; };
      const phrase = () => {
        const v = S.state.v, s = Math.pow(2, v * 4);
        let t = S.eng.now + 0.05;
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const f0 = 2600 + Math.random() * 3200, f1 = f0 * (0.6 + Math.random() * 0.9), d = 0.05 + Math.random() * 0.09;
          for (let k = 0; k < (v > 0.55 ? 3 : 1); k++) {
            S.eng.chirp((f0 / s) * (1 + k * 0.012), (f1 / s) * (1 - k * 0.01), d * s, { when: t + k * 0.03 * s, gain: 0.07 + v * 0.05, verb: 0.1 + v * 0.85, pan: (Math.random() - 0.5) * (0.4 + v), type: v > 0.7 ? 'triangle' : 'sine', mid: (f0 * 1.15) / s });
          }
          t += (d + 0.03 + Math.random() * 0.06) * s;
        }
        S.later((t - S.eng.now) * 1000 + (300 + Math.random() * 700) * Math.pow(s, 0.6), phrase);
      };
      S.later(700, phrase);
    },
  },

  'am-whale': {
    gain: 0.85,
    notes: 'ILL 사운드트랙에서 먼저 나온 Whale Song이에요. 정체를 모르는 거대한 생물이 태어나서 죽을 때까지를 그린 곡이에요. 곡에서 세게 치는 순간마다 가운데서 한 번씩 터지고, 그 빛이 퍼져 나가다가 연기로 흩어져요. 반짝이는 먼지는 고음이에요. 이 곡은 멜로디보다 저음이 이야기를 끌고 가요.',
    // the track always starts from its first impact, when the page appears
    ownAudio: true,
    enter(S) {
      S.eng.setBed({ id: 'am-whale', gain: 0.85, offset: 0, restart: true, fadeIn: 0.05 }, 0.6);
      S.add(new Leviathan(S.q('#cv-whale'), { impacts: WHALE_IMPACTS }));
    },
  },

  'am-free': { gain: 0.5, notes: '제가 이 사람을 제일 좋아하는 이유가 이거예요. 자기 음악을 전부 무료로 올려 놨어요. 덕분에 저는 처음부터 끝까지 마음대로 들으면서 공부할 수 있었어요. 그러면서 음악은 누구나 들을 수 있어야 한다고 생각하게 됐고요. 아까 그가 쓴 문장, 이제 모두가 그것을 들을 수 있다는 말이랑 같은 얘기예요.' },

  'am-lessons': { gain: 0.45, notes: 'Alon Mor한테 배운 것도 세 가지예요. 곡보다 그 곡이 사는 세계를 먼저 정할 것. 아무 소리나 악기로 쓸 수 있다는 것. 그리고 감정은 저음으로도 낼 수 있다는 것.' },

  inter2: {
    gain: 0.85,
    notes: '(말하지 않습니다. 소리가 사라지고 빨간 점이 뜰 때까지 기다리세요.)',
    enter(S) {
      S.later(6000, () => S.eng.setBed(null, 7));
      S.later(13000, () => {
        S.q('#i2-dot').style.opacity = 1;
        S.q('#i2-dot').style.transform = 'scale(1)';
        S.q('#i2-b').style.opacity = 1;
        S.q('#i2-b').style.filter = 'none';
        S.eng.pluck(261.6, { gain: 0.09, decay: 6, verb: 0.9, type: 'sine' });
      });
    },
    leave(S) {
      S.q('#i2-dot').style.opacity = 0; S.q('#i2-dot').style.transform = 'scale(.3)';
      S.q('#i2-b').style.opacity = 0; S.q('#i2-b').style.filter = 'blur(10px)';
    },
  },

  'me-totem': (() => {
    const b = myTrack('totem', 'totem', (S, buf) => {
      const sec = MINE.totem.sections, roman = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ'];
      const markers = MINE.totem.markers.length ? MINE.totem.markers : sec ? sec.slice(1).map((at, i) => ({ t: at, label: roman[i + 1] })) : S.eng.autoMarkers('totem');
      S.add(new Scrub(S.q('#cv-totem-scrub'), { peaks: S.eng.getPeaks('totem', 700), duration: buf.duration, markers, getPos: () => S.eng.bedPos('totem'), onSeek: (t) => b.seek(S, t) }));
    });
    const enter = b.enter, key = b.key;
    b.enter = function (S) {
      enter.call(b, S);
      S.state.tower = S.add(new Totem(S.q('#cv-totem')));
      S.state.flags = S.add(new Picado(S.q('#cv-picado'), { x0: 600 }));
      S.state.sec = -1;
      S.state.clave = false;
      const btn = S.q('#totem-clave');
      btn.classList.remove('on');
      S.state.toggleClave = () => { S.state.clave = !S.state.clave; btn.classList.toggle('on', S.state.clave); };
      btn.onclick = S.state.toggleClave;
      S.eng.need('totem').then((buf) => {
        if (!buf || !S.alive) return;
        const A = S.eng.analyze('totem');
        S.add(new Clave(S.q('#cv-clave'), {
          bpm: MINE.totem.bpm || A.bpm, phase: MINE.totem.bpm ? 0 : A.phase,
          getPos: () => S.eng.bedPos('totem'), playing: () => S.eng.bedKey === 'totem',
          sound: () => S.state.clave, onHit: (dt) => woodblock(S.eng, dt),
        }));
      });
    };
    b.key = function (S, e) {
      if (e.key === 'c' || e.key === 'C') { S.state.toggleClave(); return true; }
      return key.call(b, S, e);
    };
    const frame = b.frame;
    b.frame = function (S, A, t, dt) {
      frame.call(b, S, A, t, dt);
      const pos = S.eng.bedPos('totem'), sec = MINE.totem.sections;
      let i = 0;
      sec.forEach((at, k) => { if (pos >= at) i = k; });
      if (i === S.state.sec) return;
      const first = S.state.sec < 0;
      S.state.sec = i;
      S.state.tower.setSection(i, first);
      if (first) return;
      S.state.flags.gust(i === sec.length - 1 ? 0.4 : 1);
      S.q('.flash').animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: 650, easing: 'cubic-bezier(.23,1,.32,1)' });
    };
    b.notes = '제 곡 Totem이에요. Alon Mor처럼 무거운 전자음을 깔고 라틴 음악을 섞었어요. 위에 걸린 건 멕시코 종이 장식 파펠 피카도고요, 왼쪽 아래 점들은 라틴 음악 기본 리듬인 클라베 3-2예요. C를 누르면 클라베 소리가 곡에 맞춰 같이 나와요. 오른쪽 탑은 곡의 순간순간을 고리로 만들어 쌓은 거예요. 곡의 구간이 바뀔 때마다 카메라, 색, 고리 모양이 한꺼번에 바뀌어서, 다 쌓인 탑을 보면 곡의 구조가 층으로 남아요.';
    return b;
  })(),

  'me-114514': (() => {
    const b = myTrack('114514', 'spiral', (S, buf) => {
      const given = MINE['114514'].bpm, bpm = given || S.eng.analyze('114514').bpm;
      S.q('#spiral-meta').textContent = `${MINE['114514'].meta} · ${given ? `${given} BPM` : t('약 {bpm} BPM (자동 추정)').replace('{bpm}', Math.round(bpm))}`;
      const sp = S.add(new Spiral(S.q('#cv-spiral'), { peaks: S.eng.getPeaks('114514', 2400), duration: buf.duration, revolution: (MINE['114514'].bpm ? 48 : 32) * 60 / bpm, getPos: () => S.eng.bedPos('114514'), onSeek: (at) => b.seek(S, at) }));
      S.state.sp = sp;
      // where the song is as it is HEARD: the position less the time the sound still takes to reach the speakers
      const heard = (S.state.heard = () => S.eng.bedPos('114514') - (S.eng.ctx.outputLatency || S.eng.ctx.baseLatency || 0));
      // what of the track sounded since the last frame (js/pro-events.js), handed to the hall before it is drawn so
      // its light lands on the same frame as the sound; the page's own beat-driven moves read it after
      S.state.pump = (t) => {
        const P = MINE['114514'], pos = heard(), last = S.state.lastPos ?? pos;
        S.state.lastPos = pos;
        const fresh = S.eng.bedKey === '114514' && pos > last && pos - last < 0.25 && pos < P.drain;
        const ev = (S.state.ev = { fresh, hits: fresh ? between(PRO_EVENTS.beat, last, pos) : [], clicks: fresh ? between(PRO_EVENTS.click, last, pos) : [], notes: fresh ? between(PRO_EVENTS.note, last, pos) : [] });
        const mon = S.state.mon;
        if (!mon) return;
        ev.hits.forEach(([, s]) => mon.hit('beat', s, 0, t));
        ev.clicks.forEach(([, s]) => mon.hit('click', s, 0, t));
        ev.notes.forEach(([, s, m]) => mon.hit('note', s, m, t));
      };
      // the monument hall: a clock, busts and gas masks (scans), all on the beat
      S.state.mon = S.add(new Monument(S.q('#cv-monument'), {
        state: () => ({ phase: S.state.st || 's0', a: (S.eng.bedPos('114514') / sp.rev) * Math.PI * 2 - Math.PI / 2, T: S.state.T || 0, tick: S.state.tick, kicks: S.state.kicks, kickHit: S.state.kickHit }),
        onTick: () => S.eng.noiseHit({ f0: 4200, f1: 2600, dur: 0.03, attack: 0.001, gain: 0.08 }),
        // under the wall it is only seen through holes; after 3:58 not at all
        hidden: () => (S.el.classList.contains('hush') ? 2 : S.state.wall && S.state.wall.covered ? 1 : 0),
        pre: (t) => S.state.pump(t),
      }));
      // the string quartet as engraved, along the bottom (the spectrum where the electronics play), until the silence
      S.state.stave = S.add(new Stave(S.q('#cv-stave'), { pos: heard, ev: PRO_EVENTS, score: PRO_SCORE, bars: PRO_BARS, sheet: asset('assets/collage/pro-bars.webp'), spectrum: asset('assets/collage/pro-spectrum.webp'), show: () => (S.state.st || 's0')[0] === 's' }));
      // after 3:41 the monsters grow over everything
      S.state.wall = S.add(new Wall(S.q('#cv-wall'), { state: () => ({ phase: S.state.st || 's0', pos: S.eng.bedPos('114514') }), twist: MINE['114514'].twist, fall: MINE['114514'].twist2, beat: 60 / bpm }));
    });
    b.models = true;
    b.warm = COLLAGE;
    const enter = b.enter, frame = b.frame;
    b.enter = function (S) {
      enter.call(b, S);
      // the red page lands with one low bell
      // the 115 pages for Stalin jump with the music; in the silences they lie flat and only page 116 is left standing
      S.add(new Page116(S.q('#cv-116'), {
        delay: 1.6, onLand: () => S.eng.pluck(98, { gain: 0.11, decay: 3.5, verb: 0.7, type: 'triangle' }),
        level: () => { const st = S.state.st || 's0'; return st === 'drain' || st === 'end' ? -1 : st[0] === 't' ? 1 : +st.slice(1) >= 2 ? S.state.T * (0.5 + S.eng.bands.sLow) : 0; },
      }));
      this.censorPrep(S);
      S.state.st = null;
      S.state.tick = 0;
      S.state.T = 0;
      S.state.kicks = 0;
      const title = S.q('.soviet .line-mask > span');
      S.state.title = title;
      S.state.titleText = title ? title.textContent : '';
    };
    b.frame = function (S, A, t, dt) {
      frame.call(b, S, A, t, dt);
      const sp = S.state.sp, mon = S.state.mon;
      if (!sp || !mon) return;
      const P = MINE['114514'], pos = S.eng.bedPos('114514'), playing = S.eng.bedKey === '114514';
      let st;
      if (S.eng.bedKey === '114514' && S.eng.bed && S.eng.bed.ended) st = 'end';
      else if (pos >= P.twist2) st = 'twist2';
      else if (pos >= P.twist) st = 'twist';
      else if (pos >= P.drain) st = 'drain';
      else { let i = 0; P.sections.forEach((at, k) => { if (pos >= at) i = k; }); st = 's' + i; }
      if (st !== S.state.st) { const prev = S.state.st; S.state.st = st; this.look(S, sp, st, prev); }
      // before the silence the beats are known (js/pro-events.js, read out this frame by the hall): the page moves
      // exactly with them; after it, by ear
      const ev = S.state.ev || { hits: [], clicks: [] }, hits = ev.hits, clicks = ev.clicks;
      S.state.ev = null;
      const kick = pos < P.drain ? hits.length > 0 : playing && A.bands.kick === 1 && t - (S.state.lastKick || 0) > 0.15;
      const hard = hits.length ? Math.min(1, Math.max(...hits.map((h) => h[1])) / 25) : 0.5;
      if (kick) S.state.lastKick = t;
      S.state.kickHit = kick;
      if (kick && st !== 'drain') S.state.kicks++;
      const title = S.q('.soviet');
      if (st[0] === 's') {
        // tension: nothing at the start, everything by 3:38
        const T = Math.pow(Math.max(0, Math.min(1, (pos - 20) / (P.drain - 20))), 1.35), i = +st.slice(1);
        S.state.T = T;
        sp.warp = i >= 2 ? 0.04 + 0.55 * T * T : 0;
        S.q('.tension').style.opacity = (0.08 + T * 0.62) * (0.8 + A.bands.sLow * 0.4);
        // monuments come down on the beat, more and more of them; from the fourth part they put on gas masks
        if (kick && i >= 1 && t - (S.state.lastStamp || 0) > 1.2 - T * 0.9 && Math.random() < 0.35 + T * 0.6) { S.state.lastStamp = t; this.slam(S, [0, 1, 2, 3, 5][i]); }
        if (kick && i >= 3) mon.maskUp(1 + Math.floor(T * 3), t);
        // now and then the light fails for a moment, and when it comes back some of them are looking at you
        if (kick && i >= 3 && Math.random() < 0.04 + T * 0.12) mon.blink(t, i >= 4 ? 2 + Math.floor(T * 4) : 1 + Math.floor(Math.random() * 2));
        // and the censor works through the text, a word a beat
        if (kick && i >= 2 && Math.random() < 0.25 + T * 0.7) this.censor(S, 1 + Math.floor(T * 3));
        // the clicks black out words, one at a time
        if (clicks.length && i >= 1 && t - (S.state.lastCensor || 0) > 0.22 - T * 0.12) { S.state.lastCensor = t; this.censor(S, 1, true); }
        if (kick && T > 0.25) this.shake(S, 2 + T * 9, 80);
        // the frame leans in on the beat, harder as the pressure builds
        if (kick) S.el.animate([{ scale: 1 + 0.006 + hard * 0.01 + T * 0.03 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
        if (kick && T > 0.6 && Math.random() < T * 0.45) this.glitch(S, T);
        title.style.translate = T > 0.45 ? `${(Math.random() - 0.5) * T * 4}px ${(Math.random() - 0.5) * T * 3}px` : '';
      } else if (st === 'drain' || st === 'end') {
        title.style.translate = '';
        if (st === 'drain') this.melt(S, pos - P.drain);
      } else if (kick && st === 'twist') {
        const k = ++S.state.tick;
        S.q('#cv-spiral').style.rotate = `${-k * 11.25}deg`;       // the spiral ticks backwards like a broken clock
        S.q('.wedge').style.rotate = `${k * 22.5}deg`;            // the wedge sweeps round like its hand
        this.scramble(S);
        if (Math.random() < 0.5) this.slam(S, 1);
        // after the turn the bars come and go: the text leaks through and is blacked out again
        S.el.querySelectorAll('.rd').forEach((w) => w.classList.toggle('on', Math.random() < (st === 'twist2' ? 0.7 : 0.92)));
        // every bar the camera snaps to a new tilt
        if (k % 4 === 0) S.el.style.rotate = `${(k % 8 ? -1 : 1) * (1.4 + Math.random() * 2.2)}deg`;
        if (st === 'twist2') { this.slam(S, 2); S.el.classList.add('flick'); S.later(70, () => S.el.classList.remove('flick')); }
        this.shake(S, 7, 90);
      }
    };
    // n monuments come down out of the dark (the hall runs on the global clock); each landing is a stone thud
    b.slam = function (S, n) {
      // each landing is heard when that one lands: stone on stone, never the same twice
      S.state.mon.drop(n, performance.now() / 1000).slice(0, 4).forEach((at) => S.later(at * 1000, () => {
        S.eng.thump({ gain: 0.1 + Math.random() * 0.12, f0: 80 + Math.random() * 40, f1: 40 + Math.random() * 14, decay: 0.18 + Math.random() * 0.2 });
        S.eng.noiseHit({ f0: 700 + Math.random() * 500, f1: 220, dur: 0.06, attack: 0.002, gain: 0.04 + Math.random() * 0.04 });
      }));
    };
    b.shake = function (S, amp, ms) {
      S.el.style.translate = `${(Math.random() - 0.5) * amp}px ${(Math.random() - 0.5) * amp * 0.7}px`;
      S.later(ms, () => (S.el.style.translate = ''));
    };
    // a split-second tear: the title and the spiral jump sideways
    b.glitch = function (S, T) {
      const d = (Math.random() < 0.5 ? -1 : 1) * (10 + T * 26);
      S.q('.soviet').style.translate = `${d}px 0`;
      S.q('#cv-spiral').style.translate = `${-d * 0.6}px ${d * 0.2}px`;
      S.q('.tension').style.opacity = 0.95;
      S.later(70, () => { S.q('#cv-spiral').style.translate = ''; });
    };
    // what each part of the song looks like
    b.LOOKS = [
      { wedge: 0, disc: false, rot: 0, play: C.me },
      { wedge: -16, disc: false, rot: 0, play: C.me },
      { wedge: -16, disc: true, rot: 0, play: '#EFECE6' },
      { wedge: 24, disc: true, rot: -10, play: C.ember },
      { wedge: 8, disc: true, rot: 6, play: C.me },
    ];
    // the venom reaches the text before it covers it: the letters run down in streaks and go the colour of blood
    b.MELT = '.soviet, .soviet + .cap, #spiral-meta, #spiral-text, #spiral-1953, #cv-116';
    b.melt = function (S, at) {
      const k = Math.max(0, Math.min(1, (at - 0.55) / 1.5)), e = k * k;
      const els = S.el.querySelectorAll(this.MELT);
      if (!k) { if (S.state.melting) this.unmelt(S); return; }
      if (!S.state.melting) { S.state.melting = true; els.forEach((x) => (x.style.filter = 'url(#venom-melt)')); }
      S.q('#venom-melt feDisplacementMap').setAttribute('scale', (e * 190).toFixed(1));
      S.q('#venom-melt .tint').setAttribute('values', `1 0 0 0 0  0 ${(1 - 0.8 * k).toFixed(3)} 0 0 0  0 0 ${(1 - 0.75 * k).toFixed(3)} 0 0  0 0 0 ${(1 - 0.35 * e).toFixed(3)} 0`);
    };
    b.unmelt = function (S) {
      S.state.melting = false;
      S.el.querySelectorAll(this.MELT).forEach((x) => (x.style.filter = ''));
    };
    b.look = function (S, sp, st, prev) {
      const el = S.el, wedge = S.q('.wedge'), cv = S.q('#cv-spiral');
      el.classList.remove('draining', 'flick');
      if (st !== 'drain' && S.state.melting) this.unmelt(S);
      // 3:58: the music falls away and everything with it, at once. Nothing is left but the dark (and, for a
      // moment, the wall's last frame burnt in); it stays that way to the end
      const hush = st === 'twist2' || (st === 'end' && el.classList.contains('hush'));
      el.classList.toggle('hush', hush);
      if (hush) { el.classList.remove('absurd', 'disc-on'); el.style.rotate = ''; el.style.translate = ''; S.q('.tension').style.opacity = 0; return; }
      if (st[0] === 's') {
        el.classList.remove('absurd');
        sp.mode = 'normal'; sp.dim = 1;
        const L = this.LOOKS[+st.slice(1)];
        wedge.style.rotate = `${L.wedge}deg`;
        cv.style.rotate = `${L.rot}deg`;
        el.classList.toggle('disc-on', L.disc);
        sp.playColor = L.play;
        this.unscramble(S);
        if (prev && prev[0] !== 's') S.state.mon.reset();
        el.style.rotate = '';
        this.censorTo(S, [0, 0, 0.12, 0.4, 0.75][+st.slice(1)]);
        // each part of the song starts with the hall at least this full: the missing ones come down at once
        const want = [0, 6, 26, 64, 110][+st.slice(1)], have = S.state.mon.standing;
        if (want > have) S.later(60, () => this.slam(S, want - have));
        const wantM = [0, 0, 0, 10, 40][+st.slice(1)] - S.state.mon.masked;
        if (wantM > 0) S.later(700, () => S.state.mon.maskUp(wantM, performance.now() / 1000));
        if (prev) {
          // a new part of the song is a hard cut: one black frame, then the camera pushes in
          S.eng.thump({ gain: 0.22, f0: 70, f1: 40, decay: 0.6 });
          el.animate([{ filter: 'brightness(0)' }, { filter: 'brightness(0)', offset: 0.4 }, { filter: 'brightness(1.6)', offset: 0.55 }, { filter: 'none' }], { duration: 240, easing: 'linear' });
          el.animate([{ scale: 1.09 }, { scale: 1 }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
          this.shake(S, 10, 120);
        }
        return;
      }
      if (st === 'drain' || st === 'end') {
        el.style.rotate = '';
        // everything stops: dark, the stamps fade back, only the clock is left clicking backwards
        el.classList.remove('absurd');
        el.classList.add('draining');
        sp.mode = 'drain'; sp.dim = 0.2; sp.warp = 0;
        S.q('.tension').style.opacity = 0;
        return;
      }
      // 3:41 — the world turns over
      sp.mode = st; sp.warp = 1; sp.playColor = C.me; sp.dim = 1;
      el.classList.remove('disc-on');
      S.q('.tension').style.opacity = 0;
      if (st === 'twist' && prev === 'drain') {
        // white, black, white — then it is the other world
        S.q('.strobe').animate([{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.13 }, { opacity: 0, offset: 0.25 }, { opacity: 1, offset: 0.26 }, { opacity: 1, offset: 0.36 }, { opacity: 0 }], { duration: 520, easing: 'linear' });
        S.later(62, () => el.classList.add('absurd'));
        cv.animate([{ scale: 1.45 }, { scale: 1 }], { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
        S.eng.thump({ gain: 0.7, f0: 64, f1: 28, decay: 1.6 });
        S.eng.noiseHit({ f0: 6000, f1: 120, dur: 1.4, attack: 0.002, gain: 0.22, verb: 0.5 });
        
        for (let i = 0; i < 8; i++) S.later(i * 75, () => this.shake(S, 34 - i * 4, 70));
      } else el.classList.add('absurd');
      this.scramble(S);
    };
    b.scramble = function (S) {
      const el = S.state.title;
      if (!el) return;
      el.innerHTML = [...S.state.titleText].map((ch) => {
        const r = (Math.random() - 0.5) * 70, y = (Math.random() - 0.5) * 30, f = Math.random() < 0.3 ? -1 : 1;
        return `<i class="sl" style="transform:translateY(${y}px) rotate(${r}deg) scaleY(${f})">${ch}</i>`;
      }).join('');
    };
    b.unscramble = function (S) { if (S.state.title && S.state.title.querySelector('.sl')) S.state.title.textContent = S.state.titleText; };
    // Soviet censorship: the left column is cut into words, and black bars go over them on the beat
    b.censorPrep = function (S) {
      S.state.censor = [];
      ['#spiral-text', '#spiral-1953'].forEach((q) => {
        const el = S.q(q);
        if (!el) return;
        S.state.censor.push([el, el.innerHTML]);
        const zh = document.documentElement.lang.startsWith('zh');
        const walk = (node) => [...node.childNodes].forEach((c) => {
          if (c.nodeType === 1) return walk(c);
          if (c.nodeType !== 3 || !c.data.trim()) return;
          const f = document.createDocumentFragment();
          (c.data.match(zh ? /[\s\S]{1,3}/g : /\S+\s*/g) || []).forEach((w) => { const s = document.createElement('span'); s.className = 'rd'; s.textContent = w; f.appendChild(s); });
          c.replaceWith(f);
        });
        walk(el);
      });
    };
    b.censor = function (S, n, quiet) {
      const free = [...S.el.querySelectorAll('.rd:not(.on)')];
      for (let k = 0; k < n && free.length; k++) free.splice(Math.floor(Math.random() * free.length), 1)[0].classList.add('on');
      if (!quiet) S.eng.noiseHit({ f0: 5200, f1: 3000, dur: 0.05, attack: 0.004, gain: 0.025 });
    };
    // a part of the song starts with the text at least this censored (for jumps along the spiral)
    b.censorTo = function (S, frac) {
      const all = S.el.querySelectorAll('.rd'), on = S.el.querySelectorAll('.rd.on').length, want = Math.round(all.length * frac) - on;
      if (want > 0) this.censor(S, want);
    };
    b.leave = function (S) {
      if (S.state.melting) this.unmelt(S);
      (S.state.censor || []).forEach(([el, html]) => (el.innerHTML = html));
      S.el.classList.remove('draining', 'absurd', 'flick', 'disc-on', 'hush');
      S.el.style.translate = '';
      S.el.style.rotate = '';
      S.q('.wedge').style.rotate = '';
      ['#cv-spiral', '.soviet'].forEach((q) => { S.q(q).style.rotate = ''; S.q(q).style.translate = ''; });
      S.q('.tension').style.opacity = 0;
      this.unscramble(S);
    };
    b.notes = '두 번째 곡 Прокофьев, 러시아 작곡가 프로코피예프 이름이에요. Floating Points가 오케스트라랑 전자음을 한 곡에 넣은 것처럼, 저는 클래식이랑 실험적인 전자음악을 섞어 봤어요. 좀 황당한 얘기가 하나 있는데, 프로코피예프는 1953년 3월 5일, 스탈린이랑 같은 날 죽었어요. 소련 음악 잡지가 그의 부고를 116쪽에 실었는데, 앞의 115쪽이 전부 스탈린이었어요. 아래 오선은 이 곡의 현악 4중주 악보예요. 음표가 빨간 선을 지나는 순간 그 소리가 나고, 현악이 쉬고 전자음만 나오는 구간에서는 그 자리에 스펙트럼이 흘러가요. 높은 클릭마다 홀에 하얀 섬광이 터지고, 피아노 음마다 조명이 건반처럼 왼쪽 오른쪽으로 움직여요. 곡이 갈수록 똑같은 기념비 흉상이 박자마다 떨어져서 지평선까지 줄을 서요. 시계는 점점 녹아내리고, 흉상들은 방독면을 쓰고, 왼쪽 글은 검열당한 것처럼 한 단어씩 까맣게 지워져요. 흉상들 사이에 서 있는 사람은 1918년의 프로코피예프 본인이에요. 계속 이쪽을 보고 있어요. 3분 38초에 소리가 빠지면 시계 뒤에서 검은 독이 번져 나와 홀을 삼키고, 왼쪽 글자까지 녹여 버려요. 시계만 거꾸로 째깍거리고요. 3분 41초에 곡이 뒤집히는 순간, 보스, 브뤼헐, 고야, 달리 같은 화가들의 기괴한 그림 백여 장이 한 번에 화면을 덮어요. 박자마다 화면이 새로 조각나고, 조각들은 세포처럼 갈라지고, 그림은 1초에도 몇 번씩 깨지면서 바뀌어요. 그리고 3분 58초, 소리가 꺼지는 순간 전부 한꺼번에 사라져요. 눈에 남은 잔상만 잠깐 보이다가, 끝까지 아무것도 없어요. 끝까지 들려주세요. (나선 바깥쪽 끝 부분을 누르면 바로 갈 수 있어요.)';
    return b;
  })(),

};
