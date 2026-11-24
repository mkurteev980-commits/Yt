// Cast as lit flat cards (pool / Actor / Fx are the bridge short's, unchanged in spirit) plus this short's people
// (pilot + 1952 passengers) and effects (window crack, impact burst, smoke puffs, speed lines).
import * as THREE from "three";
import { Pen, bodyFront, fxBurst, fxContact, INK, Outfit, Expr, FrontOpts, SKINS } from "./toon";
import { FPS, CREW, V3 } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>(); private free: Entry[] = []; private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) { const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw }; this.reqs.push(r); return r; }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g)); e.tex.needsUpdate = true; this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.receiveShadow = true; this.mesh.visible = false; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) this.mat.map = t; }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide, fog: false });
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat); this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex; if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 2; }
  }
}

export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number; scale?: number; size: [number, number, number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; quat?: THREE.Quaternion };
export type Stage = { places: Place[]; fx: FxPlace[] };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tier = (d: number): [number, number, number] => d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
const light2D = (cam: CamInfo) => Math.round(Math.atan2(-cam.sun.y, cam.sun.dot(cam.right)) / (Math.PI / 4)) * (Math.PI / 4);

/** blinks: 4-frame half/shut/shut/half every 0.5-2.3 s */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) { const k = f - s; if (k >= 0 && k < 4) return LID[k]; s += Math.round(15 + 54 * hh(i * 31 + n, 13)); }
  return 0;
};

// ---------------- our 1952 people ----------------
export const PILOT: Outfit = { jacket: "#1f2f57", pants: "#1f2f57", boots: INK, hat: "cap", cap: "#1f2f57", buttons: "#e8c45a", moustache: "#5a3b26", skin: SKINS[1] };
export const PASS_M: Outfit = { jacket: "#8a5a3c", pants: "#4b3a30", boots: "#3a2a20", hat: "hair", hair: "#3b2a1e", buttons: "#d9c7a0", skin: SKINS[0] };
export const PASS_W: Outfit = { jacket: "#c4486a", pants: "#3b3f52", boots: "#7a2a3a", hat: "hair", hair: "#a0522d", dress: "#d9a441", skin: SKINS[2] };
const CREW_O = [PILOT, PASS_M, PASS_W];

const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));
const person = (cam: CamInfo, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts): Place => {
  const d = cam.pos.distanceTo(new THREE.Vector3(x, y + 1.2, z)), [w, h, k] = tier(d);
  const f2: FrontOpts = { ...fo, light: light2D(cam), seed: (i * 5 + 3) % 7 + 1 };
  return { key: `F|${i}|${fkey(f2)}`, x, y, z, size: [w, h, k], draw: (p) => bodyFront(p, o, f2) };
};
const contact = (out: Stage, x: number, y: number, z: number) =>
  out.fx.push({ key: "blob|contact|#4a4a66", cw: 128, ch: 128, draw: (p) => fxContact(p, "#4a4a66"), x, y: y + 0.02, z, w: 0.6, h: 0.45, flat: true });

/** shot 2: pilot waves on "Britain's shiny new Comet"; passengers beam, the man looks up at the jet on "Comet" */
export const crew = (cam: CamInfo, t: number, out: Stage) => {
  const LEAD = 2 / FPS;
  CREW.forEach(({ x, z }, i) => {
    const waveOn = i === 0 && t > 5.72 - LEAD;
    const expr: Expr = i === 0 ? (t > 5.72 - LEAD ? "grin" : "smile") : i === 1 ? (t > 6.54 - LEAD ? "laugh" : "smile_closed") : "smile";
    const fo: FrontOpts = { mode: "stand", expr, blink: lidAt(t, i + 10), look: i === 1 && t > 6.54 - LEAD ? -1 : 0,
      wave: waveOn ? q(Math.sin(t * 10), 30) : undefined, facing: i === 2 ? 1 : i === 1 ? -1 : 0 };
    out.places.push(person(cam, i, CREW_O[i], x, 0, z, fo));
    contact(out, x, 0, z);
  });
};

// ---------------- effects ----------------
/** jagged crack running out of a window corner, growing with t (0..1); 600 x 600 canvas, corner at (300, 300) */
export const fxCrack = (p: Pen, t: number) => {
  const g = p.g, branches: [number, number][][] = [
    [[300, 300], [340, 262], [362, 270], [410, 214], [446, 222], [500, 160], [560, 120]],
    [[362, 270], [392, 300], [430, 296], [470, 340]],
    [[410, 214], [404, 170], [430, 132]],
  ];
  g.lineCap = "round"; g.lineJoin = "round";
  branches.forEach((br, bi) => {
    const k = Math.max(0, Math.min(1, t * (bi ? 1.6 : 1.15) - bi * 0.25));
    if (k <= 0) return;
    let total = 0; const segs = br.slice(1).map((q2, i) => { const d = Math.hypot(q2[0] - br[i][0], q2[1] - br[i][1]); total += d; return d; });
    let left = total * k;
    const pts: [number, number][] = [br[0]];
    for (let i = 0; i < segs.length && left > 0; i++) {
      const u = Math.min(1, left / segs[i]); left -= segs[i];
      pts.push([br[i][0] + (br[i + 1][0] - br[i][0]) * u, br[i][1] + (br[i + 1][1] - br[i][1]) * u]);
    }
    for (const [w, c] of [[16 - bi * 4, INK], [6 - bi * 1.5, "#ffffff"]] as const) { p.stroke(pts, w, c); }
  });
};
/** speed streak (white, ink edged) on a 600 x 80 canvas */
const fxStreak = (p: Pen) => { p.line([[40, 40], [560, 40]], "#ffffff", 14); };
/** grey smoke puff (soft) on a 256 x 256 canvas */
const fxSmoke = (p: Pen, k: number) => {
  for (const [x, y, r] of [[96, 140, 64], [156, 116, 72], [170, 164, 56], [120, 98, 50]] as const)
    p.ell(x, y, r, r * 0.85, `rgba(${Math.round(120 + 60 * k)},${Math.round(118 + 60 * k)},${Math.round(126 + 60 * k)},${(0.9 * (1 - k)).toFixed(2)})`, 0);
};

/** hook: smoke puffs trailing from the tail while it falls, crack + burst at the window corner on "windows" */
export const hookFx = (t: number, tailAt: (age: number) => V3, winCorner: V3, winQuat: THREE.Quaternion, out: Stage) => {
  if (t > 1.7) for (let n = 0; n < 9; n++) {
    const age = ((t - 1.7) * 3 + n / 9) % 1, born = t - age * 0.9;
    if (born < 1.7) continue;
    const [x, y, z] = tailAt(age * 0.9), s = 2 + 6 * age;
    out.fx.push({ key: `smoke${q(age, 20)}`, cw: 256, ch: 256, draw: (p) => fxSmoke(p, q(age, 20)), x, y, z, w: s, h: s, soft: true, rot: n });
  }
  const tc = 3.7; // crack starts on "windows" (3.76 s)
  if (t >= tc) {
    const u = q(Math.min(1, (t - tc) / 0.35), 30);
    out.fx.push({ key: `crack${u}`, cw: 600, ch: 600, draw: (p) => fxCrack(p, u), x: winCorner[0], y: winCorner[1], z: winCorner[2], w: 1.0, h: 1.0, quat: winQuat });
    const b = (t - tc) / 0.25;
    if (b < 1) out.fx.push({ key: `burst${q(b, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(b, 30)), x: winCorner[0], y: winCorner[1], z: winCorner[2] + 0.05, w: 0.9, h: 0.9 });
  }
};
/** shot 3: speed streaks flowing back along the Comet */
export const speedFx = (t: number, nose: V3, out: Stage) => {
  for (let n = 0; n < 7; n++) {
    const u = (t * 2.2 + n / 7) % 1;
    out.fx.push({ key: "streak", cw: 600, ch: 80, draw: fxStreak, x: nose[0] - 8 - 30 * u, y: nose[1] + (hh(n) - 0.5) * 6, z: nose[2] + (hh(n, 2) - 0.5) * 5, w: 7 * (1 - u * 0.5), h: 0.28 });
  }
};
