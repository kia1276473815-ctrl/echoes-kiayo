// three.js scenes. Each is created when its slide enters and disposed when it leaves.
import * as THREE from './vendor/three.module.min.js';
import { asset } from './assets.js';

let RS = 1;
export const set3DScale = (s) => { RS = s; };
const loader = new THREE.TextureLoader();
// pictures a coming page will map onto its scene, decoded ahead of time; a texture built from one of these
// is uploaded on the page's very first frame (still under the transition) instead of whenever it finishes loading
const WARM = {};
export const warmImages = (urls) => urls.forEach((u) => {
  if (WARM[u]) return;
  const im = new Image();
  im.src = asset(u);
  WARM[u] = im;
  im.decode().catch(() => {});
});
const tex = (url) => {
  const im = WARM[url];
  let t;
  if (im && im.complete && im.naturalWidth) { t = new THREE.Texture(im); t.needsUpdate = true; }
  else t = loader.load(asset(url));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
const ease = (x) => 1 - Math.pow(1 - x, 3);

class S3 {
  constructor(cv, o = {}) {
    this.cv = cv;
    this.o = o;
    this.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.r.setClearColor(0x000000, 0);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    // asking for each shader's log makes the page wait for the driver to finish compiling it, mid-frame
    this.r.debug.checkShaderErrors = false;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(o.fov || 32, 1, 0.05, 400);
    this.yaw = 0; this.pitch = 0; this.vyaw = 0; this.vpitch = 0;
    this.fit();
    if (o.drag !== false) this.bindDrag();
  }
  fit() {
    this.w = parseFloat(this.cv.style.width) || 1920;
    this.h = parseFloat(this.cv.style.height) || 1080;
    this.r.setPixelRatio(Math.min(2, RS));
    this.r.setSize(this.w, this.h, false);
    this.cam.aspect = this.w / this.h;
    this.cam.updateProjectionMatrix();
  }
  bindDrag() {
    let last = null;
    this.cv.style.cursor = 'grab';
    this.cv.addEventListener('pointerdown', (e) => { last = [e.clientX, e.clientY]; this.dragging = true; this.moved = 0; this.cv.setPointerCapture(e.pointerId); this.cv.style.cursor = 'grabbing'; });
    this.cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.vyaw = dx * 0.006; this.vpitch = dy * 0.004;
      this.yaw += this.vyaw; this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch + this.vpitch));
      last = [e.clientX, e.clientY];
    });
    const up = () => { last = null; this.dragging = false; this.cv.style.cursor = 'grab'; };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', up);
  }
  inertia(dt) {
    if (this.dragging) return;
    this.yaw += this.vyaw; this.vyaw *= Math.pow(0.04, dt);
    this.pitch *= Math.pow(0.4, dt);
  }
  render() { this.r.render(this.scene, this.cam); }
  // hand every material in the scene to the driver now, so nothing stalls the frame where it first comes into view;
  // things that are hidden are shown for the compile only (no frame is drawn in between)
  warm() {
    const hidden = [];
    this.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    try { this.r.compile(this.scene, this.cam); } finally { hidden.forEach((o) => (o.visible = false)); }
  }
  destroy() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { Object.values(m).forEach((v) => v && v.isTexture && v.dispose()); m.dispose(); });
    });
    this.r.dispose();
    this.r.forceContextLoss();
    // a canvas whose context was lost can never get a new one: swap in a fresh canvas for the next visit
    this.cv.replaceWith(this.cv.cloneNode(false));
  }
}

// ------------------------------------------------------------ a record leaving its sleeve (fp-albums)
function grooves(labelColor) {
  const s = 1024, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), m = s / 2;
  g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
  for (let r = m * 0.36; r < m * 0.985; r += 1.6) {
    const v = 14 + Math.random() * 14 + (Math.floor(r / 40) % 5 === 0 ? 0 : 6);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.lineWidth = 1;
    g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.stroke();
  }
  [0.62, 0.8].forEach((u) => { g.strokeStyle = '#050505'; g.lineWidth = 5; g.beginPath(); g.arc(m, m, m * u, 0, Math.PI * 2); g.stroke(); });
  const sheen = g.createConicGradient(0, m, m);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.12, 'rgba(255,255,255,.10)'); sheen.addColorStop(0.24, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(0.62, 'rgba(255,255,255,.08)'); sheen.addColorStop(0.74, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.beginPath(); g.arc(m, m, m * 0.985, 0, Math.PI * 2); g.fill();
  g.fillStyle = labelColor; g.beginPath(); g.arc(m, m, m * 0.34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#EFECE6'; g.beginPath(); g.arc(m, m, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Vinyl extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 28, ...o });
    this.cam.position.set(0.55, 0.2, 6.4);
    this.cam.lookAt(0.55, 0, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 5);
    this.scene.add(key);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const edge = new THREE.MeshStandardMaterial({ color: 0xd9d3c8, roughness: 0.9 });
    this.front = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 });
    this.sleeve = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.035), [edge, edge, edge, edge, this.front, new THREE.MeshStandardMaterial({ color: 0xe7e2d9, roughness: 0.9 })]);
    this.root.add(this.sleeve);
    this.rec = new THREE.Group();
    this.discMat = new THREE.MeshStandardMaterial({ map: grooves('#d8d2c7'), roughness: 0.32, metalness: 0.35 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.97, 160), this.discMat);
    const back = disc.clone(); back.rotation.y = Math.PI;
    this.labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const label = new THREE.Mesh(new THREE.CircleGeometry(0.3, 96), this.labelMat);
    label.position.z = 0.002;
    this.rec.add(disc, back, label);
    this.rec.position.z = -0.03;
    this.root.add(this.rec);
    const sh = document.createElement('canvas'); sh.width = sh.height = 128;
    const sg = sh.getContext('2d'), gr = sg.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    this.shadow.position.set(0.5, -0.15, -0.4);
    this.root.add(this.shadow);
    this.out = 0; this.target = 0; this.spin = 0; this.pending = null;
    this.root.rotation.set(-0.12, -0.32, 0);
  }
  setAlbum(cover) { this.pending = cover; this.target = 0; }
  draw(A, t, dt) {
    if (this.pending && this.out < 0.03) {
      const tx = tex(this.pending);
      this.front.map = tx; this.front.needsUpdate = true;
      this.labelMat.map = tx; this.labelMat.needsUpdate = true;
      this.pending = null; this.target = 1;
    }
    this.out += (this.target - this.out) * Math.min(1, dt * (this.target ? 1.6 : 5));
    const e = ease(this.out);
    this.rec.position.x = e * 1.12;
    this.spin += dt * (0.4 + e * (1.6 + A.bands.sRms * 6));
    this.rec.rotation.z = -this.spin;
    this.inertia(dt);
    this.root.rotation.y = -0.32 + this.yaw + Math.sin(t * 0.3) * 0.04;
    this.root.rotation.x = -0.12 + this.pitch;
    this.render();
  }
}

// ------------------------------------------------------------ Pandora's jar (fp-mortals)
// The canvas covers the whole page so that what leaves the jar can fill it; the camera is offset so the jar
// itself still stands between the picture and the text.
const dot = () => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
};
export class Jar extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 2 * Math.atan(Math.tan((15 * Math.PI) / 180) * (1080 / 960)) * (180 / Math.PI), drag: false, ...o });
    this.cam.setViewOffset(1920, 1080, 70, 0, 1920, 1080);
    this.cam.position.set(0, 0.7, 8.6);
    this.cam.lookAt(0, 0.45, 0);
    this.fov0 = this.cam.fov;
    this.scene.add(new THREE.AmbientLight(0xffe2c8, 0.28));
    this.key = new THREE.DirectionalLight(0xffb27a, 4.2); this.key.position.set(-4, 3, 3); this.scene.add(this.key);
    const rim = new THREE.DirectionalLight(0xff5a3c, 1.6); rim.position.set(4, 1.5, -3); this.scene.add(rim);
    // the fire inside, seen only once the lid is off
    this.mouth = new THREE.PointLight(0xff4a14, 0, 5, 1.6); this.mouth.position.set(0, 1.9, 0); this.scene.add(this.mouth);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    const prof = [[0, -1.25], [0.32, -1.25], [0.46, -1.16], [0.72, -0.82], [0.9, -0.28], [0.9, 0.18], [0.74, 0.62], [0.47, 0.92], [0.33, 1.06], [0.31, 1.18], [0.37, 1.24], [0.37, 1.3], [0.29, 1.3]].map(([x, y]) => new THREE.Vector2(x, y));
    const glaze = new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 0.32, metalness: 0.25, emissive: 0xff2a08, emissiveIntensity: 0 });
    this.glaze = glaze;
    this.body.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 128), glaze));
    const gold = new THREE.MeshStandardMaterial({ color: 0xc89b52, roughness: 0.28, metalness: 0.95 });
    [[0.18, 0.905], [-0.3, 0.9], [0.92, 0.47]].forEach(([y, r]) => {
      const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 12, 160), gold);
      b.rotation.x = Math.PI / 2; b.position.y = y; this.body.add(b);
    });
    // the dark inside of the neck, lit from below when it opens
    const throat = new THREE.Mesh(new THREE.CircleGeometry(0.29, 48), new THREE.MeshBasicMaterial({ color: 0x120402 }));
    throat.rotation.x = -Math.PI / 2; throat.position.y = 1.28; this.body.add(throat);
    this.throat = throat.material;
    this.lid = new THREE.Group();
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.07, 96), new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 0.32, metalness: 0.25 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 16), gold);
    knob.position.y = 0.1;
    const lr = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.01, 10, 120), gold);
    lr.rotation.x = Math.PI / 2;
    this.lid.add(lidM, knob, lr);
    this.lid.position.y = 1.34;
    this.root.add(this.lid);
    // everything that was in the jar: embers, and heavier dark ash the music throws about
    this.dotTex = dot();
    const mkCloud = (n, size, blend) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: this.dotTex, vertexColors: true, transparent: true, blending: blend, depthWrite: false }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      return { g, n, ps: Array.from({ length: n }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 1, max: 1, born: false, seed: 0 })) };
    };
    this.ash = mkCloud(700, 0.24, THREE.NormalBlending);
    this.embers = mkCloud(3200, 0.13, THREE.AdditiveBlending);
    this.hope = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0 }));
    this.hope.position.set(0, 2.25, 0);
    this.root.add(this.hope);
    this.opened = false; this.t0 = 0; this.rage = 0; this.punch = 0; this.shake = 0; this.prevKick = 0;
  }
  open() {
    if (this.opened) return false;
    this.opened = true;
    this.t0 = performance.now();
    return true;
  }
  // a new particle leaves the mouth, flung outward and up into a turning column
  spawn(p, force, ash) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.22;
    p.x = Math.cos(a) * r; p.z = Math.sin(a) * r; p.y = 1.3;
    const s = (ash ? 0.6 : 1) * force * (0.6 + Math.random());
    p.vx = Math.cos(a) * s * (1.2 + Math.random() * 3.2); p.vz = Math.sin(a) * s * (0.8 + Math.random() * 1.6);
    p.vy = (1.2 + Math.random() * 2.6) * s;
    p.life = 0; p.max = ash ? 4 + Math.random() * 3 : 2 + Math.random() * 3.2; p.born = true;
    p.seed = Math.random() * 100;
  }
  cloud(C, dt, A, ash, kickHit) {
    const pos = C.g.attributes.position.array, col = C.g.attributes.color.array;
    // the column turns faster and spills wider while the music is loud
    const swirl = 0.6 + A.bands.sLow * 3, rate = this.rage ? (ash ? 70 : 260) * (0.5 + A.bands.sRms * 4) : 0;
    let quota = rate * dt + (kickHit ? (ash ? 40 : 160) : 0) + (this.burst ? (ash ? 300 : 1200) : 0);
    for (let i = 0; i < C.n; i++) {
      const p = C.ps[i];
      if ((!p.born || p.life > p.max) && quota >= 1) { this.spawn(p, 1 + (this.burst ? 1.4 : 0) + A.bands.kick * 0.8, ash); quota--; }
      let b = 0;
      if (p.born && p.life <= p.max) {
        p.life += dt;
        const ang = Math.atan2(p.z, p.x), rr = Math.hypot(p.x, p.z);
        // turning about the jar's axis, a little lift, wandering, drag
        p.vx += (-Math.sin(ang) * swirl - p.x * 0.05) * dt; p.vz += (Math.cos(ang) * swirl - p.z * 0.05) * dt;
        p.vy += (ash ? -0.35 : 0.12 - rr * 0.02) * dt;
        p.vx += Math.sin(p.seed + p.life * 2.3) * 0.6 * dt; p.vy += Math.cos(p.seed * 1.7 + p.life * 1.9) * 0.4 * dt;
        const k = Math.pow(ash ? 0.6 : 0.82, dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
        if (kickHit) { const s = 1 + Math.random() * 0.8; p.vx *= s; p.vz *= s; p.vy += Math.random() * 0.6; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const u = p.life / p.max;
        b = Math.min(1, p.life * 6) * (1 - u) * (1 - u);
      }
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.born ? p.y : -99; pos[i * 3 + 2] = p.z;
      if (ash) { col[i * 3] = 0.05 + b * 0.12; col[i * 3 + 1] = 0.012; col[i * 3 + 2] = 0.01; }
      else {
        const hot = Math.max(0, 1 - p.life / 0.7);
        col[i * 3] = b; col[i * 3 + 1] = b * (0.28 + hot * 0.55); col[i * 3 + 2] = b * (0.08 + hot * 0.3);
      }
    }
    C.g.attributes.position.needsUpdate = true;
    C.g.attributes.color.needsUpdate = true;
  }
  draw(A, t, dt) {
    const el = this.opened ? (performance.now() - this.t0) / 1000 : 0;
    // the lid is pushed from inside: a tremble first, then it is thrown off as the gods arrive
    const tremble = this.opened && el < 1.3 ? Math.min(1, el / 1.25) : 0;
    const thrown = this.opened ? Math.max(0, el - 1.25) : 0;
    this.lid.visible = thrown < 1.5;
    this.lid.position.set(thrown * 0.9 + (Math.random() - 0.5) * tremble * 0.03, 1.34 + tremble * 0.04 * Math.abs(Math.sin(el * 40)) + thrown * 5.5, -thrown * 0.8);
    this.lid.rotation.set(thrown * 5, 0, -thrown * 7 + (Math.random() - 0.5) * tremble * 0.08);
    this.body.position.x = (Math.random() - 0.5) * tremble * 0.025;
    const was = this.rage;
    this.rage = this.opened && el > 1.3 ? 1 : 0;
    this.burst = this.rage && !was;
    const kick = A.bands.kick, kickHit = this.rage && kick === 1 && this.prevKick < 1;
    this.prevKick = kick;
    this.kickHit = kickHit;
    if (this.burst) { this.punch = 1; this.shake = 1; }
    if (kickHit) { this.punch = Math.max(this.punch, 0.35); this.shake = Math.max(this.shake, 0.4); }
    this.cloud(this.ash, dt, A, true, kickHit);
    this.cloud(this.embers, dt, A, false, kickHit);
    // fire in the neck and on the glaze, breathing with the music
    const fire = this.rage ? 0.6 + A.bands.sLow * 2.5 + this.punch * 2 : tremble * 0.6;
    this.mouth.intensity = fire * 4;
    this.glaze.emissiveIntensity = this.rage ? A.bands.sLow * 0.06 + this.punch * 0.12 : tremble * 0.04;
    this.throat.color.setRGB(0.07 + fire * 0.35, 0.015 + fire * 0.06, 0.008);
    this.key.color.setHex(this.rage ? 0xff8c5c : 0xffb27a);
    // hope, the one thing left behind, shows itself once the storm has gone out
    const ha = this.opened ? Math.max(0, Math.min(1, (el - 6) / 3)) : 0;
    this.hope.material.opacity = ha;
    this.hope.position.y = 2.25 + Math.sin(t * 0.9) * 0.06;
    this.hope.scale.setScalar(1 + A.bands.sRms * 6);
    // the camera takes the hits
    this.punch *= Math.pow(0.02, dt); this.shake *= Math.pow(0.03, dt);
    this.cam.fov = this.fov0 * (1 - this.punch * 0.07);
    this.cam.position.set((Math.random() - 0.5) * this.shake * 0.12, 0.7 + (Math.random() - 0.5) * this.shake * 0.1, 8.6);
    this.cam.lookAt(0, 0.45, 0);
    this.cam.updateProjectionMatrix();
    this.root.rotation.y = t * 0.08;
    this.render();
  }
}

// ------------------------------------------------------------ albums as planets (am-worlds)
export class Worlds extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 34, ...o });
    this.cam.position.set(0, 5.4, 15.5);
    this.cam.lookAt(0, -0.7, 0);
    // the light comes from the system's own sun (it travels with the system), falling off gently so the outer
    // worlds are lit too; a faint cool fill keeps their night sides from going black
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16));
    const fill = new THREE.DirectionalLight(0x8aa0ff, 0.22); fill.position.set(0, 6, 14); this.scene.add(fill);
    this.sys = new THREE.Group();
    this.sys.position.x = 4.9;
    this.scene.add(this.sys);
    this.sun = new THREE.PointLight(0xffd6a0, 9, 0, 1);
    this.sys.add(this.sun);
    const sp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 40;
      sp[i * 3] = Math.sqrt(1 - u * u) * Math.cos(a) * r; sp[i * 3 + 1] = u * r; sp[i * 3 + 2] = Math.sqrt(1 - u * u) * Math.sin(a) * r;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xede4d6, size: 0.12, transparent: true, opacity: 0.55 })));
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff0d8 }));
    this.sys.add(core);
    // and its glow, so it reads as where the light comes from
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d'), grad = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,226,180,1)'); grad.addColorStop(0.18, 'rgba(255,200,140,.55)'); grad.addColorStop(0.5, 'rgba(255,170,100,.12)'); grad.addColorStop(1, 'rgba(255,160,90,0)');
    gg.fillStyle = grad; gg.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(3.2);
    this.sys.add(glow);
    this.planets = o.items.map((it, i) => {
      const r = 2.0 + i * 0.66, inc = (Math.random() - 0.5) * 0.18;
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos((k / 160) * Math.PI * 2) * r, 0, Math.sin((k / 160) * Math.PI * 2) * r))), new THREE.LineBasicMaterial({ color: 0x9c9184, transparent: true, opacity: 0.16 }));
      const pivot = new THREE.Group(); pivot.rotation.x = inc; pivot.add(ring); this.sys.add(pivot);
      // Within's sleeve is almost pure white; tone it down so the planet doesn't burn out under the light
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.44 * it.size, 64, 40), new THREE.MeshStandardMaterial({ map: tex(`assets/covers/${it.cover}.jpg`), color: it.cover === 'am-within' ? 0x8f877c : 0xffffff, roughness: 1, metalness: 0 }));
      pivot.add(m);
      const lab = document.createElement('div');
      lab.className = 'cap gen';
      lab.style.cssText = 'position:absolute;white-space:nowrap;pointer-events:none;color:#9C9184;transition:color .3s';
      lab.innerHTML = `<b style="color:#EDE4D6;font-weight:500">${it.title}</b> ${it.year}`;
      o.labels.appendChild(lab);
      return { mesh: m, pivot, r, a: (i / o.items.length) * Math.PI * 2 + Math.random() * 0.4, speed: 0.22 / Math.sqrt(r), lab, i };
    });
    this.ray = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-9, -9);
    this.hover = -1; this.sel = -1;
    cv.addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); this.mouse.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); });
    cv.addEventListener('pointerleave', () => this.mouse.set(-9, -9));
    cv.addEventListener('pointerup', () => {
      if (this.moved >= 6) return;
      this.sel = this.hover;            // clicking empty space returns to the whole system
      o.onSelect(this.sel);
    });
    this.v = new THREE.Vector3();
    this.home = { pos: new THREE.Vector3(0, 5.4, 15.5), look: new THREE.Vector3(0, -0.7, 0) };
    this.camLook = this.home.look.clone();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }
  draw(A, t, dt) {
    this.inertia(dt);
    this.sys.rotation.y = this.yaw * 0.6;
    this.sys.rotation.x = this.pitch * 0.5;
    this.planets.forEach((p) => {
      const slow = p.i === this.sel ? 0.15 : 1;
      p.a += p.speed * dt * slow;
      p.mesh.position.set(Math.cos(p.a) * p.r, 0, Math.sin(p.a) * p.r);
      p.mesh.rotation.y += dt * 0.25;
      const dim = this.sel >= 0 && p.i !== this.sel;
      p.mesh.material.transparent = true;
      p.mesh.material.opacity += ((dim ? 0.12 : 1) - p.mesh.material.opacity) * Math.min(1, dt * 4);
      p.mesh.material.depthWrite = !dim;
      const s = p.i === this.sel ? 1.35 : p.i === this.hover ? 1.18 : 1;
      p.mesh.scale.lerp(this.v.set(s, s, s), Math.min(1, dt * 8));
      p.mesh.getWorldPosition(this.v);
      this.v.project(this.cam);
      p.sx = (this.v.x * 0.5 + 0.5) * this.w; p.sy = (-this.v.y * 0.5 + 0.5) * this.h; p.vis = this.v.z < 1;
    });
    // labels: nudge apart vertically so neighbours never sit on top of each other
    const order = [...this.planets].sort((a, b) => a.sy - b.sy), placed = [];
    order.forEach((p) => {
      let y = p.sy - 10;
      // a label's width only changes with its text (the language): measured then, not every frame, since reading it
      // between the style writes below would make the browser lay the page out again for each label
      const txt = p.lab.textContent;
      if (p.labTxt !== txt || !p.labW) { p.labW = p.lab.offsetWidth; p.labTxt = txt; }
      const w = p.labW || 220, x = p.sx + 26 + w > this.w - 40 ? p.sx - 26 - w : p.sx + 26;   // names near the right edge go on the left
      for (const q of placed) if (Math.abs(q.x - x) < Math.max(w, q.w) && Math.abs(q.y - y) < 24) y = q.y + 24;
      placed.push({ x, y, w });
      p.lab.style.transform = `translate(${x}px, ${y}px)`;
      p.lab.style.opacity = p.vis ? (this.sel >= 0 && p.i !== this.sel ? 0.25 : 1) : 0;
      p.lab.style.color = p.i === this.sel ? '#C8924A' : '#9C9184';
    });
    // camera: glide to the chosen world, or back to the whole system
    const focus = this.sel >= 0 ? this.planets[this.sel].mesh : null;
    if (focus) {
      // stand back from the planet and aim a little to its left, so it sits on the right half beside the text
      focus.getWorldPosition(this.tmp);
      const out = this.tmp.clone().sub(this.sys.position).setY(0).normalize();
      this.tmp2.copy(this.tmp).addScaledVector(out, 5.2).add(new THREE.Vector3(0, 1.4, 0));
      const fwd = this.tmp.clone().sub(this.tmp2).normalize(), right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      const look = this.tmp.clone().addScaledVector(right, -1.9);
      this.cam.position.lerp(this.tmp2, Math.min(1, dt * 2.2));
      this.camLook.lerp(look, Math.min(1, dt * 3));
    } else {
      this.cam.position.lerp(this.home.pos, Math.min(1, dt * 1.8));
      this.camLook.lerp(this.home.look, Math.min(1, dt * 1.8));
    }
    this.cam.lookAt(this.camLook);
    this.sun.intensity = 9 + A.bands.sLow * 1.5;
    this.ray.setFromCamera(this.mouse, this.cam);
    const hit = this.ray.intersectObjects(this.planets.map((p) => p.mesh))[0];
    this.hover = hit ? this.planets.findIndex((p) => p.mesh === hit.object) : -1;
    this.cv.style.cursor = this.hover >= 0 ? 'pointer' : this.dragging ? 'grabbing' : 'grab';
    this.render();
  }
}

// ------------------------------------------------------------ two-source interference surface (side-c)
export class Wave extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 36, ...o });
    this.cam.position.set(0, 9, 19);
    this.cam.lookAt(0, -1, 0);
    const geo = new THREE.PlaneGeometry(44, 30, 300, 210);
    geo.rotateX(-Math.PI / 2);
    this.u = { t: { value: 0 }, amp: { value: 0.7 }, s1: { value: new THREE.Vector2(-5.5, -2) }, s2: { value: new THREE.Vector2(5.5, 2) }, g1: { value: 1 }, g2: { value: 1 } };
    this.want = [1, 1];
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      vertexShader: `uniform float t; uniform float amp; uniform vec2 s1; uniform vec2 s2; uniform float g1; uniform float g2;
        varying float vA; varying float vB; varying float vH; varying vec2 vP; varying float vD;
        void main(){ vec3 p = position; float d1 = distance(p.xz, s1), d2 = distance(p.xz, s2);
          vA = sin(d1 * 1.25 - t * 2.2) * exp(-d1 * 0.045) * g1; vB = sin(d2 * 1.25 - t * 2.2) * exp(-d2 * 0.045) * g2;
          vH = vA + vB; p.y = vH * amp; vP = p.xz; vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying float vB; varying float vH; varying vec2 vP; varying float vD;
        void main(){ float h = vH * 3.0; float f = abs(fract(h) - 0.5); float line = 1.0 - smoothstep(0.0, fwidth(h) * 1.4, f);
          vec3 white = vec3(0.95, 0.94, 0.92), ember = vec3(0.78, 0.57, 0.29), me = vec3(0.9, 0.28, 0.18);
          float wa = clamp(vA * 0.5 + 0.5, 0.0, 1.0), wb = clamp(vB * 0.5 + 0.5, 0.0, 1.0);
          vec3 c = mix(white, ember, wb / (wa + wb + 1e-3));
          float crest = smoothstep(1.15, 1.6, vH);
          c = mix(c, me, crest);
          float fog = 1.0 - smoothstep(14.0, 42.0, vD);
          float a = (line * (0.32 + crest * 0.68)) * fog;
          gl_FragColor = vec4(c, a); }`,
    });
    this.scene.add(new THREE.Mesh(geo, mat));
    [[this.u.s1.value, 0xf2efea], [this.u.s2.value, 0xc8924a]].forEach(([s, c]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12), new THREE.MeshBasicMaterial({ color: c }));
      m.position.set(s.x, 1.6, s.y);
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x, 1.6, s.y), new THREE.Vector3(s.x, -2, s.y)]), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.5 }));
      this.scene.add(m, l);
    });
    this.root = this.scene;
    this.v3 = new THREE.Vector3();
    this.pinXY = [[0, 0], [0, 0]];
    this.crestXY = [960, 540];
  }
  // a song from one source is playing: that source rings out, the other one quietens (-1: both even)
  focus(k) { this.want = k < 0 ? [1, 1] : k === 0 ? [1.45, 0.55] : [0.55, 1.45]; }
  draw(A, t, dt) {
    this.u.t.value = t;
    this.u.amp.value = 0.55 + A.bands.sLow * 1.4;
    const e = 1 - Math.exp(-dt * 1.6);
    this.u.g1.value += (this.want[0] - this.u.g1.value) * e;
    this.u.g2.value += (this.want[1] - this.u.g2.value) * e;
    this.inertia(dt);
    const a = this.yaw + Math.sin(t * 0.07) * 0.25, d = 21;
    this.cam.position.set(Math.sin(a) * d, 9 + this.pitch * 8, Math.cos(a) * d);
    this.cam.lookAt(0, -1.2, 0);
    this.cam.updateMatrixWorld();
    // where each source's marker sits on the 1920 x 1080 stage, for the labels that ride on them
    [this.u.s1.value, this.u.s2.value].forEach((s, k) => {
      this.v3.set(s.x, 1.6, s.y).project(this.cam);
      this.pinXY[k][0] = (this.v3.x + 1) * 960;
      this.pinXY[k][1] = (1 - this.v3.y) * 540;
    });
    // the crest between the two sources rides up and down with the two waves there
    const dc = Math.hypot(this.u.s1.value.x, this.u.s1.value.y), hgt = 2 * Math.sin(dc * 1.25 - t * 2.2) * Math.exp(-dc * 0.045);
    this.v3.set(0, 0.9 + hgt * this.u.amp.value * 0.5, 0).project(this.cam);
    this.crestXY[0] = (this.v3.x + 1) * 960; this.crestXY[1] = (1 - this.v3.y) * 540;
    this.render();
  }
}

// ------------------------------------------------------------ the track as a growing totem (me-totem)
export class Totem extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 34, ...o });
    this.N = 300; this.M = 120; this.dy = 0.06;
    const n = this.N * this.M * 2;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.lines.frustumCulled = false;   // the tower keeps growing upwards; a bounding sphere from the first frame would cull it
    this.geo.setDrawRange(0, 0);
    this.scene.add(this.lines);
    this.count = 0; this.acc = 0;
    this.bands = new Float32Array(40);
    this.energy = new Float32Array(this.N);
    this.pal = new Uint8Array(this.N);
    this.top = 0;
    this.setSection(1, true);
  }
  // each section of the song stacks its own kind of ring, so the finished tower is a record of the song's form
  setSection(i, quiet) {
    const L = Totem.LOOKS[Math.min(i, Totem.LOOKS.length - 1)];
    this.look = L;
    this.sec = i;
    if (!quiet) this.cut = true;
  }
  ring(idx, y, bands) {
    const { M } = this, base = idx * M * 2 * 3;
    let e = 0;
    for (let k = 0; k < bands.length; k++) e += bands[k];
    this.energy[idx] = e / bands.length;
    const rAt = (th) => {
      const u = Math.abs(((th / Math.PI) % 2) - 1);      // mirror: front and back read the same
      const b = bands[Math.min(bands.length - 1, Math.floor(u * bands.length))];
      const L = this.look, petals = L.petals ? 1 + 0.22 * Math.cos(L.petals * th) : 1;
      return (0.9 + b * 2.6 * L.spread) * petals;
    };
    this.pal[idx] = this.look.pal;
    for (let j = 0; j < M; j++) {
      const a0 = (j / M) * Math.PI * 2, a1 = ((j + 1) / M) * Math.PI * 2, r0 = rAt(a0), r1 = rAt(a1), o = base + j * 6;
      this.pos[o] = Math.cos(a0) * r0; this.pos[o + 1] = y; this.pos[o + 2] = Math.sin(a0) * r0;
      this.pos[o + 3] = Math.cos(a1) * r1; this.pos[o + 4] = y; this.pos[o + 5] = Math.sin(a1) * r1;
    }
  }
  draw(A, t, dt) {
    const { N, M } = this;
    this.acc += dt;
    // the tower only changes when a ring is added: then the new ring goes up to the GPU, and the colours (every ring
    // dims a step as it ages); between rings nothing is uploaded
    if (this.acc > 0.09 && A.bands.rms > 0.003) {
      this.acc = 0;
      A.logBands(this.bands.length, 30, 12000, this.bands);
      const idx = this.count % N;
      this.top = this.count * this.dy;
      this.ring(idx, this.top, this.bands);
      this.count++;
      const n = Math.min(this.count, N);
      for (let i = 0; i < n; i++) {
        const age = (this.count - 1 - i + N) % N, f = Math.pow(1 - age / N, 1.6), e = Math.min(1, this.energy[i] * 3);
        const P = Totem.PALS[this.pal[i]], r = (P[0] + e * P[1]) * f, g = (P[2] + (1 - e) * P[3]) * f, b = (P[4] + (1 - e) * P[5]) * f;
        const base = i * M * 2 * 3;
        for (let j = 0; j < M * 2; j++) { const o = base + j * 3; this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b; }
      }
      const P = this.geo.attributes.position, Cl = this.geo.attributes.color;
      P.clearUpdateRanges(); P.addUpdateRange(idx * M * 2 * 3, M * 2 * 3); P.needsUpdate = true;
      Cl.clearUpdateRanges(); Cl.addUpdateRange(0, n * M * 2 * 3); Cl.needsUpdate = true;
      this.geo.setDrawRange(0, n * M * 2);
    }
    this.inertia(dt);
    // every section is a new camera: a cut, not a move
    const L = this.look, a = t * L.spin + this.yaw + this.sec * 1.9, cy = this.top;
    this.cam.position.set(Math.sin(a) * L.d, cy + L.hy + this.pitch * 6, Math.cos(a) * L.d);
    this.cam.lookAt(0, cy + L.look, 0);
    this.render();
  }
}

// rings' colours per section: [r, r·energy, g, g·(1-energy), b, b·(1-energy)]
Totem.PALS = [
  [0.5, 0.25, 0.3, 0.12, 0.14, 0.06],     // ember, dim
  [0.55, 0.35, 0.22, 0.34, 0.16, 0.12],   // vermillion
  [0.78, 0.2, 0.52, 0.2, 0.18, 0.08],     // gold
  [0.85, 0.15, 0.78, 0.1, 0.68, 0.1],     // white-hot
];
// d: camera distance, hy: height above the top ring, look: where it looks, spin: orbit speed,
// spread: how far the rings swing out, petals: the papel picado sun cut into the ring
Totem.LOOKS = [
  { pal: 0, spread: 0.6, petals: 0, d: 9, hy: 0.5, look: -1.5, spin: 0.05 },
  { pal: 1, spread: 1, petals: 0, d: 13, hy: 2.2, look: -3.2, spin: 0.12 },
  { pal: 2, spread: 1.25, petals: 8, d: 7.5, hy: 9, look: -1, spin: 0.22 },
  { pal: 1, spread: 1, petals: 0, d: 20, hy: 1, look: -6, spin: 0.3 },
  { pal: 3, spread: 1.4, petals: 5, d: 8, hy: -8, look: -2.5, spin: 0.08 },
  { pal: 2, spread: 1.1, petals: 8, d: 8.5, hy: 7, look: -1.5, spin: 0.18 },
  { pal: 0, spread: 0.5, petals: 0, d: 26, hy: 4, look: -8, spin: 0.05 },
];

// ------------------------------------------------------------ Whale Song: every heavy hit is a blast (am-whale)
// Black and red, nothing fixed in the middle. A stream of very fine particles pours out of the centre without
// end and flies off the screen, faster when the music is loud. The hits are found in the track itself before it
// plays: ordinary ones surge the stream; only the heaviest detonate, a shell bursting outward as a widening
// ring that cools from white-hot to red and frays into smoke within four seconds.
const BURSTS = 8, PER = 26000;
const LEV_VS = `
attribute vec4 aP; attribute float aSeed;
uniform float uT, uHigh, uLow, uScale, uHalo, uKeep, uFlow, uLoud, uPulse;
uniform vec4 uW[${BURSTS}];   // x: age in seconds (< 0: free), y: strength, z: tilt, w: turn
varying float vA; varying vec3 vC;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec3 hot(float k) {           // dark red → red → white-hot
  return mix(mix(vec3(0.35, 0.01, 0.015), vec3(1.0, 0.1, 0.07), smoothstep(0.0, 0.45, k)), vec3(1.0, 0.86, 0.8), smoothstep(0.55, 1.0, k));
}
void hide() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; vC = vec3(0.0); }
void main() {
  float kind = aP.x, size = 1.0, a = 1.0, heat = 0.3;
  vec3 p;
  if (h1(aSeed * 3.7) > uKeep && kind < 1.5) { hide(); return; }
  if (kind < 0.5) {
    // one particle of burst number aP.y
    vec4 W = uW[0];
    for (int i = 1; i < ${BURSTS}; i++) if (float(i) == aP.y) W = uW[i];
    if (W.x < 0.0 || W.x > 4.5) { hide(); return; }
    float age = W.x, s = W.y;
    float th = h1(aSeed * 11.0) * 6.2831853;
    // most of the shell flies flat as a ring; the rest fills the inside as mist
    float ringy = step(0.22, h1(aSeed * 23.0));
    float el = ringy > 0.5 ? (h1(aSeed * 13.0) - 0.5) * 0.1 : (h1(aSeed * 13.0) - 0.5) * 1.4;
    vec3 dir = normalize(vec3(cos(th), el, sin(th) * 0.62));
    // a crisp leading edge with a soft wake behind it
    float sp = ringy > 0.5 ? 1.0 - 0.16 * pow(h1(aSeed * 19.0), 2.0) : pow(h1(aSeed * 19.0), 0.7) * 0.85;
    float R = (7.0 + 9.5 * s) * sp * (1.0 - exp(-age * (2.0 + 0.4 * h1(aSeed * 29.0))));   // a snap, then a long glide off the screen
    p = dir * R;
    // tilt and turn each blast a little so no two look the same
    float ct = cos(W.z), st = sin(W.z), cw = cos(W.w), sw = sin(W.w);
    p = vec3(p.x * cw - p.z * sw, p.y, p.x * sw + p.z * cw);
    p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
    // it frays into smoke as it slows
    float fray = age * age * 0.18 + age * 0.25;
    p += fray * vec3(sin(p.z * 0.9 + aSeed * 30.0 + uT * 0.6), sin(p.x * 0.8 + aSeed * 17.0) * 0.6 - age * 0.12, cos(p.x * 0.7 + aSeed * 23.0 - uT * 0.5));
    float glow = exp(-age * 0.95) * min(1.25, s);
    float edge = ringy * (1.0 - smoothstep(0.0, 0.16, 1.0 - sp));   // the leading edge burns brightest
    float out_ = 1.0 - smoothstep(3.2, 4.5, age);
    heat = 0.25 + exp(-age * 1.4) * (0.6 + 0.6 * edge) * s;          // the edge leaves white-hot and cools to red
    size = 0.6 + (0.9 + 1.4 * edge) * exp(-age * 1.2) * s;
    a = glow * (0.45 + 0.55 * edge) * out_ * 1.9;
    if (uHalo > 0.5) { size = h1(aSeed * 41.0) < 0.14 ? 16.0 * exp(-age * 1.1) * (0.5 + edge) : 0.0; a = glow * 0.11 * out_; heat = 0.5; }
  } else if (kind < 1.5) {
    // the stream: born at the centre, accelerating outward until it leaves the screen
    float f = fract(uFlow * (0.3 + 0.7 * h1(aSeed * 8.1)) + h1(aSeed * 5.3));
    float th = h1(aSeed * 11.0) * 6.2831853;
    float el = (h1(aSeed * 13.0) - 0.5) * (h1(aSeed * 17.0) < 0.72 ? 0.22 : 1.5);
    vec3 dir = normalize(vec3(cos(th), el, sin(th) * 0.62));
    p = dir * 28.0 * pow(f, 1.75);
    float sw = 0.35 * f + 0.2 * sin(uT * 0.2 + aSeed * 6.0) * f;           // a slow swirl as it goes
    p = vec3(p.x * cos(sw) - p.z * sin(sw), p.y, p.x * sin(sw) + p.z * cos(sw));
    if (uHalo > 0.5) { hide(); return; }
    heat = 0.78 - f * 0.55 + uPulse * 0.25;
    size = 0.4 + f * 1.6 + uPulse * 0.5;                              // nearer the edge, nearer the eye
    a = smoothstep(0.0, 0.05, f) * (1.0 - smoothstep(0.86, 1.0, f)) * (0.4 + f * 0.35 + uLoud * 0.35 + uPulse * 0.7);
  } else {
    // the flash at the heart of each hit
    if (uHalo > 0.5) { hide(); return; }
    p = vec3(0.0);
    float f = 0.0;
    for (int i = 0; i < ${BURSTS}; i++) if (uW[i].x >= 0.0) f += uW[i].y * exp(-uW[i].x * 5.0);
    size = 60.0 + 110.0 * uLow + 90.0 * uPulse + 420.0 * f;
    a = 0.14 + 0.1 * uLow + 0.25 * uPulse + min(1.0, f) * 0.9;
    heat = 0.55 + min(0.45, f * 0.5);
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / max(0.5, -mv.z);
  vA = a; vC = hot(heat);
}`;
const LEV_FS = `
varying float vA; varying vec3 vC;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vC, exp(-r * 3.5) * (1.0 - r) * vA);
}`;
const SMOKE_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;
const SMOKE_FS = `
varying vec2 vUv; uniform float uT, uLow, uFlash, uSpread;
float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 q) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(q); q = q * 2.03 + 1.7; a *= 0.5; } return v; }
void main() {
  vec2 q = (vUv - 0.5) * vec2(1.78, 1.0);
  float n = fbm(q * 2.0 + vec2(uT * 0.02, -uT * 0.015) + noise(q * 1.3 - uT * 0.05) * 1.3);
  float e = length(q / vec2(1.0, 0.55));
  // the smoke is lit from the centre by each flash, and the light spreads out as the blast does
  float lit = exp(-e * e * (5.0 - uSpread * 3.6)) * uFlash * 1.6 + exp(-e * e * 2.0) * (0.05 + uLow * 0.12);
  gl_FragColor = vec4(vec3(0.6, 0.04, 0.035) * n * n * lit, 1.0);
}`;

export class Leviathan extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 50, ...o });
    const ND = 120000, N = BURSTS * PER + ND + 1;
    const P = new Float32Array(N * 4), Sd = new Float32Array(N);
    let k = 0;
    for (let b = 0; b < BURSTS; b++) for (let i = 0; i < PER; i++, k++) { P[k * 4] = 0; P[k * 4 + 1] = b; Sd[k] = Math.random(); }
    for (let i = 0; i < ND; i++, k++) { P[k * 4] = 1; Sd[k] = Math.random(); }
    P[k * 4] = 2; Sd[k] = 0.5;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aP', new THREE.BufferAttribute(P, 4));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(Sd, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    this.W = Array.from({ length: BURSTS }, () => new THREE.Vector4(-1, 0, 0, 0));
    this.born = new Array(BURSTS).fill(-99);
    this.u = { uT: { value: 0 }, uLow: { value: 0 }, uHigh: { value: 0 }, uScale: { value: 1 }, uKeep: { value: 1 }, uW: { value: this.W }, uFlow: { value: 0 }, uLoud: { value: 0 }, uPulse: { value: 0 } };
    this.smokeU = { uT: this.u.uT, uLow: this.u.uLow, uFlash: { value: 0 }, uSpread: { value: 0 } };
    const smoke = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.smokeU, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    smoke.frustumCulled = false;
    smoke.renderOrder = -1;
    this.scene.add(smoke);
    [1, 0].forEach((halo) => {
      const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: { ...this.u, uHalo: { value: halo } }, vertexShader: LEV_VS, fragmentShader: LEV_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      pts.frustumCulled = false;
      this.scene.add(pts);
    });
    this.t0 = null; this.hits = null; this.prevPos = -0.2; this.last = -9;
    this.ft = 1 / 60; this.check = 5; this.slow = 0; this.punch = 0; this.avg = 0.02; this.pulse = 0; this.lastBig = -9;
    this.fitScale();
  }
  fit() { super.fit(); this.r.setPixelRatio(Math.min(1.25, this.r.getPixelRatio())); this.r.setSize(this.w, this.h, false); this.fitScale(); }
  fitScale() {
    if (!this.u) return;
    const H = this.h * this.r.getPixelRatio();
    this.u.uScale.value = (0.02 * H) / (2 * Math.tan((this.cam.fov * Math.PI) / 360));
  }
  // the heavy hits of the track: onsets of the level envelope, strongest first-class only
  findHits(A) {
    const env = A.envelope('am-whale', 0.01), n = env.length, o = new Float32Array(n);
    for (let i = 8; i < n; i++) { let m = 0; for (let j = i - 8; j < i; j++) m += env[j]; o[i] = Math.max(0, env[i] - m / 8); }
    let mx = 0;
    for (const v of o) mx = Math.max(mx, v);
    const hits = [];
    for (let i = 25; i < n - 25; i++) {
      if (o[i] < 0.28 * mx) continue;
      let peak = true;
      for (let k = -25; k <= 25; k++) if (o[i + k] > o[i]) { peak = false; break; }
      if (peak && (!hits.length || i * 0.01 - hits[hits.length - 1].t > 0.3)) hits.push({ t: i * 0.01, r: o[i] / mx });
    }
    return hits;
  }
  // ordinary hits surge the stream; the heaviest (and never two within a second) detonate
  hit(e, r) {
    if (r >= 0.6 && e - this.lastBig > 1.0) { this.lastBig = e; this.blast(e, 0.6 + r * 0.7); }
    else this.pulse = Math.min(1.4, this.pulse + 0.35 + r * 0.6);
    this.last = e;
  }
  blast(e, s) {
    let k = 0;
    for (let i = 1; i < BURSTS; i++) if (this.born[i] < this.born[k]) k = i;
    this.born[k] = e;
    this.W[k].set(0, s, (Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2);
    this.punch = Math.max(this.punch, s);
    this.last = e;
  }
  draw(A, t, dt) {
    if (this.t0 === null) { this.t0 = t; }
    const e = t - this.t0, B = A.bands, u = this.u;
    if (dt < 0.1 && e > 4) this.ft += (dt - this.ft) * 0.05;
    if (e > this.check) {
      this.check = e + 1.5;
      this.slow = this.ft > 1 / 45 ? this.slow + 1 : 0;
      if (this.slow >= 2 && u.uKeep.value > 0.35) { u.uKeep.value *= 0.75; this.slow = 0; console.info('Whale Song: fewer particles', u.uKeep.value.toFixed(2)); }
      else if (this.ft < 1 / 57 && u.uKeep.value < 1) u.uKeep.value = Math.min(1, u.uKeep.value / 0.85);
    }
    u.uT.value = e;
    u.uLow.value += (Math.min(1, Math.max(0, (B.sLow - 0.22) * 1.7)) - u.uLow.value) * 0.15;
    u.uHigh.value += (Math.min(1, B.sHigh * 3) - u.uHigh.value) * 0.2;
    // fire on the track's own heavy hits; if it isn't playing, fall back to listening for jumps in level
    if (!this.hits && A.buffers['am-whale']) this.hits = this.findHits(A);
    if (this.hits && A.bedKey === 'am-whale' && A.bed) {
      const pos = A.bed.position();
      if (pos < this.prevPos) this.prevPos = pos - 0.001;                    // the preview looped
      // what the speakers play now is what the context scheduled a little earlier
      const lat = (A.ctx.outputLatency || 0.03) + (A.ctx.baseLatency || 0) - 0.016, at = pos - lat, was = this.prevPos - lat;
      const impacts = this.o.impacts || [];
      for (const t of impacts) if (t > was && t <= at) { this.lastBig = e; this.blast(e, 1.25); this.last = e; }
      for (const h of this.hits) if (h.t > was && h.t <= at && !impacts.some((t) => Math.abs(t - h.t) < 0.3)) this.hit(e, Math.min(0.59, h.r));
      this.prevPos = pos;
    } else {
      if (B.kick === 1 && B.rms > this.avg * 1.2 && e - this.last > 0.3) this.hit(e, Math.min(0.59, (B.rms / this.avg - 1) * 1.5));
    }
    // the stream: loudness (relative to the last few seconds) sets its speed, hits shove it forward
    this.avg += (B.rms - this.avg) * (dt / 4);
    const loud = Math.min(1.3, Math.max(0, (B.rms / Math.max(0.004, this.avg) - 0.6) * 0.9));
    u.uLoud.value += (loud - u.uLoud.value) * (loud > u.uLoud.value ? 0.3 : 0.05);
    this.pulse *= Math.pow(0.08, dt);
    u.uPulse.value = this.pulse;
    u.uFlow.value += dt * (0.09 + u.uLoud.value * 0.12 + this.pulse * 0.35);
    let flash = 0, spread = 0;
    this.W.forEach((w, i) => {
      const age = e - this.born[i];
      w.x = age < 4.5 ? age : -1;
      if (age < 4.5) { const f = w.y * Math.exp(-age * 2.2); flash += f; spread = Math.max(spread, Math.min(1, age / 2) * Math.min(1, f * 2)); }
    });
    this.smokeU.uFlash.value = Math.min(1.6, flash);
    this.smokeU.uSpread.value = spread;
    this.punch *= Math.pow(0.015, dt);
    this.inertia(dt);
    const shake = this.punch * 0.16;
    const a = e * 0.03 + this.yaw, d = 13 - this.punch * 1.1, h = 5.2 + this.pitch * 6;
    this.cam.position.set(Math.sin(a) * d + (Math.random() - 0.5) * shake, h + (Math.random() - 0.5) * shake, Math.cos(a) * d);
    this.cam.lookAt(0, -1.2, 0);
    this.render();
  }
}

// ------------------------------------------------------------ Прокофьев: the monument hall (me-114514)
// Real scans (Poly Haven, CC0): a marble bust, a mantel clock, an old gas mask. The bust is the repeated thing:
// monuments drop out of the dark on the beat and line up to the horizon, put on gas masks, and in the silence
// at 3:41 every one of them is turned to the audience, smiling.
const MODELS = {};
export function model(id) {
  return MODELS[id] || (MODELS[id] = (async () => {
    const { GLTFLoader } = await import('./vendor/GLTFLoader.js');
    const dir = `assets/models/${id}/`;
    const json = await (await fetch(asset(`${dir}${id}_1k.gltf`))).text();
    const mgr = new THREE.LoadingManager();
    mgr.setURLModifier((u) => (u.startsWith('blob:') || u.startsWith('data:') ? u : asset(dir + u)));
    return new Promise((res, rej) => new GLTFLoader(mgr).parse(json, '', res, rej));
  })());
}
export const warmModels = () => ['marble_bust_01', 'mantel_clock_01', 'old_gas_mask'].forEach(model);
const meshOf = (gltf, name) => { let m = null; gltf.scene.traverse((o) => { if (o.isMesh && (!name || o.name === name) && !m) m = o; }); return m; };
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// A light copy of a scan for the rows far back: vertices snapped to a grid of the given cell size and merged
// (vertex clustering), triangles that collapse are dropped, normals rebuilt.
function decimate(geo, cell) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, idx = geo.index;
  const map = new Map(), remap = new Int32Array(pos.count), P = [], U = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), key = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)}`;
    let j = map.get(key);
    if (j === undefined) { j = P.length / 3; map.set(key, j); P.push(x, y, z); if (uv) U.push(uv.getX(i), uv.getY(i)); }
    remap[i] = j;
  }
  const I = [], n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const a = remap[idx ? idx.getX(t) : t], b = remap[idx ? idx.getX(t + 1) : t + 1], c = remap[idx ? idx.getX(t + 2) : t + 2];
    if (a !== b && b !== c && a !== c) I.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------ the collage in the monument hall (me-114514)
// Public-domain pictures cut out by tools/collage.py and stood up in the hall the way Klutsis pasted photographs
// into his posters, each of them once: Prokofiev himself among the monuments, his obituary (page 116), Lissitzky's
// red wedge, a Klutsis worker, Atget's headless mannequins, Malevich's square, and things from Bosch's Hell — the
// pair of ears with a knife, the tree-man, the bagpipe, the hurdy-gurdy, the pig in a nun's veil, the drum.
const STICKERS = ['sticker-cat', 'sticker-owl', 'sticker-mask', 'sticker-eye', 'sticker-eye2', 'sticker-pro'];
const CUTS = ['prokofiev', 'prokofiev-obit', 'worker', 'headless', 'uniforms',
  'bosch-ears', 'bosch-treeman', 'bosch-bagpipe', 'bosch-hurdy', 'bosch-pignun', 'bosch-drum', ...STICKERS];
export const COLLAGE = CUTS.map((n) => `assets/collage/${n}.webp`);

// The venom (3:38-3:41). In the silence it seeps out from behind the clock and swallows the hall: a black, oily skin
// that runs ahead in fingers and drips downward, red veins creeping out in front of it and showing under it, pulsing
// with each tick of the clock. Drawn on a sheet just behind the clock, so the clock stays standing in it; the sheet
// works in screen pixels of the 1920 x 1080 stage.
const VENOM_VS = 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const VENOM_FS = `
uniform vec2 uRes; uniform vec2 uSrc; uniform float uR; uniform float uTime; uniform float uTick; uniform float uBass;
float hs(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ns(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), f.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + 1.0), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * ns(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
float ridge(vec2 p, float k) { return pow(1.0 - abs(fbm(p) * 2.0 - 1.0), k); }
void main() {
  vec2 p = vec2(gl_FragCoord.x / uRes.x * 1920.0, (1.0 - gl_FragCoord.y / uRes.y) * 1080.0);
  vec2 d = p - uSrc;
  float r = length(d);
  vec2 dir = d / max(r, 1.0);
  // the front: bent by a slow current, split into fingers that fork and curl as they go, pulled down by its weight
  vec2 w = vec2(fbm(p * 0.003 + vec2(3.1, uTime * 0.04)), fbm(p * 0.003 + vec2(7.7, -uTime * 0.03))) - 0.5;
  float rw = length(d + w * 300.0 * smoothstep(0.0, 260.0, r));
  float fing = fbm(dir * 5.5 + w * 1.5 + r * 0.0022);
  // drips: narrow runs hanging from its underside, rounded at the end
  float drip = pow(ns(vec2(p.x * 0.07, 3.0)), 9.0) * smoothstep(0.1, 0.7, dir.y) * 320.0 * smoothstep(0.0, 900.0, uR);
  float R = uR * (0.3 + 2.2 * fing * fing * fing) + drip;
  float inside = smoothstep(R + 2.0, R - 2.0, rw);
  // the skin: lumpy, with a raised lip at its edge, wet: a hard highlight and oily colours in it
  float lump = ns(p * 0.0045 + vec2(0.0, uTime * 0.12)) * 0.65 + ns(p * 0.011 - vec2(uTime * 0.07, 0.0)) * 0.35;
  float lip = smoothstep(R - 60.0, R - 2.0, rw) * inside;
  float hgt = inside * (0.4 + 0.6 * lump) + lip * 0.7;
  vec3 n = normalize(vec3(-dFdx(hgt) * 55.0, dFdy(hgt) * 55.0, 1.0));
  // beyond the reach of its tendrils and its shadow nothing of it shows (alpha 0): the rest is not worked out there.
  // (after the derivatives above, which need every pixel of the 2 x 2 block)
  if (rw >= R * 1.6 + 60.0) { gl_FragColor = vec4(0.0); return; }
  // tendrils run out ahead of it: they reach things first
  float tend = ridge(dir * 9.0 + w * 0.9 + r * 0.0011, 30.0);
  float ahead = smoothstep(R * 1.6 + 60.0, R, rw) * (1.0 - inside);
  float va = tend * ahead;
  vec3 H = normalize(vec3(-0.45, 0.55, 0.7) + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 75.0);
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + n.x * 2.0 + n.y * 1.3 + lump * 1.7));
  vec3 col = vec3(0.01, 0.002, 0.005) + vec3(0.05, 0.0, 0.01) * max(n.y, 0.0);
  // veins under the skin: near its growing edge, and everywhere for a moment with each tick of the clock
  float under = ridge(p * 0.0045 + w * 2.2 + 2.0, 22.0);
  float band = smoothstep(R * 0.35, R * 0.92, rw) * (1.0 - lip * 0.7);
  float beat = exp(-uTick * 3.5);
  col += vec3(0.5, 0.015, 0.04) * under * inside * (band * (0.45 + uBass * 0.7) + beat * 0.45);
  col += spec * mix(vec3(1.0), film, 0.4) * 0.85 * inside;
  // the tendrils: dark red, their tips burning
  col = mix(col, vec3(0.32, 0.0, 0.02) + vec3(0.55, 0.06, 0.02) * smoothstep(R * 1.2, R * 1.6, rw), va);
  // and a shadow runs in front of it all
  float shade = smoothstep(R * 1.35 + 60.0, R, rw) * 0.55;
  gl_FragColor = vec4(col, max(inside, max(va, shade)));
}`;

class Collage {
  constructor(hall) {
    this.hall = hall;
    this.scene = hall.scene;
    this.tex = {};
    CUTS.forEach((n) => (this.tex[n] = tex(`assets/collage/${n}.webp`)));
    this.all = [];
    const H = hall, F = H.floor;
    // Prokofiev, life size, the one real person in the hall: he looks at you the whole time
    this.pro = this.cut('prokofiev', 2.0);
    this.pro.position.set(1.25, F, -5.6);
    // his obituary on page 116, coming down through the hall like a leaf, to the right of the clock (where it cannot
    // pass in front of the title)
    this.obit = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.86), new THREE.MeshLambertMaterial({ map: this.paper(), side: THREE.DoubleSide }));
    this.add(this.obit);
    this.obitS = { x: 0.75, y: 3.4, z: -2, r: 0 };
    // Lissitzky's wedge comes in from the bottom left corner, right across the page, and drives into the red disc
    // behind the clock, as in the poster. Its point is the group's origin.
    this.wedge = new THREE.Group();
    const tip = new THREE.Vector2(-0.3, 0.86), tail = new THREE.Vector2(-3.4, 0.0), ax = tail.clone().sub(tip), nrm = new THREE.Vector2(-ax.y, ax.x).normalize().multiplyScalar(0.34);
    const wg = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, ax.x + nrm.x, ax.y + nrm.y, 0, ax.x - nrm.x, ax.y - nrm.y, 0], 3));
    this.wedgeMesh = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0xd8261c, side: THREE.DoubleSide, fog: false }));
    this.wedge.add(this.wedgeMesh);
    this.wedge.position.set(tip.x, tip.y, -1.4);
    this.wedgeAx = ax.normalize();
    this.add(this.wedge);
    this.wedgeIn = 0;
    // paper stickers pasted over the monuments' faces, like masks: each picture twice at most
    this.stickers = STICKERS.flatMap((n) => [n, n]).map((n) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex[n], color: 0xd9d2c6, transparent: true, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false }));
      m.matrixAutoUpdate = false; m.userData = { name: n, slot: null, roll: 0 };
      return this.add(m);
    });
    this.local = new THREE.Matrix4(); this.lq = new THREE.Quaternion(); this.lv = new THREE.Vector3(); this.ls = new THREE.Vector3();
    // a Klutsis worker on the horizon like a billboard
    this.worker = this.cut('worker', 7.5);
    this.worker.position.set(-3.2, F - 0.6, -24);
    // Atget: a few monuments are swapped for headless suits in the dark; a window of headless uniforms after 3:41
    this.headless = Array.from({ length: 3 }, () => this.cut('headless', 2.25));
    this.uniforms = this.cut('uniforms', 2.4);
    this.uniforms.position.set(3.4, F, -13);
    // the venom: a sheet just behind the clock, bigger than the view
    this.venomU = { uRes: { value: new THREE.Vector2(1920, 1080) }, uSrc: { value: new THREE.Vector2(1400, 560) }, uR: { value: 0 }, uTime: { value: 0 }, uTick: { value: 9 }, uBass: { value: 0 } };
    this.venom = this.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.ShaderMaterial({ uniforms: this.venomU, vertexShader: VENOM_VS, fragmentShader: VENOM_FS, transparent: true, depthWrite: false })));
    this.venom.position.set(H.C.x, H.C.y, -0.3);
    this.venom.renderOrder = 10;
    this.src = new THREE.Vector3();
    // Bosch. The ears, with the knife between them, roll in out of the fog towards the clock, a step a bar
    this.ears = this.cut('bosch-ears', 1.35);
    this.ears.material.color.setScalar(0.72);   // painted flesh: keep it from burning out under the light after 3:41
    this.earsS = { x: -2.5, z: -10.5, step: 0 };   // in the fog just right of the text column
    // the tree-man stands far off and looks back over his shoulder
    this.tree = this.cut('bosch-treeman', 3.4);
    this.tree.position.set(2.9, F - 0.2, -15);
    // the bagpipe hangs in the dark above the hall and breathes with the bass
    this.bagpipe = this.cut('bosch-bagpipe', 1.1, { anchor: 'centre' });
    this.bagpipe.position.set(-1.8, 2.5, -4);
    // the pig in a nun's veil sits among the monuments
    this.pig = this.cut('bosch-pignun', 1.25);
    this.pig.position.set(-1.55, F, -3.4);
    // the hurdy-gurdy stands upright behind the clock after 3:41
    this.hurdy = this.cut('bosch-hurdy', 2.6);
    this.hurdy.material.color.setScalar(0.75);
    this.hurdy.position.set(-1.9, F, -7.5);
    // the drum: after 3:58 it rolls across the floor, a jolt on every beat
    this.drum = this.cut('bosch-drum', 0.85, { anchor: 'centre' });
    this.drumS = { x: 4.5 };
  }
  add(m) { m.visible = false; this.scene.add(m); this.all.push(m); return m; }
  // a cut-out stood up in the hall: lit like the marble unless flat (graphic colour, kept as printed)
  cut(name, h, o = {}) {
    const g = new THREE.PlaneGeometry(1, 1);
    if (o.anchor === 'tip') g.translate(-0.5, 0.5, 0);   // the wedge hangs from its point, at the bottom right
    else if (o.anchor !== 'centre') g.translate(0, 0.5, 0);
    // a flat sheet shows one face at a time, so one pass draws it: without forceSinglePass three.js draws a transparent
    // double-sided material twice a frame (back, then front) and re-checks its shader for each pass
    const mat = o.flat
      ? new THREE.MeshBasicMaterial({ map: this.tex[name], transparent: true, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false })
      : new THREE.MeshLambertMaterial({ map: this.tex[name], transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, forceSinglePass: true });
    const m = new THREE.Mesh(g, mat);
    m.userData = { name, h };
    return this.add(m);
  }
  // width from the picture's own proportions, once it has loaded
  fit(m, k = 1) {
    const im = this.tex[m.userData.name].image;
    if (im && im.width) m.scale.set(m.userData.h * k * (im.width / im.height), m.userData.h * k, 1);
  }
  face(m, extra = 0) { const c = this.hall.cam.position; m.rotation.set(0, Math.atan2(c.x - m.position.x, c.z - m.position.z) + extra, 0); }
  // page 116 of the music magazine, March 1953: columns of type and, last, his photograph with a black border
  paper() {
    const c = document.createElement('canvas'); c.width = 620; c.height = 860;
    this.paperCv = c;
    this.drawPaper(null);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.paperTex = t;
    return t;
  }
  drawPaper(photo) {
    const g = this.paperCv.getContext('2d'), w = 620, h = 860;
    g.fillStyle = '#d8d0c0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1712'; g.font = '900 54px "CyrBlack", "Arial Black", sans-serif'; g.textAlign = 'left'; g.fillText('МУЗЫКА', 36, 82);
    g.font = '600 22px serif'; g.textAlign = 'right'; g.fillText('стр. 116', w - 36, 80);
    g.fillRect(36, 100, w - 72, 4);
    for (let col = 0; col < 2; col++) for (let y = 128; y < h - 40; y += 15) {
      const x0 = 36 + col * 284, x1 = x0 + 256 - (Math.random() < 0.12 ? 60 + Math.random() * 120 : 0);
      if (col === 1 && y > 150 && y < 470) continue;
      g.fillStyle = `rgba(27,23,18,${0.32 + Math.random() * 0.2})`; g.fillRect(x0, y, x1 - x0, 6);
    }
    g.fillStyle = '#0c0a08'; g.fillRect(316, 150, 268, 320);
    if (photo) { g.filter = 'grayscale(1) contrast(1.35) brightness(.9)'; g.drawImage(photo, 324, 158, 252, 304); g.filter = 'none'; }
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(60,40,20,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }
  // the back of his photograph: the same outline in old card, with a pencil note (written mirrored, so it reads
  // the right way round once he has turned away from us)
  backOf(im) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#b9ad96'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(70,50,30,${Math.random() * 0.12})`; g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3); }
    g.save(); g.translate(c.width * 0.52, c.height * 0.42); g.scale(-1, 1); g.rotate(-0.06);
    g.fillStyle = 'rgba(60,55,50,.7)'; g.font = `italic ${Math.round(c.width * 0.05)}px Georgia, serif`; g.textAlign = 'center';
    g.fillText('С. Прокофьев · 1918', 0, 0);
    g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  blink() {}
  // the bagpipe swells with every note; Prokofiev's photograph catches each flash of light (the ears and the pig in
  // the veil keep still: they only stand and listen)
  hit(kind, s, t) {
    if (kind === 'note') { this.pipeT = t; this.pipeS = s; }
  }
  phase(P, t, prev) {
    if (P === 'twist') {
      this.turnT = t;
      this.workerFall = t;
    }
    if (P[0] === 's') {
      this.turnT = undefined; this.workerFall = undefined;
      if (prev && prev[0] === 's') this.wedgeIn = 1;     // every new part drives the wedge in again
      if (P === 's0') { this.obitS = { x: 0.75, y: 3.4, z: -2, r: 0 }; this.earsS = { x: -2.5, z: -10.5, step: 0 }; this.drumS = { x: 4.5 }; this.stickers.forEach((m) => (m.userData.slot = null)); }
    }
  }
  draw(st, A, t, dt, pt) {
    const P = st.phase, sec = P[0] === 's' ? +P.slice(1) : 9, H = this.hall, F = H.floor, B = A.bands;
    const twisted = P === 'twist' || P === 'twist2', still = P === 'drain' || P === 'end', after = twisted || P === 'end';
    // Prokofiev: from the third part on, looking at you; at 3:41 he alone turns away
    const pro = this.pro;
    pro.visible = sec >= 2;
    this.fit(pro);
    if (this.turnT !== undefined) {
      const k = Math.min(1, (t - this.turnT - 0.85) / 0.6), e = k < 0 ? 0 : k * k * (3 - 2 * k);
      this.face(pro, e * Math.PI);
      // halfway round, the photograph shows its back
      if (!this.proBack && this.tex.prokofiev.image && this.tex.prokofiev.image.width) this.proBack = this.backOf(this.tex.prokofiev.image);
      const back = e > 0.5 && this.proBack;
      if (pro.material.map !== (back ? this.proBack : this.tex.prokofiev)) { pro.material.map = back ? this.proBack : this.tex.prokofiev; pro.material.needsUpdate = true; }
      pro.material.color.setScalar(back ? 0.5 : 1 - e * 0.6);
    } else {
      this.face(pro);
      if (pro.material.map !== this.tex.prokofiev) { pro.material.map = this.tex.prokofiev; pro.material.needsUpdate = true; }
      pro.material.color.setScalar(1 + 0.8 * Math.max(0, 1 - (t - (this.hall.fx.flash ?? -9)) / 0.05));
    }
    // page 116 comes down once, from the fourth part on (and hangs in the air if the silence catches it); once it is
    // past the floor it is gone
    const ob = this.obit, os = this.obitS;
    ob.visible = sec >= 3 && os.y > -1.8;
    if (ob.visible && !this.paperDone) { const im = this.tex['prokofiev-obit'].image; if (im && im.width) { this.drawPaper(im); this.paperTex.needsUpdate = true; this.paperDone = true; } }
    if (ob.visible && !still) {
      os.y -= dt * 0.3; os.r += dt;
      os.x = Math.max(0.5, Math.min(1.05, os.x + Math.sin(t * 0.9) * dt * 0.35));
    }
    ob.position.set(os.x, os.y, os.z);
    ob.rotation.set(Math.sin(os.r * 1.3) * 0.9, os.r * 0.7, Math.sin(os.r) * 0.5);
    // the wedge, driven into the disc; after 3:41 it turns on the beat like the clock's hand
    const wd = this.wedge;
    wd.visible = true;
    this.wedgeIn = Math.max(0, this.wedgeIn - dt * 3.5);
    const back = this.wedgeIn * this.wedgeIn * 0.7;
    wd.position.set(-0.3 + this.wedgeAx.x * back, 0.86 + this.wedgeAx.y * back, -1.4);
    wd.rotation.z = twisted ? ((st.tick || 0) % 2 ? 1 : -1) * Math.min(4, st.tick || 0) * 0.05 : 0;
    // the worker on the horizon in the fourth and fifth parts; he falls backwards at 3:41
    const wk = this.worker;
    wk.visible = (sec >= 3 && sec < 9) || (twisted && this.workerFall !== undefined && t - this.workerFall < 3);
    this.fit(wk);
    wk.rotation.set(this.workerFall !== undefined ? -Math.min(Math.PI / 2, (t - this.workerFall) ** 2 * 0.6) : 0, 0.25, 0);
    // headless suits where monuments were swapped out in the dark (three at most)
    let k = 0;
    for (const s of H.slots) {
      if (s.kind !== 3 || k >= this.headless.length) continue;
      const m = this.headless[k++];
      m.visible = true;
      this.fit(m);
      m.position.set(s.x, F, s.z);
      this.face(m);
    }
    for (; k < this.headless.length; k++) this.headless[k].visible = false;
    const un = this.uniforms;
    un.visible = after;
    this.fit(un);
    this.face(un);
    // the venom: from behind the clock (where it is on the screen), slow at first, then everywhere by 3:40.6
    const vn = this.venom, vu = this.venomU;
    vn.visible = P === 'drain';
    if (vn.visible) {
      H.r.getDrawingBufferSize(vu.uRes.value);
      this.src.copy(H.C).project(H.cam);
      vu.uSrc.value.set((this.src.x + 1) * 960, (1 - this.src.y) * 540);
      const k = Math.min(1, pt / 2.6);
      vu.uR.value = 3900 * k * k * (3 - 2 * k);
      vu.uTime.value = t % 1000;
      vu.uTick.value = t - (H.tickT ?? -9);
      vu.uBass.value = B.sLow || 0;
    }
    // the ears: from the third part they come out of the fog along the floor towards the clock, one step every
    // four beats, a lurch and a stop; in the silences they wait; after 3:41 they stand beside the clock, listening
    const ea = this.ears, es = this.earsS;
    ea.visible = sec >= 2;
    this.fit(ea);
    const want = Math.floor((st.kicks || 0) / 4);
    if (!still && !after && want > es.step) { es.step = want; es.t = t; es.x0 = es.x; es.z0 = es.z; es.x1 = Math.min(-0.75, es.x + 0.08); es.z1 = Math.min(-3.3, es.z + 0.36); }
    if (after && es.x1 !== -0.75) { es.t = t; es.x0 = es.x; es.z0 = es.z; es.x1 = -0.75; es.z1 = -3.3; }
    if (es.t !== undefined && !still) {
      const p = Math.min(1, (t - es.t) / 0.45), e = 1 - (1 - p) ** 3;
      es.x = es.x0 + (es.x1 - es.x0) * e; es.z = es.z0 + (es.z1 - es.z0) * e;
    }
    ea.position.set(es.x, F, es.z);
    this.face(ea, 0.35);
    // the tree-man in the fog from the fourth part on
    const tr = this.tree;
    tr.visible = sec >= 3;
    this.fit(tr);
    this.face(tr, -0.2);
    // the bagpipe above the hall, breathing with the bass, from the fourth part on
    const bp = this.bagpipe;
    bp.visible = sec >= 3;
    const pk = still ? 0 : Math.exp(-(t - (this.pipeT ?? -9)) * 5);
    this.fit(bp, 1 + (still ? 0 : B.sLow * 0.08) + pk * (0.1 + Math.min(0.12, (this.pipeS || 0) / 120)));
    if (!still) bp.position.y = 2.35 + Math.sin(t * 0.4) * 0.12;
    this.face(bp);
    // the pig in a nun's veil sits among the monuments from the third part on
    const pg = this.pig;
    pg.visible = sec >= 2;
    this.fit(pg);
    this.face(pg);
    // the hurdy-gurdy stands behind the clock after 3:41
    const hg = this.hurdy;
    hg.visible = after;
    this.fit(hg);
    this.face(hg, 0.25);
    // the drum rolls across the floor after 3:58, jolting forward on each beat
    const dr = this.drum, ds = this.drumS;
    dr.visible = P === 'twist2';
    if (dr.visible) {
      if (st.kickHit) ds.kick = t;
      ds.x -= dt * (0.25 + Math.max(0, 1 - (t - (ds.kick || -9)) / 0.25) * 2.5);
      if (ds.x < -4.5) ds.x = 4.5;
      this.fit(dr);
      dr.position.set(ds.x, F + 0.42, -3.6);
      dr.rotation.set(0, 0, -ds.x * 1.4);
    }
    // stickers go onto faces on the beat from the third part on (each part starts with at least a few on);
    // each rides on its monument
    const floorN = [0, 0, 3, 6, 9][sec] ?? 0, on = this.stickers.filter((m) => m.userData.slot).length;
    if ((st.kickHit && sec >= 2 && sec <= 4 && Math.random() < 0.3) || on < floorN) {
      const free = this.stickers.find((m) => !m.userData.slot);
      const c = free && H.slots.filter((s) => s.mt === t && s.mask < 0 && !s.kind && !s.tilt && !s.tiny && !s.sticker && s.z > -7.2 && Math.abs(s.x) > 0.7 && !(s.x > 0.6 && s.z < -4.5) && t > s.t0 + s.dur + 0.5);
      // a monument given a paper face turns it to you: in a hall of profiles, only the paper faces look out
      if (c && c.length) { const s = c[Math.floor(Math.random() * c.length)]; s.sticker = free; s.watch = true; free.userData.slot = s; free.userData.roll = (Math.random() - 0.5) * 0.5; free.userData.t = t; }
    }
    this.stickers.forEach((m) => {
      const s = m.userData.slot, im = this.tex[m.userData.name].image;
      m.visible = !!s && s.mt === t && !!im && im.width > 0;
      if (!m.visible) return;
      const k = Math.min(1, (t - m.userData.t) / 0.12), h = 0.2 * (1.25 - 0.25 * k);
      this.lq.setFromAxisAngle(this.lv.set(0, 0, 1), m.userData.roll);
      this.local.compose(this.lv.set(-0.034, 0.35, 0.172), this.lq, this.ls.set(h * im.width / im.height, h / (s.sy || 1), 1));
      m.matrix.multiplyMatrices(s.m, this.local);
    });
    // 3:41: the blast takes the collage too, out from the clock, until the light goes
    const tb = t - H.boomT;
    if (tb >= 0 && tb < 0.38) {
      const k = 1 - Math.exp(-9 * tb);
      for (const m of [this.pro, this.ears, this.pig, this.bagpipe, this.tree, this.worker, this.obit, ...this.headless]) {
        if (!m.visible) continue;
        const dx = m.position.x - H.C.x, dy = m.position.y - H.C.y, dl = Math.hypot(dx, dy) || 1;
        m.position.x += (dx / dl) * 2.5 * k; m.position.y += (dy / dl) * 1.8 * k + 0.6 * k; m.position.z += 1.2 * k;
      }
      wd.rotation.z = k * 0.9;
    }
  }
}

export class Monument extends S3 {
  constructor(cv, o) {
    super(cv, { fov: 30, drag: false, ...o });
    const lite = matchMedia('(pointer: coarse)').matches;
    this.lite = lite;
    this.N = lite ? 110 : 290;
    // fog and dark hide resolution; if frames still run long, resolution goes first, then the number drawn
    this.pr = Math.min(1.5, RS); this.r.setPixelRatio(this.pr);
    this.limit = this.N; this.ft = 1 / 60; this.slow = 0;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 0.95;
    // the clock's dial is the axis of the shot, and it sits where the spiral's centre is on the stage (x 1400)
    this.C = new THREE.Vector3(0, 1.2, 0);
    this.cam.position.set(0, 1.62, 3.1);
    this.cam.lookAt(this.C);
    this.cam.setViewOffset(1920, 1080, -440, 0, 1920, 1080);
    this.scene.fog = new THREE.FogExp2(0x160303, 0.075);
    const L = (this.L = {
      hemi: new THREE.HemisphereLight(0xc4ccd4, 0x200404, 0.35),
      key: new THREE.DirectionalLight(0xe4eaf0, 2.0),
      rim: new THREE.DirectionalLight(0xff2410, 4.5),
      // from below and in front, cold: faint and unmoving in the silence, then it lights the smiles
      under: new THREE.DirectionalLight(0xb8c8d8, 0),
    });
    L.key.position.set(-2.5, 3.5, 4);
    L.rim.position.set(2.5, 1.5, -6);
    L.under.position.set(0.4, -1.6, 2.6);
    L.under.target.position.set(0, -0.2, -6);
    // four lights only: every extra one is paid for on every pixel of every monument
    this.scene.add(L.hemi, L.key, L.rim, L.under, L.under.target);
    // ash, falling (rising once the world turns over)
    const n = lite ? 500 : 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rnd(i) - 0.5) * 14; p[i * 3 + 1] = rnd(i + 0.3) * 6 - 1; p[i * 3 + 2] = -rnd(i + 0.7) * 16 + 2.5; }
    this.ash = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)), new THREE.PointsMaterial({ color: 0xbdb3aa, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ash.frustumCulled = false;
    this.scene.add(this.ash);
    // the floor of the hall: slots on a widening grid behind the clock. Before the turn only the middle ones (the
    // part right of the text) are filled; after it, the whole floor.
    this.slots = [];
    for (let r = 0; r < 26 && this.slots.length < 600; r++) {
      const d = 3.3 + r * 0.95, hw = 0.95 * d;
      for (let x = -hw; x <= hw * 0.42; x += 0.8) {
        const inner = x > -0.25 * d && x < 0.26 * d && (r > 0 || Math.abs(x) > 0.5);   // nothing right under the clock
        const k = rnd(r * 13 + x * 5), x0 = x + (rnd(r * 31 + x) - 0.5) * 0.18;
        this.slots.push({ x0, z0: -d, x: x0, z: -d, inner, xr: x / d, under: r === 0 && Math.abs(x) <= 0.5, key: d + rnd(r * 7 + x * 3) * 6, t0: -1, mask: -1, off: -1, yaw: 0,
          tiny: k < 0.07, stretch: k > 0.95 ? 0.25 + rnd(k * 91) * 0.3 : 0, flip: rnd(k * 57) < 0.3, twitch: rnd(k * 33) < 0.3,
          res: rnd(k * 71) < 0.25 });   // kept for paper stickers: these never get a gas mask
      }
    }
    this.slots.sort((a, b) => a.key - b.key);   // near first, whichever side: when there are too many to draw, the far ones go
    this.slots.length = Math.min(this.slots.length, this.N);
    this.floor = -1.1;   // the heads stand below the clock and climb to the horizon behind it
    this.roll = 0; this.rollTo = 0; this.dolly = 0;
    this.hand = { s: -Math.PI / 2, m: -Math.PI / 2, h: -Math.PI / 2 };
    this.nextTick = 0;
    this.dark = -9; this.darkFor = 0.1;
    this.reach = 0.25; this.boomT = -9;
    // marble chips for the blast at 3:41
    const nb = lite ? 300 : 900, bp = new Float32Array(nb * 3);
    this.chips = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(bp, 3)), new THREE.PointsMaterial({ color: 0xe8e2da, size: 0.045, transparent: true, depthWrite: false }));
    this.chips.frustumCulled = false; this.chips.visible = false;
    this.chipV = new Float32Array(nb * 3);
    this.scene.add(this.chips);
    // the light plays the track before 3:41: a hard white flash at each high click; each note moves the key light
    // along the hall like a hand along a keyboard (low left and deep red, high right and cold white) and pulses it;
    // each low hit punches the red rim light
    this.fx = { flash: -9, flashS: 0, note: -9, noteS: 0, beat: -9, beatS: 0, x: L.key.position.x, col: new THREE.Color() };
    this.base = { key: L.key.color.clone(), keyPos: L.key.position.clone() };
    this.low = new THREE.Color(0xff3a1c); this.high = new THREE.Color(0xe9f0ff);
    this.ready = false;
    this.uSmile = { value: 0 }; this.uMelt = { value: 0 };
    this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.e = new THREE.Euler(); this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion();
    this.ax = new THREE.Vector3(); this.m4 = new THREE.Matrix4(); this.m5 = new THREE.Matrix4(); this.m6 = new THREE.Matrix4();
    this.col = new Collage(this);
    Promise.all(['marble_bust_01', 'mantel_clock_01', 'old_gas_mask'].map(model)).then((g) => { if (!this.dead) this.build(...g); });
  }
  build(bust, clock, mask) {
    const B = meshOf(bust), K = meshOf(clock, 'mantel_clock_01'), G = meshOf(clock, 'mantel_clock_01_glass'), M = meshOf(mask);
    const S = 2.2, q = new THREE.Quaternion();
    // the clock sags: its sides droop and drip as the song goes on, the dial in the middle holds out longest
    const melting = () => {
      const m = K.material.clone();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uMelt = this.uMelt;
        sh.vertexShader = 'uniform float uMelt;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float side = abs(transformed.x) / 0.171;
          transformed.y -= uMelt * pow(side, 2.2) * 0.1;
          transformed.y -= uMelt * 0.06 * smoothstep(0.8, 1.0, sin(transformed.x * 93.0 + 2.0)) * (1.0 - transformed.y / 0.161) * side;`);
      };
      return m;
    };
    // the clock itself glows red from within; the fallen and drifting ones do not
    const km = melting(), kmc = melting();
    km.emissive = new THREE.Color(0xff1a08);
    km.emissiveIntensity = 0;
    this.km = km;
    this.clock = new THREE.Group();
    const body = new THREE.Mesh(K.geometry, km), glass = new THREE.Mesh(G.geometry, G.material);
    glass.position.set(0, 0.0915, 0.0565);
    this.clock.add(body, glass);
    this.clock.scale.setScalar(S);
    this.clockS = S;
    this.clock.position.set(0, this.C.y - 0.0915 * S, -0.0565 * S);
    this.scene.add(this.clock);
    const handMat = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.75, roughness: 0.35, emissive: c, emissiveIntensity: e });
    const mk = (len, w, mat, z) => {
      const g = new THREE.BoxGeometry(w, len, 0.0012); g.translate(0, len * 0.42, 0);
      const h = new THREE.Mesh(g, mat); h.position.set(0, 0.0915, 0.0565 + z); this.clock.add(h); return h;
    };
    this.hands = { h: mk(0.032, 0.005, handMat(0x15100c), 0.0010), m: mk(0.046, 0.0034, handMat(0x15100c), 0.0018), s: mk(0.052, 0.0012, handMat(0xe5482f, 0.6), 0.0026) };
    // the monuments, and the smile they all have after 3:41: the corners of the mouth drawn up a little.
    // Mouth found in the scan: lips meet at (-0.032, 0.286, 0.137), about 0.021 either side.
    const bm = B.material.clone(); bm.color = new THREE.Color(0.97, 0.97, 0.98);
    bm.onBeforeCompile = (sh) => {
      sh.uniforms.uSmile = this.uSmile;
      sh.vertexShader = 'uniform float uSmile;\nvarying float vSeam;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float mdx = (transformed.x + 0.032) / 0.021, mdy = (transformed.y - 0.286) / 0.02;
        float mw = smoothstep(1.8, 0.0, length(vec2(mdx * 0.6, mdy))) * smoothstep(0.095, 0.125, transformed.z);
        float lift = uSmile * mw * min(mdx * mdx, 2.6) * 0.0105;
        transformed.y += lift - uSmile * mw * 0.002;
        transformed.x += uSmile * mw * mdx * 0.006;
        transformed.z += uSmile * mw * 0.003;
        vSeam = uSmile * smoothstep(1.6, 0.4, abs(mdx)) * exp(-pow((transformed.y - 0.286 - lift) / 0.0034, 2.0)) * smoothstep(0.11, 0.13, transformed.z);`);
      sh.fragmentShader = 'varying float vSeam;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= 1.0 - 0.6 * vSeam;');
    };
    // near rows use the scans; the rows far back (a few dozen pixels tall) use light copies
    const bustLo = decimate(B.geometry, 0.015), bustMid = decimate(B.geometry, 0.0085), maskLo = decimate(M.geometry, 0.02), maskMid = decimate(M.geometry, 0.009), clockLo = decimate(K.geometry, 0.008);
    const inst = (geo, mat, n) => { const o = new THREE.InstancedMesh(geo, mat, n); o.count = 0; o.frustumCulled = false; this.scene.add(o); return o; };
    this.busts = inst(B.geometry, bm, this.N);
    this.bustsMid = inst(bustMid, bm, this.N);
    this.bustsFar = inst(bustLo, bm, this.N);
    this.masks = inst(M.geometry, M.material, this.N);
    this.masksFar = inst(maskLo, M.material, this.N);
    // what else comes down, and what drops off the faces at 3:41
    this.clocksDown = inst(clockLo, kmc, 60);
    this.masksDown = inst(maskLo, M.material, this.N + 60);   // the ones on the floor: many, small, in shadow
    // the mask on the bust's face (bust space), fitted by eye against the scans
    this.maskOn = new THREE.Matrix4().compose(new THREE.Vector3(0.012, 0.335, 0.035), q.setFromEuler(new THREE.Euler(-0.12, 0, 0)), new THREE.Vector3(0.62, 0.62, 0.62));
    // clocks without hands drifting up out of the floor
    this.driftN = this.lite ? 6 : 14;
    this.drift = inst(clockLo, kmc, this.driftN);
    this.driftS = Array.from({ length: 14 }, (_, i) => ({ x: (rnd(i * 3) - 0.3) * 9, y: rnd(i * 7) * 6 - 2, z: -4 - rnd(i * 11) * 14, r: rnd(i * 19) * 6 }));
    this.ready = true;
    this.warm();
  }
  // things come down out of the dark, never quite together and never quite the same: each has its own height,
  // weight and delay, turns over on the way, and lands where it lands — mostly upright, some crooked, some on
  // their side, now and then one head first. Most are the bust; some are the clock or a gas mask.
  drop(n, t) {
    const lands = [];
    for (const s of this.slots) {
      if (lands.length >= n) break;
      // left of the hall (under the text) only the near rows, low in the frame: the title and the text stay clear
      if (s.t0 >= 0 || s.under || (s.xr < -0.25 && s.z < -7.5) || (!this.wide && s.xr < -this.reach)) continue;
      const r = Math.random(), f = Math.random();
      s.kind = r < 0.09 ? 1 : r < 0.16 ? 2 : 0;
      s.t0 = t + lands.length * (0.04 + Math.random() * 0.22) + (Math.random() < 0.3 ? 0.15 + Math.random() * 0.5 : 0);
      s.H = 2.5 + Math.random() * 6.5;
      s.dur = Math.sqrt((2 * s.H) / (9.8 * (0.6 + Math.random() * 0.7)));
      s.spin = (Math.random() - 0.5) * 6;
      s.vx = (Math.random() - 0.5) * 0.7; s.vz = (Math.random() - 0.5) * 0.5;   // it keeps a little of its sideways way
      s.axis = Math.random() * Math.PI * 2;
      s.tilt = s.kind ? Math.PI / 2 : f < 0.6 ? 0 : f < 0.85 ? 0.1 + Math.random() * 0.3 : f < 0.95 ? Math.PI / 2 : Math.PI;
      s.yaw = -Math.PI / 2 + (Math.random() - 0.5) * (s.tilt ? 2 : 0.12);
      s.cur = undefined; s.mask = -1; s.off = -1; s.watch = false; s.x = s.x0; s.z = s.z0;
      lands.push(s.t0 - t + s.dur);
    }
    return lands;
  }
  // and the masks go on, one face at a time
  maskUp(n, t) { let k = 0; for (const s of this.slots) { if (k >= n) break; if (s.t0 >= 0 && !s.kind && !s.tilt && s.mask < 0 && !s.sticker && !s.res && t - s.t0 - s.dur > 0.4) { s.mask = t; k++; } } }
  // the lights fail for a moment; when they come back, some of them have turned to you and come closer
  blink(t, n, len = 0.1) {
    this.dark = t; this.darkFor = len;
    const c = this.slots.filter((s) => s.t0 >= 0 && t > s.t0 + s.dur && !s.kind && !s.tilt && !s.watch);
    this.col.blink();
    for (let k = 0; k < n && c.length; k++) {
      const s = c.splice(Math.floor(Math.random() * c.length), 1)[0];
      if (Math.random() < 0.3 && this.slots.filter((o) => o.kind === 3).length < 3) { s.kind = 3; continue; }   // gone; a headless suit stands there instead (three at most)
      s.watch = true;
      s.z = Math.min(-2.6, s.z + 0.6 + Math.random() * 1.2);
      s.x *= 0.85;
    }
  }
  // an event of the track (js/pro-events.js) as it sounds: 'click', 'note' (with its pitch) or 'beat'
  hit(kind, s, m, t) {
    const F = this.fx;
    if (kind === 'click') { F.flash = t; F.flashS = Math.min(1, s / 40); }
    if (kind === 'note') {
      const k = Math.max(0, Math.min(1, (m - 55) / 36));
      F.col.copy(this.low).lerp(this.high, k);
      F.x = -6 + k * 12;
      F.note = t; F.noteS = Math.min(1, s / 20);
    }
    if (kind === 'beat') { F.beat = t; F.beatS = Math.min(1, s / 25); }
    if (kind === 'pluck') { F.pluck = t; F.pluckSide = -(F.pluckSide || 1); }
    this.col.hit(kind, s, t);
  }
  // back before the turn (a seek): the hall empties and starts again
  reset() { this.slots.forEach((s) => { s.t0 = -1; s.mask = -1; s.off = -1; s.cur = undefined; s.watch = false; s.sticker = null; s.x = s.x0; s.z = s.z0; }); }
  get standing() { return this.slots.filter((s) => s.t0 >= 0).length; }
  get masked() { return this.slots.filter((s) => s.mask >= 0).length; }
  fit() { super.fit(); if (this.pr) this.r.setPixelRatio(this.pr); }
  draw(A, t, dt) {
    if (this.dead) return;
    if (this.o.pre) this.o.pre(t);
    this.ft += (dt - this.ft) * 0.05;
    if (this.ft > 1 / 48) {
      this.slow += dt;
      if (this.slow > 1) {
        this.slow = 0;
        if (this.pr > 1) { this.pr = Math.max(1, this.pr - 0.25); this.r.setPixelRatio(this.pr); }
        else this.limit = Math.max(120, Math.floor(this.limit * 0.85));
      }
    } else this.slow = 0;
    const st = this.o.state(), P = st.phase, sec = P[0] === 's' ? +P.slice(1) : 9, B = A.bands;
    const twisted = P === 'twist' || P === 'twist2';
    if (P !== this.phase) { const prev = this.phase; this.phaseT = t; this.phase = P; this.onPhase(P, t); this.col.phase(P, t, prev); }
    const L = this.L;
    // the silences are still: nothing moves but the clock clicking backwards
    const still = P === 'drain' || P === 'end', end = P === 'end';
    const ease = (v, to, k) => v + (to - v) * Math.min(1, dt * k);
    const LV = this.LV || (this.LV = { key: 2.2, rim: 4.5, hemi: 0.35, eye: 0, under: 0 });
    LV.key = ease(LV.key, still ? 0 : twisted ? 1.1 : 2.0, end ? 0.4 : P === 'drain' ? 6 : 2);
    LV.rim = ease(LV.rim, end ? 0 : P === 'drain' ? 1.0 : (twisted ? 6 : 3.5 + st.T * 3) * (0.85 + B.sLow * 0.4), end ? 0.35 : 4);
    LV.hemi = ease(LV.hemi, end ? 0 : P === 'drain' ? 0.05 : twisted ? 0.12 : 0.35, end ? 0.35 : 8);
    LV.eye = ease(LV.eye, end ? 0 : P === 'drain' ? 2.4 : twisted ? 3 : 0, end ? 0.35 : 8);
    LV.under = ease(LV.under, end ? 0 : P === 'drain' ? 0.5 : twisted ? 2.4 : 0, end ? 0.3 : 6);
    // a failing light: for a moment there is nothing but the shapes against the red (intensity only: switching
    // lights off would recompile every material)
    const lit = t >= this.dark && t - this.dark < this.darkFor ? 0 : 1;
    L.key.intensity = LV.key * lit; L.rim.intensity = LV.rim * lit; L.hemi.intensity = LV.hemi * lit;
    L.under.intensity = LV.under * lit;
    // before the turn the light plays the track (see fx): sharp in, quickly out, so each event reads as itself
    const F = this.fx, live = P[0] === 's';
    const fl = live && t - F.flash < 0.04 ? 1 : 0;
    const nk = live ? Math.exp(-(t - F.note) * 9) * (0.5 + 0.5 * F.noteS) : 0, bk = live ? Math.exp(-(t - F.beat) * 8) * (0.4 + 0.6 * F.beatS) : 0;
    L.key.intensity += fl * (3 + 5 * F.flashS) + nk * 3.5;
    L.hemi.intensity += fl * 1.2;
    L.rim.intensity += bk * 6;
    L.key.color.copy(this.base.key).lerp(F.col, Math.min(1, nk * 1.2));
    if (fl) L.key.color.setRGB(1, 1, 1);
    L.key.position.copy(this.base.keyPos); L.key.position.x = this.base.keyPos.x + (F.x - this.base.keyPos.x) * Math.min(1, nk * 1.5);
    // the clock glows red from within in the silence and after the turn
    if (this.km) this.km.emissiveIntensity = LV.eye * 0.07 * lit + fl * 0.3 + bk * 0.15;
    this.scene.fog.density = ease(this.scene.fog.density, end ? 0.2 : P === 'drain' ? 0.12 : twisted ? 0.06 : 0.075 + st.T * 0.03, 3);
    this.reach = [0.25, 0.25, 0.25, 0.5, 0.85][sec] ?? 1;   // from the fourth part the hall spills left, under the text
    this.uSmile.value = (twisted || end) && t > this.boomT + 0.38 ? 1 : 0;
    const melt = [0, 0.05, 0.15, 0.3 + st.T * 0.25, 0.6 + st.T * 0.25][sec] ?? (twisted ? 1.1 : this.uMelt.value);
    this.uMelt.value = ease(this.uMelt.value, melt, 0.4);
    // camera: a slow walk forward as the pressure builds; at 3:58 the hall starts to turn over; the silences hold it
    if (!still) {
      this.dolly += ((sec >= 3 && sec < 9 ? st.T * 0.9 : twisted ? 0.5 : 0) - this.dolly) * Math.min(1, dt * 0.5);
      if (P === 'twist2') this.rollTo += dt * 0.12;
      this.roll += (this.rollTo - this.roll) * Math.min(1, dt * 0.6);
      this.cam.position.set(Math.sin(t * 0.21) * 0.05, 1.62 + Math.sin(t * 0.33) * 0.025, 3.1 - this.dolly);
      this.cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
      this.cam.lookAt(this.C);
      const tb = t - this.boomT;
      if (tb >= 0 && tb < 0.9) {
        const k = Math.exp(-6 * tb);
        this.cam.position.x += (Math.random() - 0.5) * 0.3 * k; this.cam.position.y += (Math.random() - 0.5) * 0.22 * k;
        this.cam.fov = 30 + 24 * Math.exp(-7 * tb);
        this.cam.updateProjectionMatrix();
      } else if (this.cam.fov !== 30) { this.cam.fov = 30; this.cam.updateProjectionMatrix(); }
      this.chipsMove(t, dt);
      const ap = this.ash.geometry.attributes.position.array, fall = (twisted ? -0.18 : 0.2) * dt;
      for (let i = 1; i < ap.length; i += 3) { ap[i] -= fall; if (ap[i] < -1) ap[i] += 6; else if (ap[i] > 5) ap[i] -= 6; }
      this.ash.geometry.attributes.position.needsUpdate = true;
    }
    if (this.ready) { this.clockHands(st, t, dt); this.hall(st, A, t, dt); }
    this.col.draw(st, A, t, dt, t - this.phaseT);
    // under the wall of pictures the hall is only seen through holes that open for a frame: draw it now and then
    const hid = this.o.hidden ? this.o.hidden() : 0;
    if (hid > 1) return;
    if (hid) { this.skip = (this.skip || 0) + 1; if (this.skip % 4) return; }
    this.render();
  }
  onPhase(P, t) {
    if (P === 'twist') {
      // the blast: everything is thrown outward from the clock; then the lights go; when they come back it is all
      // standing where it was, every head turned to you, smiling, and the masks are slipping off
      this.wide = true;
      this.boomT = t;
      this.blink(t, 0, 0.45);
      this.dark = t + 0.38;
      const cp = this.chips.geometry.attributes.position.array, cv = this.chipV;
      for (let i = 0; i < cp.length; i += 3) {
        const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), sp = 2 + Math.random() * 9;
        cp[i] = this.C.x; cp[i + 1] = this.C.y; cp[i + 2] = -0.2;
        cv[i] = Math.sin(b) * Math.cos(a) * sp; cv[i + 1] = Math.cos(b) * sp * 0.8 + 2; cv[i + 2] = Math.sin(b) * Math.sin(a) * sp * 0.6 + 1.5;
      }
      this.chips.visible = true;
      const cam = this.cam.position;
      for (const s of this.slots) {
        if (s.t0 < 0) continue;
        s.watch = !s.kind && !s.tilt;
        if (s.watch) s.cur = Math.atan2(cam.x - s.x, cam.z - s.z);
        if (s.mask >= 0 && s.off < 0) s.off = t + 0.85 + Math.random() * 1.4;
      }
      this.drop(30, t + 0.9);
    }
    if (P[0] === 's') {
      this.rollTo = this.roll = 0;
      this.wide = false;
      if (P === 's0') this.reset();
    }
  }
  chipsMove(t, dt) {
    if (!this.chips.visible) return;
    const tb = t - this.boomT, p = this.chips.geometry.attributes.position.array, v = this.chipV;
    if (tb > 1.8) { this.chips.visible = false; return; }
    for (let i = 0; i < p.length; i += 3) { v[i + 1] -= 7 * dt; p[i] += v[i] * dt; p[i + 1] += v[i + 1] * dt; p[i + 2] += v[i + 2] * dt; }
    this.chips.geometry.attributes.position.needsUpdate = true;
    this.chips.material.opacity = Math.max(0, 1 - tb / 1.8);
  }
  clockHands(st, t, dt) {
    const P = st.phase, sec = P[0] === 's' ? +P.slice(1) : 9, H = this.hand;
    let tgt;
    if (P === 'end') tgt = { ...H };
    else if (P === 'drain') {
      if (t > this.nextTick) { this.nextTick = t + 1; H.s -= Math.PI / 30; H.m -= Math.PI / 120; this.o.onTick && this.o.onTick(); this.tickT = t; }
      tgt = { ...H };
    } else if (P === 'twist') tgt = { s: -Math.PI / 2 - st.tick * (Math.PI / 6), m: -Math.PI / 2 + st.tick * (Math.PI / 4), h: -Math.PI / 2 - st.tick * (Math.PI / 10) };
    else if (P === 'twist2') { H.s -= dt * 5; H.m += dt * 2; H.h -= dt * 0.6; tgt = { ...H }; }
    else {
      const j = sec >= 4 ? st.T * 0.22 : sec >= 3 ? st.T * 0.06 : 0;
      tgt = { s: st.a + (Math.random() - 0.5) * j, m: st.a / 8 + (Math.random() - 0.5) * j * 0.6, h: st.a / 32 };
      if (sec >= 4 && Math.random() < st.T * 0.03) tgt.s -= 0.6;
    }
    const snap = P === 'twist' ? 0.35 : P === 'twist2' || P === 'drain' || P === 'end' ? 1 : 0.25;
    for (const k of ['s', 'm', 'h']) { H[k] += (tgt[k] - H[k]) * snap; this.hands[k].rotation.z = -(H[k] + Math.PI / 2); }
    this.hands.s.material.emissiveIntensity = P === 'drain' ? 2.5 : 0.6;
    if (P !== 'drain' && P !== 'end') this.clock.rotation.y = Math.sin(t * 0.3) * 0.08;
    // each note of the cello (pizzicato, mostly) strikes the clock lightly: it swells a little and tips, one way then
    // the other, and the glow behind its face flares
    const pk = P[0] === 's' ? Math.exp(-(t - (this.fx.pluck ?? -9)) * 13) : 0;
    this.clock.scale.setScalar(this.clockS * (1 + 0.04 * pk));
    this.clock.rotation.z = pk * 0.03 * (this.fx.pluckSide || 1);
    if (this.km) this.km.emissiveIntensity += pk * 0.18;
  }
  hall(st, A, t, dt) {
    const P = st.phase, sec = P[0] === 's' ? +P.slice(1) : 9;
    const { v, sc, e, q, q2, ax, m4, m5, m6 } = this, cam = this.cam.position;
    const twisted = P === 'twist' || P === 'twist2', still = P === 'drain' || P === 'end';
    let n = 0, nf = 0, nmid = 0, nm = 0, nmf = 0, nc = 0, nd = 0;
    // every 8 beats in the middle of the song all heads turn together, one notch
    const notch = sec >= 2 && sec < 9 ? Math.floor((st.kicks || 0) / 8) % 4 : 0;
    const stretchK = sec >= 3 && sec < 9 ? Math.min(1, st.T * 1.2) : 0;
    for (const s of this.slots) {
      if (s.t0 < 0 || t < s.t0 || s.kind === 3) continue;
      if (n + nf + nmid >= this.limit) break;
      const p = Math.min(1, (t - s.t0) / s.dur), landed = p >= 1, tl = t - s.t0 - s.dur;
      const face = Math.atan2(cam.x - s.x, cam.z - s.z);
      if (!still && landed && !s.kind && !s.tilt) {
        let yaw = s.watch ? face : s.yaw + notch * 0.26;
        if (P === 'twist2') yaw = s.flip ? face + Math.PI : face;
        else if (!twisted && !s.watch && sec >= 4 && s.twitch && st.kickHit) yaw = s.yaw + (Math.random() - 0.5) * 0.9;
        if (s.cur === undefined) s.cur = yaw;
        s.cur += (yaw - s.cur) * (s.watch || twisted ? 1 : s.twitch && sec >= 4 ? 0.5 : 0.08);
      }
      const yaw = s.cur ?? s.yaw;
      // on the way down it keeps turning at the same speed right up to the floor, stops dead, and then rocks on its
      // base a few times before it settles; it also keeps a little of its sideways way and slides to a stop
      const rockA = landed && tl < 1.4 ? 0.17 * Math.min(1, s.H / 6) * (s.tilt ? 0.35 : 1) * Math.exp(-4.5 * tl) * Math.sin(15 * tl) : 0;
      const tilt = s.tilt + s.spin * (1 - p);
      const slide = landed ? (1 - Math.exp(-6 * tl)) / 6 : -(s.dur - (t - s.t0));
      const base = s.kind === 1 ? 2.0 : s.kind === 2 ? 1.5 : 2.2 * (s.tiny ? 0.45 : 1), sy = s.kind ? base : base * (1 + s.stretch * stretchK);
      const lift = s.kind ? 0.12 * base : s.tilt > 3 ? 0.515 * sy : s.tilt > 1.5 ? 0.13 * base : 0;
      v.set(s.x + (s.vx || 0) * slide, this.floor + lift * p + (1 - p * p) * s.H, s.z + (s.vz || 0) * slide);
      q.setFromEuler(e.set(0, yaw, 0));
      q2.setFromAxisAngle(ax.set(Math.cos(s.axis), 0, Math.sin(s.axis)), tilt);
      q.premultiply(q2);
      if (rockA) { q2.setFromAxisAngle(ax.set(-Math.sin(s.axis), 0, Math.cos(s.axis)), rockA); q.premultiply(q2); }
      // 3:41: thrown outward from the clock and tumbling, for as long as the light lasts
      const tb = t - this.boomT;
      if (tb >= 0 && tb < 0.38) {
        const k = 1 - Math.exp(-9 * tb), dx = s.x - this.C.x, dz = s.z + 0.5, dl = Math.hypot(dx, dz) || 1, f = Math.max(0.25, 1.6 - dl / 9);
        v.x += (dx / dl) * 2.2 * k * f; v.z += (dz / dl) * 1.2 * k * f; v.y += (1.4 + rnd(s.x0 * 7) * 1.6) * k * f;
        q2.setFromAxisAngle(ax.set(rnd(s.x0) - 0.5, rnd(s.z0) - 0.5, 0.5).normalize(), k * 3.5 * f); q.premultiply(q2);
      }
      sc.set(base, sy, base);
      m4.compose(v, q, sc);
      // three levels of detail: the scan for the two nearest rows, then lighter copies further back
      const far = s.z < -8.6 - this.dolly, mid = !far && s.z < -5.0 - this.dolly;
      if (s.kind === 1) { if (nc < 60) this.clocksDown.setMatrixAt(nc++, m4); continue; }
      if (s.kind === 2) { this.masksDown.setMatrixAt(nd++, m4); continue; }
      if (far) this.bustsFar.setMatrixAt(nf++, m4); else if (mid) this.bustsMid.setMatrixAt(nmid++, m4); else this.busts.setMatrixAt(n++, m4);
      (s.m || (s.m = new THREE.Matrix4())).copy(m4); s.mt = t; s.sy = sy / base;
      if (s.mask < 0 || t < s.mask) continue;
      m5.multiplyMatrices(m4, this.maskOn).multiply(m6.makeScale(1, base / sy, 1));
      if (s.off >= 0 && t >= s.off) {
        // the mask slips off the face and drops to the floor at the bust's feet
        const k = Math.min(1, (t - s.off) / 0.5);
        v.setFromMatrixPosition(m5);
        v.y += (this.floor + 0.08 - v.y) * k * k; v.z += 0.35 * k;
        q.setFromEuler(e.set(-Math.PI / 2 * k * k, yaw + k * 0.6, k * 0.4));
        m5.compose(v, q, sc.setScalar(1.36 * base / 2.2));
        this.masksDown.setMatrixAt(nd++, m5);
      } else if (far) this.masksFar.setMatrixAt(nmf++, m5);
      else this.masks.setMatrixAt(nm++, m5);
    }
    this.busts.count = n; this.bustsMid.count = nmid; this.bustsFar.count = nf; this.masks.count = nm; this.masksFar.count = nmf; this.clocksDown.count = nc; this.masksDown.count = nd;
    [this.busts, this.bustsMid, this.bustsFar, this.masks, this.masksFar, this.clocksDown, this.masksDown].forEach((o) => (o.instanceMatrix.needsUpdate = true));
    // clocks with no hands rise slowly out of the floor from the fourth part on
    const dn = sec >= 3 ? this.driftN : 0;
    for (let i = 0; i < dn; i++) {
      const c = this.driftS[i];
      if (!still) { c.y += dt * (twisted ? 0.35 : 0.12); c.r += dt * 0.15; }
      if (c.y > 5) c.y = -2;
      v.set(c.x, c.y, c.z);
      q.setFromEuler(e.set(c.r * 0.3, c.r, c.r * 0.2));
      m4.compose(v, q, sc.setScalar(2.2));
      this.drift.setMatrixAt(i, m4);
    }
    this.drift.count = dn; this.drift.instanceMatrix.needsUpdate = true;
  }
  destroy() { this.dead = true; super.destroy(); }
}
