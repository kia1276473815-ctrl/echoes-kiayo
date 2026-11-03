import { Engine, measure } from './audio.js';
import { setRenderScale } from './viz.js';
import { set3DScale, warmImages, warmModels } from './scenes3d.js';
import { SLIDES } from './slides.js';
import { MINE, PREVIEWS, previewSrc, BED_LEVEL } from './config.js';
import { Medium } from './medium.js';
import { collect, setLang, getLang, t, notesFor } from './i18n.js';

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const slides = [...document.querySelectorAll('.slide')];
const N = slides.length;
const IO = 'cubic-bezier(.77,0,.175,1)', SOFT = 'cubic-bezier(.45,.05,.25,1)';

const eng = new Engine();
Object.keys(PREVIEWS).forEach((k) => eng.register(k, previewSrc(k)));
Object.entries(MINE).forEach(([k, v]) => eng.register(k, v.src));
// the presenter link: a BroadcastChannel (deck served from its folder) plus direct messages to the
// presenter window this deck opened, which is the only route in the packaged single file
const bc = 'BroadcastChannel' in window ? new BroadcastChannel('echoes-deck') : null;
let pw = null;
const chan = { postMessage(m) { if (bc) bc.postMessage(m); if (pw && !pw.closed) pw.postMessage(m, '*'); } };

let idx = -1, cur = null, busy = false, scale = 1, started = false, tStart = 0;
const jump = parseInt(new URLSearchParams(location.search).get('s'), 10);

// ---------------------------------------------------------------- text prep
// running headers name the side of the record
slides.forEach((el) => el.querySelectorAll('.run').forEach((r) => (r.textContent = r.textContent.replace(/^III — /, 'Side C — ').replace(/^II — /, 'Side B — ').replace(/^I — /, 'Side A — '))));
collect(slides);

// interaction hints: bigger, with a beating dot so they read from the back of the room
document.querySelectorAll('p.cap').forEach((p) => {
  if (/(누르|드래그|돌려 보세요|그려 보세요|클릭)/.test(p.textContent) && p.textContent.length < 90 && !p.closest('.meet-song')) p.classList.add('hint');
});
document.querySelectorAll('[data-d]').forEach((el) => el.style.setProperty('--d', el.dataset.d));

const splitLines = (el) => {
  el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((p, i) => `<span class="line-mask"><span style="--i:${i}">${p}</span></span>`).join('');
};
// echo: each marked headline gets decaying delay taps behind it
const echoes = (el) => {
  (el.ghosts || []).forEach((g) => g.remove());
  const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
  const short = el.textContent.replace(/\s/g, '').length <= 3;   // one tap is enough on a two-letter word
  el.ghosts = (short ? [0.2] : [0.26, 0.12, 0.05]).map((op, k) => {
    const g = el.cloneNode(true);
    g.classList.remove('echo');
    g.classList.add('echo-ghost');
    g.removeAttribute('id');
    g.setAttribute('aria-hidden', 'true');
    g.style.opacity = op;
    g.style.translate = `${(k + 1) * 22}px 0`;
    g.base = { op, x: (k + 1) * 22 };
    g.style.setProperty('--d', d + (k + 1) * 170);
    el.parentNode.insertBefore(g, el);
    return g;
  });
};
const prepText = (els) => {
  els.forEach((el) => el.dataset.r === 'line' && splitLines(el));
  els.forEach((el) => el.classList.contains('echo') && echoes(el));
};
if (getLang() === 'zh') setLang('zh');
prepText([...document.querySelectorAll('[data-r="line"], .echo')]);

// the deck as a double LP: Side A / B / C, every slide a track
const sideOf = (el) => el.dataset.side;
const titleOf = (el) => {
  if (el.dataset.title) return t(el.dataset.title);
  const h = el.querySelector('h1:not(.echo-ghost), h2:not(.echo-ghost)');
  if (!h) return el.dataset.id;
  const lines = [...h.querySelectorAll('.line-mask')].map((x) => x.textContent.trim());
  return (lines.length ? lines.join(' ') : h.textContent).replace(/\s+/g, ' ').trim();
};
const tracks = {};
slides.forEach((el) => {
  const sd = sideOf(el);
  if (!sd || el.dataset.divider) return;
  (tracks[sd] = tracks[sd] || []).push(el);
  el.dataset.track = sd + tracks[sd].length;
});
slides.forEach((el, i) => {
  if (i < 2) return;
  const f = document.createElement('p');
  f.className = 'folio';
  f.innerHTML = `${el.dataset.track ? `<span class="it">${el.dataset.track}</span>` : ''}${String(i - 1).padStart(2, '0')} / ${N - 2}`;
  el.appendChild(f);
});
// Act I's pages as a star chart (css .fog): built here so every page has its own: the rays from a different point,
// the orbit at its own tilt, the page's track code where the orbit passes
slides.forEach((el, i) => {
  if (el.dataset.theme !== 'paper') return;
  const rnd = (k) => { const x = Math.sin((i + 1) * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const F = [[1520, 300], [420, 820], [980, 520], [1660, 860], [300, 240], [1240, 160], [760, 900], [1500, 640], [200, 600]][i % 9];
  let rays = '';
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2 + rnd(k) * 0.05, r0 = 140 + rnd(k + 9) * 160;
    const dash = [120 + rnd(k + 2) * 500, 40 + rnd(k + 3) * 140, 60 + rnd(k + 4) * 300, 30 + rnd(k + 5) * 100].map(Math.round).join(' ');
    rays += `<line x1="${(Math.cos(a) * r0).toFixed(1)}" y1="${(Math.sin(a) * r0).toFixed(1)}" x2="${(Math.cos(a) * 1400).toFixed(1)}" y2="${(Math.sin(a) * 1400).toFixed(1)}" stroke-dasharray="${dash}"/>`;
  }
  let grid = '';
  for (let x = 72; x < 1920; x += 120) for (let y = 66; y < 1080; y += 120) grid += `M${x - 5} ${y}h10M${x} ${y - 5}v10`;
  const ocx = 400 + rnd(20) * 1100, ocy = 300 + rnd(21) * 500, rx = 780 + rnd(22) * 380, ry = 300 + rnd(23) * 240, tilt = -28 + rnd(24) * 56;
  const da = rnd(25) * Math.PI * 2, dx = Math.cos(da) * rx, dy = Math.sin(da) * ry;
  const code = el.dataset.track || 'A';
  const bars = Array.from({ length: 22 }, (_, k) => `<rect x="${k * 7}" y="0" width="${rnd(30 + k) < 0.3 ? 3 : 1.4}" height="22"/>`).join('');
  const bx = 1600, by = 62;
  el.insertAdjacentHTML('afterbegin', `<div class="fog" aria-hidden="true">
    <div class="fog-rays" style="left:${F[0] - 1400}px;top:${F[1] - 1400}px"><svg width="2800" height="2800" viewBox="-1400 -1400 2800 2800"><g stroke="#F4F4F6" stroke-width="1.6" opacity=".7">${rays}</g></svg></div>
    <svg width="1920" height="1080" viewBox="0 0 1920 1080"><path d="${grid}" stroke="#55565B" stroke-width="1" opacity=".45"/><g transform="translate(${bx} ${by})" fill="#2B2C30" opacity=".7">${bars}</g></svg>
    <div class="fog-orbit" style="transform-origin:${ocx}px ${ocy}px"><svg width="1920" height="1080" viewBox="0 0 1920 1080"><g transform="rotate(${tilt.toFixed(1)} ${ocx.toFixed(0)} ${ocy.toFixed(0)})" fill="none" stroke="#141418"><ellipse cx="${ocx.toFixed(0)}" cy="${ocy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${ry.toFixed(0)}" stroke-width="1.3" opacity=".75"/><ellipse cx="${ocx.toFixed(0)}" cy="${ocy.toFixed(0)}" rx="${(rx * 0.62).toFixed(0)}" ry="${(ry * 1.35).toFixed(0)}" stroke-width=".8" opacity=".35"/><circle cx="${(ocx + dx).toFixed(0)}" cy="${(ocy + dy).toFixed(0)}" r="9" fill="#141418" stroke="none"/></g></svg></div>
    <span class="fog-mark" style="left:${Math.min(1760, Math.max(160, F[0] + 120)).toFixed(0)}px;top:${Math.min(960, Math.max(130, F[1] - 120)).toFixed(0)}px">${code}</span>
    <span class="fog-mono" style="left:${bx}px;top:${by + 34}px">SIDE A · 33⅓ RPM
TRACK ${code}
FLOATING POINTS</span>
  </div>`);
});
document.querySelectorAll('.record').forEach((r) => r.insertAdjacentHTML('beforeend', '<div class="tonearm"><i class="base"></i><div class="arm"><i class="cw"></i><i class="head"></i></div></div>'));
const buildTracklists = () => slides.forEach((el) => {
  const ol = el.querySelector('.tracklist');
  if (ol) ol.innerHTML = (tracks[sideOf(el)] || []).map((s) => `<li><i>${s.dataset.track}</i><span>${titleOf(s)}</span></li>`).join('');
});
buildTracklists();

// ---------------------------------------------------------------- scaling
function fit() {
  scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${scale}) translate(-50%, -50%)`;
  const rs = Math.min(2, scale * (devicePixelRatio || 1));
  setRenderScale(rs);
  set3DScale(rs);
  medium.fit(rs);
  if (cur) cur.comps.forEach((c) => c.fit && c.fit());
}
addEventListener('resize', fit);
const rectOf = (el) => {
  const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / scale, top: (r.top - s.top) / scale, width: r.width / scale, height: r.height / scale };
};

// ---------------------------------------------------------------- slide lifecycle
function makeS(el) {
  const S = {
    el, eng, comps: [], timers: [], state: {}, t0: performance.now(), alive: true,
    q: (s) => el.querySelector(s),
    add(c) { S.comps.push(c); return c; },
    later(ms, fn) { const id = setTimeout(fn, ms); S.timers.push(id); return id; },
    every(ms, fn) { const id = setInterval(fn, ms); S.timers.push(id); return id; },
    toStage(e) { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; },
    get t() { return (performance.now() - S.t0) / 1000; },
    // an event inside the page (a record chosen, a jar opened) lifts the music for a few bars
    accent(hold = 4) { if (LISTEN.has(el.dataset.id)) return; eng.swell(1.5, 0.4); eng.settle(1, eng.nextBar(hold), 2, -3); },
  };
  return S;
}

function bedFor(el, B) {
  if (B.ownAudio) return undefined;
  if (B.bed !== undefined) return B.bed;
  if (el.dataset.bed === undefined) return undefined;
  return el.dataset.bed ? { id: el.dataset.bed, gain: B.gain ?? (+el.dataset.gain || BED_LEVEL) } : null;
}

// ---------------------------------------------------------------- musical dynamics
// Each page's existing bed level is its speaking level. A transition lifts the music about 5 dB so the
// page arrives on a high, then it settles back on a bar line before the talking starts, with a small
// dip around 2.4 kHz where the voice sits. Listening pages shape their own sound and are left alone.
const LISTEN = new Set(['gate', 'cold', 'inter1', 'inter2', 'coda']);
const HOLD = 1.0;
// a preview entering (or one heading into a quiet passage) is cued so a loud bar lands on the reveal
function cue(bed, lead) {
  if (bed && bed.id && PREVIEWS[bed.id] && bed.offset === undefined && !bed.keepPos) {
    if (bed.id !== eng.bedKey || !eng.bed || eng.quietAhead(bed.id, eng.bed.position() + lead)) {
      const t = eng.entry(bed.id, lead);
      if (t != null) bed = { ...bed, offset: t - lead, restart: true, fadeIn: lead + 0.15 };
    }
  }
  eng.setBed(bed, lead + 0.4);
}
function lift(el, bed, sec) {
  if (LISTEN.has(el.dataset.id)) { eng.swell(1, sec); return; }
  eng.swell(Math.min(1.8, 0.95 / ((bed && bed.gain) || 0.6)), sec);   // never past full level
}
function settle(el, after) {
  if (!LISTEN.has(el.dataset.id)) eng.settle(1, eng.nextBar(after), Math.min(3.2, Math.max(1.6, eng.barLen())), -3);
}

// o.noBed: the bed already started (a J-cut, or a language reprint); o.bedT0: when it started
function activate(i, o = {}) {
  const el = slides[i], B = SLIDES[el.dataset.id] || {};
  el.classList.add('on');
  cur = makeS(el);
  cur.B = B;
  cur.step = 0;
  el.dataset.step = 0;
  cur.toStep = (k) => stepTo(cur, k);
  cur.bedT0 = o.bedT0 ?? performance.now();
  if (B.enter) { try { B.enter(cur); } catch (e) { console.error('enter', el.dataset.id, e); } }
  // coming back to a page with steps finds it at its last one, already in place
  if (o.dir < 0 && B.steps && !B.oneWay) {
    el.classList.add('snap');
    stepTo(cur, B.steps);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('snap')));
  }
  const bed = bedFor(el, B);
  if (started && !o.noBed && bed !== undefined) eng.setBed(bed, B.bedFade ?? 1.8);
  void el.offsetWidth;
  el.classList.add('in');
  // warm the next few beds so they start without a gap
  for (let j = i + 1; j < Math.min(N, i + 4); j++) {
    const nb = bedFor(slides[j], SLIDES[slides[j].dataset.id] || {});
    if (nb && nb.id) eng.need(nb.id).then((b) => b && eng.analyze(nb.id));
  }
  // and decode the next page's pictures now, so its first frame doesn't wait on them
  if (slides[i + 1]) {
    slides[i + 1].querySelectorAll('img').forEach((im) => im.decode && im.decode().catch(() => {}));
    const nB = SLIDES[slides[i + 1].dataset.id];
    if (nB && nB.warm) warmImages(nB.warm);
    if (nB && nB.models) warmModels();
  }
  broadcast();
}

function deactivate(S) {
  if (!S) return;
  S.alive = false;
  S.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  S.comps.forEach((c) => c.destroy && c.destroy());
  if (S.B.leave) S.B.leave(S);
  echoRest(S.el);
  S.el.querySelectorAll('.gen').forEach((n) => n.remove());
  S.el.classList.remove('on', 'in');
  S.el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
}

// ---------------------------------------------------------------- transitions
function morphs(from, to) {
  const jobs = [];
  to.querySelectorAll('[data-morph]').forEach((t) => {
    const s = from.querySelector(`[data-morph="${t.dataset.morph}"]`);
    if (!s) return;
    const sr = rectOf(s), tr = rectOf(t);
    const clone = t.cloneNode(true);
    clone.style.position = 'absolute';
    if (clone.tagName === 'IMG') clone.style.objectFit = 'contain';
    clone.removeAttribute('data-r');
    Object.assign(clone.style, { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', opacity: 1, clipPath: 'none' });
    const simg = s.tagName === 'IMG' ? s : s.querySelector('img'), cimg = clone.tagName === 'IMG' ? clone : clone.querySelector('img');
    if (simg && cimg && clone !== cimg) {
      cimg.style.animation = 'none';
      const f0 = getComputedStyle(simg).filter, f1 = getComputedStyle(t.querySelector('img') || t).filter;
      cimg.animate([{ filter: f0 === 'none' ? 'grayscale(0)' : f0 }, { filter: f1 === 'none' ? 'grayscale(0)' : f1 }], { duration: 1500, easing: SOFT, fill: 'both' });
      cimg.style.objectPosition = getComputedStyle(t.querySelector('img') || t).objectPosition;
    }
    clone.querySelectorAll('figcaption').forEach((f) => f.remove());
    // a framed photo becoming a cut-out figure: the photo dissolves where it stands while the figure
    // lifts out of it, grey first, colour arriving on the way
    if (t.hasAttribute('data-cutout')) {
      const ghost = s.cloneNode(true);
      ghost.removeAttribute('data-r');
      ghost.querySelectorAll('figcaption').forEach((f) => f.remove());
      Object.assign(ghost.style, { position: 'absolute', left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', opacity: 1, clipPath: 'none', transform: 'none', willChange: 'opacity, transform' });
      $('#morph').appendChild(ghost);
      const f1 = getComputedStyle(t).filter;
      ghost.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.035)' }], { duration: 1000, easing: SOFT, fill: 'forwards' });
      // the figure sits at its own place and size from the start; a transform carries it there from the photo.
      // data-anchor = the face in the photo and in the cut-out (fractions of each box), so it lifts out face over face
      const [fx0, fy0, fx1, fy1] = (t.dataset.anchor || '.5 .5 .5 .5').split(' ').map(Number);
      const k = sr.height / tr.height, dx = sr.left + sr.width * fx0 - (tr.left + tr.width * fx1 * k), dy = sr.top + sr.height * fy0 - (tr.top + tr.height * fy1 * k);
      Object.assign(clone.style, { left: tr.left + 'px', top: tr.top + 'px', width: tr.width + 'px', height: tr.height + 'px', transformOrigin: '0 0', willChange: 'transform, opacity, filter' });
      // its cut edge is softened while it is in the air, and firms up as it lands
      Object.assign(clone.style, { maskImage: 'linear-gradient(#000 62%, transparent 100%)', webkitMaskImage: 'linear-gradient(#000 62%, transparent 100%)', maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat' });
      clone.animate([{ maskSize: '100% 100%', webkitMaskSize: '100% 100%' }, { maskSize: '100% 100%', webkitMaskSize: '100% 100%', offset: 0.45 }, { maskSize: '100% 300%', webkitMaskSize: '100% 300%' }], { duration: 1400, easing: SOFT, fill: 'forwards' });
      clone.animate([{ opacity: 0, filter: 'grayscale(1)' }, { opacity: 1, filter: 'grayscale(1)', offset: 0.3 }, { opacity: 1, filter: f1 === 'none' ? 'grayscale(0)' : f1 }], { duration: 1400, easing: SOFT, fill: 'forwards' });
      clone.style.overflow = 'visible';
      $('#morph').appendChild(clone);
      t.style.visibility = 'hidden';
      s.style.visibility = 'hidden';
      const anim = clone.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: 'none' }], { duration: 1400, easing: IO, fill: 'forwards' });
      jobs.push(new Promise((r) => setTimeout(r, 1050)).then(() => ghost.remove()));
      jobs.push(anim.finished.then(() => handoff(t, s, clone)));
      return;
    }
    // and back: the cut-out figure travels with the frame and melts into it while the photo develops around it
    if (s.hasAttribute('data-cutout')) {
      const ghost = s.cloneNode(true);
      ghost.removeAttribute('data-r');
      Object.assign(ghost.style, { position: 'absolute', objectFit: 'contain', objectPosition: '50% 100%', opacity: 1, clipPath: 'none', transform: 'none', animation: 'none', zIndex: 2 });
      $('#morph').appendChild(ghost);
      ghost.animate([
        { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', opacity: 1, filter: 'blur(0px)' },
        { opacity: 1, filter: 'blur(0px)', offset: 0.35 },
        { left: tr.left + 'px', top: tr.top + 'px', width: tr.width + 'px', height: tr.height + 'px', opacity: 0, filter: 'blur(10px)' },
      ], { duration: 1400, easing: IO, fill: 'forwards' });
      clone.animate([{ opacity: 0, filter: 'blur(14px) grayscale(1)' }, { opacity: 0.5, filter: 'blur(6px) grayscale(1)', offset: 0.45 }, { opacity: 1, filter: 'blur(0px) grayscale(0)' }], { duration: 1500, easing: SOFT, fill: 'forwards' });
      jobs.push(new Promise((r) => setTimeout(r, 1450)).then(() => ghost.remove()));
    }
    $('#morph').appendChild(clone);
    t.style.visibility = 'hidden';
    s.style.visibility = 'hidden';
    const r0 = getComputedStyle(s).borderRadius, r1 = getComputedStyle(t).borderRadius;
    clone.style.overflow = 'hidden';
    const round = (r, box) => (r.endsWith('%') ? (parseFloat(r) / 100) * Math.min(box.width, box.height) + 'px' : r);
    // a spinning record label starts the morph at its current angle and settles upright
    const angle = (el) => { const m = getComputedStyle(el).transform; if (!m || m === 'none') return 0; const v = m.match(/-?[\d.e]+/g).map(Number); return Math.atan2(v[1], v[0]); };
    const a0 = s.classList.contains('label') ? angle(s) : 0, a1 = t.classList.contains('label') ? angle(t) : 0;
    const anim = clone.animate([
      { left: sr.left + 'px', top: sr.top + 'px', width: sr.width + 'px', height: sr.height + 'px', borderRadius: round(r0, sr), transform: `rotate(${a0}rad)` },
      { left: tr.left + 'px', top: tr.top + 'px', width: tr.width + 'px', height: tr.height + 'px', borderRadius: round(r1, tr), transform: `rotate(${a1}rad)` },
    ], { duration: 1400, easing: IO, fill: 'forwards' });
    jobs.push(anim.finished.then(() => handoff(t, s, clone)));
  });
  return jobs;
}
// the real element takes over from its flying copy already fully revealed: its own entrance (if it has one and it is
// still waiting or running) is skipped, so it never vanishes and fades in a second time
function handoff(t, s, clone) {
  t.getAnimations().forEach((a) => { if (a.playState !== 'finished' && isFinite(a.effect.getComputedTiming().endTime)) a.finish(); });   // never the endless ones (a spinning label)
  t.style.visibility = '';
  s.style.visibility = '';
  clone.remove();
}

// every side of the record has its own medium (js/medium.js); a boundary belongs to the later page
const THEME = {
  paper: { bg: '#C6C6C8', ink: '#0F0F11', edge: '#2F55D8' },
  night: { bg: '#0E0C0A', ink: '#EDE4D6', edge: '#C8924A' },
  black: { bg: '#060606', ink: '#F2EFEA', edge: '#E5482F' },
};
const TIMING = { phase: [820, 1050], signal: [700, 1100], ink: [780, 1250], inter: [820, 1150], groove: [1050, 1400] };
const centre = (el) => { const r = rectOf(el); return [(r.left + r.width / 2) / 1920, 1 - (r.top + r.height / 2) / 1080]; };
// ink blooms out of the next page's subject: its largest picture or canvas
function subjectOf(el) {
  let best = null, area = 0;
  el.querySelectorAll('.ph, canvas').forEach((c) => { const r = rectOf(c), a = r.width * r.height; if (a > area) { area = a; best = c; } });
  return best ? centre(best) : [0.5, 0.5];
}
function mediumFor(from, to, dir) {
  const hi = dir > 0 ? to : from;
  if (hi.dataset.in === 'cut') return null;
  const mode = hi.dataset.divider ? 'groove' : hi.dataset.in === 'phase' ? 'phase' : { A: 'signal', B: 'ink', C: 'inter' }[hi.dataset.side] || 'phase';
  const th = THEME[to.dataset.theme] || THEME.black;
  const S = { mode, dir, bg: th.bg, ink: th.ink, edge: mode === 'phase' ? th.ink : th.edge, cover: TIMING[mode][0], uncover: TIMING[mode][1] };
  if (mode === 'ink') S.origin = subjectOf(to);
  if (mode === 'groove') S.origin = centre(hi.querySelector('.record') || hi);
  if (mode === 'inter') {
    const j = () => (Math.random() - 0.5) * 0.14;
    S.s1 = [0.26 + j(), 0.68 + j()];
    S.s2 = [0.76 + j(), 0.3 + j()];
    if (dir < 0) [S.s1, S.s2] = [S.s2, S.s1];
  }
  return S;
}

async function go(i, dir = 1) {
  if (busy || i < 0 || i >= N || i === idx) return;
  busy = true;
  const from = idx >= 0 ? slides[idx] : null, to = slides[i], prevS = cur;
  idx = i;
  const swap = (o) => { try { deactivate(prevS); } catch (e) { console.error('leave', e); } activate(i, { ...o, dir }); };
  try {
    const S = from && mediumFor(from, to, dir);
    if (!S) swap();
    else {
      // the next page's sound arrives before its picture, like a J-cut in film
      const B = SLIDES[to.dataset.id] || {}, bed = bedFor(to, B), bedT0 = performance.now(), lead = S.cover / 1000;
      if (started && bed !== undefined) cue(bed, lead);
      if (started) lift(to, bed, lead);
      const jobs = (dir > 0 ? to : from).dataset.in === 'morph' ? morphs(from, to) : [];
      await medium.run(S, () => { swap({ noBed: true, bedT0 }); if (started) settle(to, S.uncover / 1000 + HOLD); });
      await Promise.all(jobs);
    }
  } catch (e) {
    console.error(e);
  } finally {
    busy = false;
  }
}

// switching language reprints the current page through the medium
async function relang() {
  if (busy || idx < 0) return;
  busy = true;
  const next = getLang() === 'zh' ? 'ko' : 'zh';
  langUI(next);
  const th = THEME[slides[idx].dataset.theme] || THEME.black;
  try {
    await medium.run({ mode: 'phase', dir: 1, bg: th.bg, ink: th.ink, edge: th.ink, cover: 520, uncover: 900 }, () => {
      prepText(setLang(next));
      dispatchEvent(new Event('deck-lang'));
      buildTracklists();
      npKey = null;
      gateMsg();
      deactivate(cur);
      activate(idx, { noBed: true });
    });
  } finally {
    busy = false;
  }
}
// a page can have more than one layout: 'next' first moves it on to its next step, and only then turns the page
function stepTo(S, k) {
  S.step = k;
  S.el.dataset.step = k;
  if (S.B.step) { try { S.B.step(S, k); } catch (e) { console.error('step', e); } }
}
const next = () => {
  if (!busy && cur && cur.step < (cur.B.steps || 0)) return stepTo(cur, cur.step + 1);
  go(idx + 1, 1);
};
const prev = () => {
  if (!busy && cur && cur.step > 0 && !cur.B.oneWay) return stepTo(cur, cur.step - 1);
  go(idx - 1, -1);
};

// ---------------------------------------------------------------- loading + gate
const GATE = { done: 0, n: 5 };
let loaded = false;
const gateMsg = () => { $('#gate-status').textContent = loaded && GATE.failed ? `${t('음악을 불러오지 못함')} (${GATE.failed} / ${GATE.n}) · ${t('Chrome으로 열어 주세요')}` : ''; };
async function loadAll() {
  const jobs = ['totem', '114514', 'sub', 'fp-promises-m1', 'fp-silhouettes'];
  // count what failed to decode, so a silent deck says so on the gate instead of starting mute
  let failed = 0;
  await Promise.all(jobs.map((k) => eng.need(k).then((b) => { if (!b) failed++; GATE.done++; })));
  GATE.failed = failed;
  // the stamps are drawn on a canvas: their face has to be ready before the first one comes down
  await Promise.all(['900 40px CyrBlack', '400 20px ZhSans', '300 40px ZhSerif'].map((f) => document.fonts.load(f, 'ПР中').catch(() => {})));
  await document.fonts.ready;
  // warm the Chinese faces so switching language does not wait for them
  ['300 40px ZhSerif', '400 20px ZhSans'].forEach((f) => document.fonts.load(f, '中').catch(() => {}));
  loaded = true;
  document.body.dataset.ready = '1';
  gateMsg();
  if (wanted) start();
}
// a tap before everything has loaded is remembered, and the deck starts the moment it is ready
let wanted = false;
async function start() {
  if (started) return;
  if (!loaded) { wanted = true; return; }
  started = true;
  // phones: go full screen and stay sideways where the browser allows it
  if (touch) {
    // never wait on these: some browsers leave the promise pending
    const fs = document.documentElement.requestFullscreen;
    if (fs) fs.call(document.documentElement).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  }
  await eng.resume();
  tStart = performance.now();
  go(jump > 0 && jump < N ? jump : 1, 1);
}
slides[0].addEventListener('click', start);
// every tap, click or key also wakes the audio if the browser has suspended it (phones especially)
['pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (eng.ctx.state !== 'running') eng.ctx.resume(); }, true));

// ---------------------------------------------------------------- input
addEventListener('keydown', (e) => {
  if (e.repeat) { if (e.key === ' ') e.preventDefault(); return; }
  if (!started) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); } if (e.key === 'l' || e.key === 'L') relang(); return; }
  if (cur && cur.B.key && cur.B.key(cur, e)) { e.preventDefault(); return; }
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
    case 'ArrowLeft': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
    case 'Home': go(1, -1); break;
    case 'End': go(N - 1, 1); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'm': case 'M': eng.toggleBedMute(); break;
    // let the music speak for a moment, then bring it back under the voice
    case 'ArrowUp': e.preventDefault(); eng.swell(1.6, 1.2); break;
    case 'ArrowDown': e.preventDefault(); eng.settle(1, eng.ctx.currentTime, 1.6, -3); break;
    case 'p': case 'P': openPresenter(); break;
    case 'l': case 'L': relang(); break;
    case '.': blackout(); break;
    case 'h': case 'H': projector(); break;
  }
});
// presenter tools: blackout (.) fades picture and sound; projector mode (H) lifts small grey text
let dark = false;
function blackout() {
  dark = !dark;
  document.body.classList.toggle('black', dark);
  const g = eng.master.gain, c = eng.ctx, now = c.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(dark ? 0 : 0.92, now + 1.2);
  broadcast();
}
let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 1400);
}
function projector() {
  const on = document.body.classList.toggle('proj');
  try { localStorage.setItem('echoes-proj', on ? '1' : ''); } catch (e) { /* storage blocked */ }
  toast(t(on ? '투영 모드 켜짐' : '투영 모드 꺼짐'));
}
try { if (localStorage.getItem('echoes-proj')) document.body.classList.add('proj'); } catch (e) { /* storage blocked */ }

let idleT;
document.body.classList.add('idle');
// ---------------------------------------------------------------- touch: swipe, or the edge buttons
const touch = matchMedia('(pointer: coarse)').matches;
if (touch) {
  document.body.classList.add('touch');
}
document.querySelectorAll('#navtouch button').forEach((b) => {
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {   // a click (not pointerdown) is a gesture that may start sound
    e.stopPropagation();
    if (!started) { start(); return; }
    +b.dataset.d > 0 ? next() : prev();
  });
});
let sw = null;
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') sw = { x: e.clientX, y: e.clientY, t: performance.now(), el: e.target }; });
addEventListener('pointerup', (e) => {
  if (!sw || e.pointerType !== 'touch' || !started) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, el = sw.el, quick = performance.now() - sw.t < 450;
  sw = null;
  // buttons, sliders and the like keep their taps
  if (el.closest && el.closest('input, button, .btn, .meet-song, .sleeve, #lang, #fs')) return;
  const edge = e.clientX < innerWidth * 0.2 ? -1 : e.clientX > innerWidth * 0.8 ? 1 : 0;
  const drags = el.tagName === 'CANVAS' && /grab|pointer/.test(el.style.cursor);   // rotatable 3D, the spiral
  if (Math.hypot(dx, dy) < 14 && quick) {
    // a tap: the left fifth goes back; anywhere else goes on, except the middle of something you can drag
    if (edge < 0) prev();
    else if (edge > 0 || !drags) next();
    return;
  }
  if (!drags && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) dx < 0 ? next() : prev();
});

addEventListener('pointerdown', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => document.body.classList.add('idle'), 3500);
});
addEventListener('pointermove', () => {
  document.body.classList.remove('idle');
  clearTimeout(idleT);
  idleT = setTimeout(() => document.body.classList.add('idle'), 2600);
});

// ---------------------------------------------------------------- presenter link
const HINTS = {
  'fp-albums': '1–6 또는 커버 클릭 — 앨범 전환', 'fp-score': '악장 막대 클릭 — 설명', 'fp-mortals': 'O — 항아리 열기',
  'am-worlds': '행성 클릭 — 확대·재생 / 빈 곳 클릭 — 전체로', 'am-ill': '슬라이더를 천천히 오른쪽으로',
  'side-c': '드래그 — 회전 · 1 / 2 또는 곡 클릭 — 그 곡 듣기', 'me-totem': 'K — 재생/정지 · 파형 클릭 — 이동', 'me-114514': 'K — 재생/정지',
  coda: '끝난 뒤 Space — 마지막 소리 다시',
};
function broadcast() {
  if (!chan || idx < 0) return;
  const el = slides[idx], nx = slides[idx + 1];
  const info = (s) => ({ track: s.dataset.track || (s.dataset.divider ? 'Side ' + s.dataset.side : ''), name: titleOf(s).slice(0, 48), side: s.dataset.side || '' });
  chan.postMessage({
    type: 'state', i: idx, n: N, ...info(el), theme: el.dataset.theme, hint: t(HINTS[el.dataset.id] || ''), lang: getLang(), dark,
    notes: notesFor(el.dataset.id, (SLIDES[el.dataset.id] || {}).notes || ''), started, tStart: performance.timeOrigin + tStart, tSlide: Date.now(),
    next: nx ? info(nx) : null,
  });
}
function openPresenter() {
  if (globalThis.__PRESENTER_HTML) {
    pw = window.open('', 'echoes-presenter', 'width=1100,height=760');
    if (!pw) return;
    pw.document.open();
    pw.document.write(globalThis.__PRESENTER_HTML);
    pw.document.close();
  } else pw = window.open('presenter.html', 'echoes-presenter', 'width=1100,height=760');
}
const onLink = (m) => {
  const d = m.data || {};
  if (d.type === 'hello') broadcast();
  if (d.type === 'cmd') { if (d.cmd === 'next') started ? next() : start(); if (d.cmd === 'prev') prev(); if (d.cmd === 'black') blackout(); }
};
if (bc) bc.onmessage = onLink;
addEventListener('message', (e) => { if (pw && e.source === pw) onLink(e); });

// ---------------------------------------------------------------- now playing: the real waveform of the current bed
const np = $('#np'), npc = $('#np-wave'), npg = npc.getContext('2d');
const NP_HIDE = new Set(['gate', 'cold', 'coda', 'inter2', 'fp-albums', 'am-worlds', 'me-totem', 'me-114514']);   // the album pages show what is playing themselves
let npKey = null;
// the stylesheet can switch the strip off for good; then it is never drawn (reading its colour every frame costs a
// style recalculation)
let npOff = null;
function drawNowPlaying() {
  if (npOff ?? (npOff = getComputedStyle(np).display === 'none')) return;
  const key = eng.bed ? eng.bedKey : null, el = slides[idx];
  const show = key && el && !NP_HIDE.has(el.dataset.id);
  np.classList.toggle('on', !!show);
  if (!show) return;
  np.dataset.theme = el.dataset.theme;
  if (key !== npKey) {
    npKey = key;
    const p = PREVIEWS[key], m = MINE[key];
    $('#np-title').innerHTML = p ? `<b>${p.title}</b> — ${p.album}, ${p.year}` : m ? `<b>${m.title}</b> — ${t('내 곡')}` : '';
  }
  const peaks = eng.getPeaks(key, 60);
  if (!peaks) return;
  const w = npc.width, h = npc.height, pos = eng.bed.position() / eng.bed.duration;
  const col = getComputedStyle(np).color;
  npg.clearRect(0, 0, w, h);
  let mx = 0;
  for (let i = 0; i < 60; i++) mx = Math.max(mx, peaks[i]);
  for (let i = 0; i < 60; i++) {
    const v = Math.max(0.06, peaks[i] / (mx || 1)), x = (i / 60) * w;
    npg.globalAlpha = i / 60 < pos ? 1 : 0.35;
    npg.fillStyle = col;
    npg.fillRect(x, (h - v * h) / 2, w / 60 - 1.5, v * h);
  }
  npg.globalAlpha = 1;
}

// ---------------------------------------------------------------- live echoes
// On the record-side pages the headline's delay taps play along: each tap listens to its own band
// (bass, mids, highs), bass throws its tap further out, loudness thickens them, bright hits shake them.
const liveEcho = (el) => !!el.dataset.divider || el.dataset.id === 'title';
const EQ = { b: [0, 0, 0, 0], lo: [0.4, 0.18, 0.02, 0.03], hi: [0.8, 0.35, 0.16, 0.16], hit: 0, hi8: 0, j: [], jt: 0 };
function echoLive(el, dt, now) {
  const B = eng.bands, k = 1 - Math.exp(-dt * 9);
  // every song sits differently, so each band is read against its own recent floor and peak
  [B.low, B.mid, B.high, B.rms].forEach((x, i) => {
    EQ.lo[i] += (x - EQ.lo[i]) * (x < EQ.lo[i] ? 0.2 : dt * 0.08);
    EQ.hi[i] += (x - EQ.hi[i]) * (x > EQ.hi[i] ? 0.2 : dt * 0.08);
    const v = Math.max(0, Math.min(1, (x - EQ.lo[i]) / Math.max(0.08, EQ.hi[i] - EQ.lo[i])));
    EQ.b[i] += (v - EQ.b[i]) * (v > EQ.b[i] ? 0.5 : k);   // fast attack, slow release
  });
  EQ.body = EQ.b[3];
  const flux = Math.max(0, B.high - EQ.hi8);
  EQ.hi8 = B.high;
  EQ.hit = Math.max(EQ.hit * Math.exp(-dt * 6), Math.min(1, flux * 14 + B.kick * 0.55));
  // the shake moves in steps, like a stuttering delay line, not a vibration
  if (now - EQ.jt > 50) { EQ.jt = now; EQ.j = Array.from({ length: 6 }, () => Math.random() * 2 - 1); }
  el.querySelectorAll('.echo').forEach((h) => (h.ghosts || []).forEach((g, i, all) => {
    if (!g.base) return;
    const v = all.length === 1 ? EQ.body : EQ.b[i % 3], sh = EQ.hit * (i + 1);
    const x = g.base.x + (i + 1) * (v * 26 + EQ.hit * 10) + EQ.j[i * 2] * sh * 4;
    const y = EQ.j[i * 2 + 1] * sh * 2.5;
    g.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    g.style.opacity = Math.min(0.55, g.base.op * (0.6 + EQ.body * 0.8) + v * 0.1 + EQ.hit * 0.05).toFixed(3);
  }));
}
function echoRest(el) {
  el.querySelectorAll('.echo').forEach((h) => (h.ghosts || []).forEach((g) => {
    if (g.base) { g.style.translate = `${g.base.x}px 0`; g.style.opacity = g.base.op; }
  }));
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), lastCue = 0, cueOn = false;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  eng.update();
  drawNowPlaying();
  if (chan && now - lastCue > 400) {
    lastCue = now;
    const id = idx >= 0 ? slides[idx].dataset.id : '';
    const at = id === 'me-114514' ? MINE['114514'].twist - eng.bedPos('114514') : null;
    if (at !== null || cueOn) chan.postMessage({ type: 'cue', at, playing: eng.bedKey === '114514' });
    cueOn = at !== null;
  }
  if (idx >= 0 && langEl.dataset.theme !== slides[idx].dataset.theme) langEl.dataset.theme = slides[idx].dataset.theme;
  langEl.classList.toggle('show', idx === 0);
  fsEl.classList.toggle('show', idx === 0);
  if (idx >= 0 && fsEl.dataset.theme !== slides[idx].dataset.theme) fsEl.dataset.theme = slides[idx].dataset.theme;
  if (cur) {
    for (const c of cur.comps) { try { c.draw(eng, t, dt); } catch (e) { console.error(e); cur.comps.splice(cur.comps.indexOf(c), 1); } }
    // a page that throws must not stop the loop: everything after it would freeze
    if (cur.B.frame) { try { cur.B.frame(cur, eng, t, dt); } catch (e) { console.error('frame', e); } }
    if (started && liveEcho(cur.el)) echoLive(cur.el, dt, now);
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- language toggle: 한 / 中
const langEl = $('#lang');
function langUI(l = getLang()) {
  langEl.dataset.l = l;
  if (idx >= 0) langEl.dataset.theme = slides[idx].dataset.theme;
}
langEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
langEl.querySelectorAll('button').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); if (b.dataset.l !== getLang()) relang(); }));

const fsEl = $('#fs');
const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
fsEl.addEventListener('pointerdown', (e) => e.stopPropagation());
fsEl.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });

const medium = new Medium($('#medium'), eng);
fit();
go(0);
langUI();
loadAll();
requestAnimationFrame(loop);
window.__deck = { eng, medium, mediumFor, go: (i, d) => go(i, d), next: () => next(), prev: () => prev(), get busy() { return busy; }, get idx() { return idx; }, get cur() { return cur; }, slides, start, relang, measure };
