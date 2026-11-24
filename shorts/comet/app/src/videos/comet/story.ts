// "Why plane windows are round" — 10 s trial (hook + setting). Timed to voice/words.json:
//   0.00-4.16 "The world's first jet airliner kept falling out of the sky because of the shape of its windows."
//   4.42-9.04 "It's 1952, and Britain's shiny new Comet flies higher and faster than anything with propellers."
// Camera grammar (skill/motion.md): smootherstep glides 18-40 f, every hold creeps (pushK), hard cuts on big jumps,
// flip kicks decaying over 7 f, rolls of 4-5 deg. Everything is a pure function of the frame.
import * as THREE from "three";

export const FPS = 30;
export const TOTAL = 300; // 10.0 s
export const D0 = 0; // ground height (build.ts helpers read it)
export const ALT = 600; // cruising altitude of the sky shots (m)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const T = (f: number) => f / FPS;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: "sky" | "field"; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 130, light: "day", place: "sky", sunAz: 70, sunEl: 40 },
  { id: 2, a: 130, b: 205, light: "day", place: "field", sunAz: 120, sunEl: 42 },
  { id: 3, a: 205, b: TOTAL, light: "day", place: "sky", sunAz: 60, sunEl: 38 },
];
export const FLASH_AT = 130; // white flash after the hook
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- story physics ----------------
/** a plane pose: position, heading along +x, pitch (nose up +), roll */
export type Pose = { p: V3; pitch: number; roll: number };
/** hook: the Comet cruises, then from "falling" (1.64 s) it noses over and drops */
export const FALL0 = 1.55;
export const cometHook = (t: number): Pose => {
  const k = smooth((t - FALL0) / 1.6), dt = Math.max(0, t - FALL0);
  return { p: [-40 + 45 * t, ALT - 9 * dt * dt * 0.5 * smooth(dt / 1.2), 0], pitch: -0.42 * k, roll: 0.18 * k };
};
/** shot 3: the slow propeller airliner, and the Comet overtaking it and climbing away */
export const T3 = 205 / FPS;
export const propPlane = (t: number): Pose => {
  const u = t - T3;
  const wob = u > 1.75 ? 0.12 * Math.sin((u - 1.75) * 9) * Math.exp(-(u - 1.75) * 1.6) : 0; // rocked by the wake
  return { p: [12 * u, ALT - 4 + 0.15 * Math.sin(u * 1.3), 0], pitch: 0.02, roll: wob };
};
export const cometFast = (t: number): Pose => {
  const u = t - T3, x = -70 + 48 * u;
  const climb = Math.max(0, u - 1.2);
  return { p: [x, ALT + 1.5 + 2.6 * climb * climb, 3.2], pitch: 0.06 + 0.16 * smooth((u - 1.2) / 0.8), roll: 0 };
};

/** plane-local offset -> world (heading +x, pitch about z, roll about x) */
const qTmp = new THREE.Quaternion(), eTmp = new THREE.Euler(), vTmp = new THREE.Vector3();
export const poseQuat = (P: Pose, out = new THREE.Quaternion()) => out.setFromEuler(eTmp.set(P.roll, 0, P.pitch, "ZYX"));
export const local = (P: Pose, o: V3): V3 => {
  vTmp.set(...o).applyQuaternion(poseQuat(P, qTmp));
  return [P.p[0] + vTmp.x, P.p[1] + vTmp.y, P.p[2] + vTmp.z];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0 (subject grows ~rate per frame); punch raises it for n frames with 8 f soft edges */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });

// window used for the hook close-up: 4th window behind the door on the camera side (+z), plane-local
export const HOOK_WIN: V3 = [5.2, 0.42, 1.5];
// shot 1: 3/4 side of the cruising Comet -> rides the dive -> cut to the square window (punch on "windows")
const S1a = (f: number) => { const P = cometHook(T(f)); return dolly(local(P, [-13, 4.5, 30]), local(P, [1.5, 0.2, 0]), pushK(f, 0, 0.0025), { fov: 40 }); };
const S1b = (f: number) => { const P = cometHook(T(f)); return dolly(local(P, [-9, 7.5, 21]), local(P, [3, -0.5, 0]), pushK(f, 40, 0.003), { fov: 42, roll: -0.075 }); };
const S1c = (f: number) => { const P = cometHook(T(f)); return dolly(local(P, [HOOK_WIN[0] - 1.6, HOOK_WIN[1] + 0.35, HOOK_WIN[2] + 3.2]), local(P, HOOK_WIN), pushK(f, 95, 0.003, 0.009, 30), { fov: 36, roll: 0.06 }); };
// shot 2 (airfield, 1952): low 3/4 front of the parked Comet with the crew in front; closer on "shiny new Comet"
export const CREW: { x: number; z: number }[] = [{ x: 7.2, z: 9.4 }, { x: 9.0, z: 10.6 }, { x: 5.3, z: 10.9 }];
const S2a = (f: number) => dolly([17.5, 1.55, 25], [5.5, 2.4, 6], pushK(f, 130, 0.0022), { fov: 42 });
const S2b = (f: number) => dolly([13.2, 1.45, 19.8], [6.6, 2.0, 8.5], pushK(f, 172, 0.0025, 0.006, 30), { fov: 40, roll: 0.05 });
// shot 3: alongside the slow propeller airliner; the Comet roars through, the lens whips after it and watches it climb
const S3a = (f: number) => { const P = propPlane(T(f)); return dolly(local({ ...P, roll: 0 }, [-5, 3.2, 22]), local({ ...P, roll: 0 }, [2.5, 0.8, 0]), pushK(f, 205, 0.002), { fov: 44 }); };
const S3b = (f: number) => {
  const C = cometFast(T(f)), Q = propPlane(T(f));
  return { pos: [Q.p[0] - 2, Q.p[1] + 3.0, 21] as V3, look: [C.p[0] + 6, C.p[1] + 1.5, C.p[2]] as V3, fov: 40, roll: -0.07 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 40, dur: 34, s: S1b }, // centred on "falling" (f 49)
    { f: 95, cut: true, s: S1c }, // cut on "shape of its windows"
  ],
  2: [
    { f: 130, s: S2a }, // cut under the flash
    { f: 172, dur: 26, s: S2b }, // centred on "Britain's shiny new" (f 185)
  ],
  3: [
    { f: 205, s: S3a },
    { f: 246, dur: 26, s: S3b }, // whip after the Comet as it passes ("faster", f 229-237 sound; pass ~f 250)
  ],
};

// impact kicks: offset flips sign every frame, decays over 7 f (seconds, gain)
const KICKS: [number, number][] = [[3.77, 0.9], [8.35, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 }, // aerial wide: sharp
  { f: 95, cInf: 14 }, // window close-up: focus = look (the window)
  { f: 130, cInf: 10, focus: () => [CREW[0].x, 1.6, CREW[0].z] }, // crew MS: eyes sharp, Comet + hangar soft
  { f: 205, cInf: 0 }, // aerial
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
