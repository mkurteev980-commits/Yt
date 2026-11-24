// The whole 10 s trial as one three.js scene: sky + clouds + far sea for the flying shots (around y = ALT), the 1952
// airfield (grass, apron, hangar, tower, houses, trees, boarding stairs, windsock) at y = 0, the two aircraft, the
// cast and the effects. update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
// Light rig, sky shader, fog = horizon colour and the camera-relative frozen sun are the bridge short's.
import * as THREE from "three";
import { Batch, V, lam, boxGeo, house, prop } from "./build";
import { ctex, grassHD, stoneHD, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, Stage, crew, hookFx, speedFx } from "./cast";
import { buildComet, buildProp, Aircraft, C_WIN } from "./planes";
import { FPS, ALT, SHOTS, ShotDef, camAt, cometHook, cometFast, propPlane, poseQuat, local, Pose, HOOK_WIN, V3, CREW } from "./story";

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunCache = new Map<number, THREE.Vector3>();
  private clouds: THREE.Mesh[] = [];
  private field = new THREE.Group(); private air = new THREE.Group();
  private cHook: Aircraft; private cField: Aircraft; private cFast: Aircraft; private prop: Aircraft;
  private winQuat = new THREE.Quaternion();

  constructor() {
    const R = this.root;
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target, this.field, this.air);

    // ---- clouds: a ring far away (both places) + a cloud floor and drifting puffs around the flight path ----
    const cmaps = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    const cloud = (x: number, y: number, z: number, w: number, k: number, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cmaps[k % 4], color: new THREE.Color(1.08, 1.08, 1.08), transparent: true, depthWrite: false, fog: true }));
      m.position.set(x, y, z); m.scale.set(w, w / 2, 1); m.layers.set(NOINK); this.clouds.push(m); parent.add(m);
    };
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60; cloud(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d, 130 + (i % 4) * 30, i, this.field); }
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 70; i++) cloud(-260 + rnd() * 900, ALT - 38 - rnd() * 30, -260 + rnd() * 300 - (rnd() < 0.3 ? 0 : 40), 60 + rnd() * 90, i, this.air); // floor, mostly behind the planes
    for (let i = 0; i < 24; i++) cloud(-200 + rnd() * 700, ALT - 6 + rnd() * 26, -60 - rnd() * 180, 30 + rnd() * 50, i + 3, this.air); // level with us, behind
    for (let i = 0; i < 6; i++) cloud(-120 + i * 70 + rnd() * 30, ALT - 30 - rnd() * 10, 40 + rnd() * 30, 40 + rnd() * 25, i + 1, this.air); // below the lens
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), twoTone(new THREE.MeshLambertMaterial({ color: "#2f74b5" })));
    sea.rotation.x = -Math.PI / 2; sea.position.y = ALT - 420; this.air.add(sea);

    // ---- airfield (static batch) ----
    const b = new Batch();
    const grass = lam("grassHD", () => ({ map: grassHD() }));
    const concrete = lam("concreteHD", () => ({ map: stoneHD("concreteHD", ["#d9d4c8", "#d2ccbf", "#ddd8cd", "#cfc8ba"], "#b3ab9d") }));
    const corr = lam("corrugated", () => ({ map: ctex("corrugated", 512, 512, (g) => {
      g.fillStyle = "#9aa6ae"; g.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 16) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x, 0, 6, 512); g.fillStyle = "rgba(30,40,55,0.18)"; g.fillRect(x + 10, 0, 4, 512); }
    }) }));
    const roofG = lam("hangarRoof", () => ({ color: "#6e7e8c", side: THREE.DoubleSide }));
    const doorM = lam("hangarDoor", () => ({ color: "#2e3a4a" }));
    const towerM = lam("towerWall", () => ({ color: "#efe7d6" }));
    const glassM = lam("towerGlass", () => ({ color: "#2b4566" }));
    const red = lam("redTrim", () => ({ color: "#c0453a" }));
    const steps = lam("steps", () => ({ color: "#d8dde3" }));
    const ground = new THREE.PlaneGeometry(1200, 1200); ground.rotateX(-Math.PI / 2);
    const guv = ground.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 300, guv.getY(i) * 300);
    b.add(ground, grass);
    b.add(boxGeo(V(-60, -0.02, -40), V(60, 0.02, 24), 8), concrete); // apron
    // hangar: barrel roof over a corrugated box, dark doors facing the apron (+z)
    const hx = -24, hz = -58, hw = 44, hd = 34, hh = 11;
    b.add(boxGeo(V(hx - hw / 2, 0, hz - hd / 2), V(hx + hw / 2, hh, hz + hd / 2), 4), corr);
    const barrel = new THREE.CylinderGeometry(hw / 2, hw / 2, hd, 32, 1, false, -Math.PI / 2, Math.PI); barrel.rotateX(Math.PI / 2); barrel.scale(1, 0.32, 1);
    b.add(barrel, roofG, new THREE.Matrix4().makeTranslation(hx, hh, hz));
    b.add(boxGeo(V(hx - hw / 2 + 3, 0, hz + hd / 2), V(hx + hw / 2 - 3, hh - 1.5, hz + hd / 2 + 0.12)), doorM);
    b.add(boxGeo(V(hx - hw / 2, hh - 1.2, hz + hd / 2), V(hx + hw / 2, hh - 0.4, hz + hd / 2 + 0.2)), red);
    // control tower
    const tx = 34, tz = -44;
    b.add(boxGeo(V(tx - 5, 0, tz - 4), V(tx + 5, 7, tz + 4), 3), towerM);
    b.add(boxGeo(V(tx - 2.6, 7, tz - 2.6), V(tx + 2.6, 12, tz + 2.6), 3), towerM);
    b.add(boxGeo(V(tx - 3, 12, tz - 3), V(tx + 3, 14.4, tz + 3)), glassM);
    b.add(boxGeo(V(tx - 3.4, 14.4, tz - 3.4), V(tx + 3.4, 15, tz + 3.4)), red);
    // boarding stairs at the forward door (+z side, x ~ 9.3)
    for (let k = 0; k < 9; k++) b.add(boxGeo(V(8.6, k * 0.3, 1.9 + (8 - k) * 0.32), V(10.0, k * 0.3 + 0.12, 2.25 + (8 - k) * 0.32)), steps);
    b.add(boxGeo(V(8.5, 0, 1.8), V(8.62, 3.0, 4.9)), steps); b.add(boxGeo(V(9.98, 0, 1.8), V(10.1, 3.0, 4.9)), steps);
    // town beyond the field + trees + windsock
    let si = 0;
    for (let x = -90; x <= 110; x += 13) house(b, x + (si % 3) * 1.5, -105 - (si % 2) * 8, 0, 9 + (si % 3), 7, 6 + (si % 4) * 1.2, si++, 0);
    const trees = ["tree_oak", "tree_default", "tree_fat", "tree_cone", "tree-high-round"];
    for (let i = 0; i < 26; i++) prop(b, {}, trees[i % 5], -110 + i * 9 + (i % 3) * 2, 0, -90 - (i % 4) * 3, 7 + (i % 3) * 2, i);
    for (let i = 0; i < 8; i++) prop(b, {}, "plant_bushLarge", 40 + i * 6, 0, 30 + (i % 2) * 3, 1.6, i);
    b.add(boxGeo(V(46.9, 0, 12.9), V(47.1, 7, 13.1)), red);
    const sock = new THREE.ConeGeometry(0.55, 3.2, 14, 1, true); sock.rotateZ(Math.PI / 2);
    b.add(sock, lam("sock", () => ({ color: "#ee7a2c", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(48.6, 6.6, 13));
    b.build(this.field);

    // ---- aircraft ----
    this.cHook = buildComet(); this.cField = buildComet(); this.cFast = buildComet(); this.prop = buildProp();
    this.air.add(this.cHook.root, this.cFast.root, this.prop.root);
    this.field.add(this.cField.root);
    this.cField.root.position.set(0, 3.05, 0); // parked on its gear (gear legs below)
    const gearM = lam("gear", () => ({ color: "#3a404c" })), tyre = lam("tyre", () => ({ color: "#1d2028" }));
    for (const [x, z] of [[11.5, 0], [-1.2, 3.4], [-1.2, -3.4]] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.3, 10), gearM); leg.position.set(x, -1.9, z); this.cField.root.add(leg);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 18), tyre); w.rotation.x = Math.PI / 2; w.position.set(x, -2.5, z); this.cField.root.add(w);
      leg.castShadow = w.castShadow = true;
    }
    // hi-res decal for the hook window (the painted skin is too coarse at 1.5 m)
    const a = THREE.MathUtils.degToRad(C_WIN.ang), n = V(0, Math.sin(a), Math.cos(a));
    this.winQuat.setFromUnitVectors(V(0, 0, 1), n);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(C_WIN.size + 0.16, C_WIN.size + 0.16), twoTone(new THREE.MeshPhongMaterial({ map: winTex(), transparent: true, alphaTest: 0.3, specular: "#ffffff", shininess: 80 }), 0.15));
    decal.position.set(HOOK_WIN[0], 1.5 * Math.sin(a), 1.5 * Math.cos(a)).addScaledVector(n, 0.03);
    decal.quaternion.copy(this.winQuat);
    this.cHook.root.add(decal);
    R.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !m.layers.isEnabled(NOINK)) { m.castShadow = m.castShadow || false; m.receiveShadow = true; } });
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) { const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1; fx += x / n; fz += z / n; }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  private pose(a: Aircraft, P: Pose) { a.root.position.set(...P.p); poseQuat(P, a.root.quaternion); }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], K = LOOK[s.light];
    // ---- aircraft first (the camera rides them) ----
    const sky = s.place === "sky";
    this.field.visible = !sky; this.air.visible = sky;
    this.cHook.root.visible = id === 1; this.cFast.root.visible = this.prop.root.visible = id === 3;
    if (id === 1) this.pose(this.cHook, cometHook(t));
    if (id === 3) {
      this.pose(this.cFast, cometFast(t)); this.pose(this.prop, propPlane(t));
      this.prop.props.forEach((h, i) => { h.rotation.x = t * 31 + i; });
    }
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    // ---- light rig ----
    const sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 60);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    this.fog.near = sky ? 60 : L.fogNear; this.fog.far = sky ? 520 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const info = { pos: cam.position, right, sun: sunDir };
    const st: Stage = { places: [], fx: [] };
    if (id === 1) {
      const P = cometHook(t);
      const a = THREE.MathUtils.degToRad(C_WIN.ang), h = C_WIN.size / 2;
      const corner = local(P, [HOOK_WIN[0] + h, 1.5 * Math.sin(a) + h * Math.cos(a) + 0.05 * Math.sin(a), 1.5 * Math.cos(a) - h * Math.sin(a) + 0.05 * Math.cos(a)]);
      const q = poseQuat(P).multiply(this.winQuat);
      hookFx(t, (age) => local(cometHook(t - age), [-15.5, 0.2, 0]), corner, q, st);
    }
    if (id === 2) crew(info, t, st);
    if (id === 3) speedFx(t, local(cometFast(t), [15, 0, 0]), st);
    let ai = 0; const used: Actor[] = [];
    for (const p of st.places) {
      const a = this.actor(ai++), [w, h, k] = p.size;
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true; a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, Math.atan2(cam.position.x - p.x, cam.position.z - p.z), 0);
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0; const fused: Fx[] = [];
    for (const p of st.fx) {
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft); e2.mesh.visible = true; e2.mesh.position.set(p.x, p.y, p.z);
      if (p.quat) e2.mesh.quaternion.copy(p.quat);
      else if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    void CREW;
    return focus;
  }
}

/** the hook window up close: bezel, navy glass with a cloud reflection and a highlight; corners deliberately tight */
const winTex = () => ctex("hookWindow", 512, 512, (g) => {
  const pad = 54, r = 30;
  g.fillStyle = "#e8ecf1"; g.beginPath(); g.roundRect(8, 8, 496, 496, r + 26); g.fill();
  g.strokeStyle = "#8d98a6"; g.lineWidth = 6; g.stroke();
  const gl = g.createLinearGradient(0, pad, 0, 512 - pad); gl.addColorStop(0, "#1c3156"); gl.addColorStop(1, "#4a78ae");
  g.fillStyle = gl; g.beginPath(); g.roundRect(pad, pad, 512 - 2 * pad, 512 - 2 * pad, r); g.fill();
  g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(200, 330, 90, 34, 0, 0, Math.PI * 2); g.ellipse(270, 315, 70, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.28)"; g.beginPath(); g.moveTo(130, 70); g.lineTo(200, 70); g.lineTo(120, 440); g.lineTo(80, 440); g.fill();
  g.strokeStyle = "#151c2a"; g.lineWidth = 10; g.beginPath(); g.roundRect(pad, pad, 512 - 2 * pad, 512 - 2 * pad, r); g.stroke();
});
export const loadKit = async () => ({});
export type { V3 };
