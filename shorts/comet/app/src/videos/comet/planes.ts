// Our two aircraft, built in code (no model files): the de Havilland-style Comet jet (silver, blue cheatline, big
// almost-square windows, engines buried in swept wings) and a chunky propeller airliner for contrast. Plane-local
// axes: nose toward +x, up +y, the camera side of the hook shot is +z. Every surface goes through twoTone (shade.ts)
// so it takes the same two-tone sun / ink look as the rest of the world.
import * as THREE from "three";
import { ctex } from "./paint";
import { twoTone } from "./shade";

const R = 1.5; // Comet fuselage radius (m)
export const C_TAIL = -16, C_NOSE = 15.3;
/** Comet fuselage radius along the body (x = station in metres) */
const cometR = (x: number) => {
  if (x < -11) { const u = (x - C_TAIL) / 5; return 0.28 + (R - 0.28) * Math.sin((Math.PI / 2) * Math.max(0, u)) ** 0.9; }
  if (x < 10.5) return R;
  const u = (x - 10.5) / (C_NOSE - 10.5); return R * Math.sqrt(Math.max(0, 1 - u ** 2.2));
};
export const C_WINDOWS = Array.from({ length: 11 }, (_, i) => -6.8 + 1.2 * i); // x of each cabin window (both sides)
export const C_WIN = { size: 0.5, rad: 0.07, ang: 16 }; // window edge (m), corner radius (m), angle above the side line (deg)

const phong = (o: THREE.MeshPhongMaterialParameters) => twoTone(new THREE.MeshPhongMaterial(o), 0.15);
const lamb = (o: THREE.MeshLambertMaterialParameters) => twoTone(new THREE.MeshLambertMaterial(o));

/** lathe around the local x axis; u = angle (0 at the top, 0.25 = +z side), v = station (0 tail .. 1 nose) */
const latheX = (rOf: (x: number) => number, x0: number, x1: number, n = 140, seg = 48) => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; pts.push(new THREE.Vector2(Math.max(0.001, rOf(x)), x)); }
  const g = new THREE.LatheGeometry(pts, seg, -Math.PI / 2, Math.PI * 2);
  g.rotateZ(-Math.PI / 2); // lathe +y (station) -> +x
  return g;
};

/** painted skin: 2048 around x 4096 along (canvas x = u, canvas y = 1 - v) */
const cometSkin = () => ctex("cometSkin", 2048, 4096, (g) => {
  const W = 2048, H = 4096, L = C_NOSE - C_TAIL;
  const row = (x: number) => (1 - (x - C_TAIL) / L) * H; // station -> canvas y
  const col = (deg: number) => (deg / 360) * W; // angle from the top, clockwise toward +z -> canvas x
  // base: white top, polished silver lower half
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "#f4f5f7"); gr.addColorStop(0.17, "#f1f2f4"); gr.addColorStop(0.24, "#cfd5dc"); gr.addColorStop(0.5, "#b9c0c9");
  gr.addColorStop(0.76, "#cfd5dc"); gr.addColorStop(0.83, "#f1f2f4"); gr.addColorStop(1, "#f4f5f7");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // panel seams (soft) + rivet rows
  g.strokeStyle = "rgba(70,80,95,0.22)"; g.lineWidth = 3;
  for (let x = C_TAIL + 1.5; x < C_NOSE - 1; x += 1.6) { g.beginPath(); g.moveTo(0, row(x)); g.lineTo(W, row(x)); g.stroke(); }
  g.fillStyle = "rgba(60,70,85,0.25)";
  for (let x = C_TAIL + 1.5; x < C_NOSE - 1; x += 1.6) for (let u = 0; u < W; u += 14) g.fillRect(u, row(x) - 10, 3, 3);
  // cheatline: dark blue band through the windows, thin pinstripe under it, both sides
  for (const side of [1, -1]) {
    const c = side > 0 ? 90 - C_WIN.ang : 270 + C_WIN.ang;
    const band = (d0: number, d1: number, fill: string) => { g.fillStyle = fill; g.fillRect(col(Math.min(c + side * d0, c + side * d1)), row(C_NOSE - 1.2), Math.abs(col(d1) - col(d0)), row(C_TAIL + 3.5) - row(C_NOSE - 1.2)); };
    band(-8, 8, "#1d3f7a");
    band(10, 11.5, "#1d3f7a");
    // windows: big, almost square, tight corners (navy glass, thin bright bezel)
    const wpx = col(C_WIN.size / (2 * Math.PI * R) * 360), hpx = (C_WIN.size / L) * H, rr = (C_WIN.rad / C_WIN.size) * wpx;
    for (const x of C_WINDOWS) {
      const cx = col(c), cy = row(x);
      g.save(); g.translate(cx, cy);
      g.fillStyle = "#e9edf2"; g.beginPath(); g.roundRect(-wpx / 2 - 9, -hpx / 2 - 6, wpx + 18, hpx + 12, rr + 6); g.fill();
      const gl = g.createLinearGradient(0, -hpx / 2, 0, hpx / 2); gl.addColorStop(0, "#22385e"); gl.addColorStop(1, "#3e6aa0");
      g.fillStyle = gl; g.beginPath(); g.roundRect(-wpx / 2, -hpx / 2, wpx, hpx, rr); g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(-wpx * 0.28, -hpx * 0.4, wpx * 0.12, hpx * 0.8);
      g.restore();
    }
    // passenger door (forward, both sides) and cockpit glazing
    const dx = col(c - side * 2), dy = row(9.3), dw = col(9) - col(0), dh = (1.0 / L) * H;
    g.strokeStyle = "#5d6878"; g.lineWidth = 5; g.beginPath(); g.roundRect(dx - dw / 2, dy - dh / 2, dw, dh, 18); g.stroke();
    g.fillStyle = "#18263f";
    for (const k of [0, 1]) { g.beginPath(); g.roundRect(col(c - side * (22 + k * 15)) - (side > 0 ? 70 : 0), row(13.25 + k * 0.1), 70, (0.55 / L) * H, 10); g.fill(); }
  }
  // belly: slightly darker
  g.fillStyle = "rgba(90,100,115,0.12)"; g.fillRect(col(150), 0, col(60), H);
});

const shapeGeo = (pts: [number, number][], depth: number) => {
  const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.35, bevelSize: depth * 0.35, bevelSegments: 2 });
  g.translate(0, 0, -depth / 2);
  return g;
};
/** flat wing panel lying in the x-z plane (planform given as [x, span] pairs, span along +z), thickness th */
const wingGeo = (pts: [number, number][], th: number, mirror = false) => {
  // planform drawn in (x, -span) so that rotateX(+90) lays the span along +z; the mirrored side is the same panel
  // flipped by scale(1, 1, -1) with the triangle winding restored
  const g = shapeGeo(pts.map(([x, s]) => [x, -s]), th);
  g.rotateX(Math.PI / 2);
  if (mirror) {
    g.scale(1, 1, -1);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) for (let k = 0; k < 3; k++) { const a = pos.getComponent(i, k); pos.setComponent(i, k, pos.getComponent(i + 2, k)); pos.setComponent(i + 2, k, a); }
    for (const name of ["normal", "uv"]) { const at = g.attributes[name] as THREE.BufferAttribute; if (!at) continue;
      for (let i = 0; i < at.count; i += 3) for (let k = 0; k < at.itemSize; k++) { const a = at.getComponent(i, k); at.setComponent(i, k, at.getComponent(i + 2, k)); at.setComponent(i + 2, k, a); } }
  }
  g.computeVertexNormals();
  return g;
};

export type Aircraft = { root: THREE.Group; props: THREE.Object3D[] };

export const buildComet = (): Aircraft => {
  const root = new THREE.Group();
  const skin = cometSkin(); skin.anisotropy = 16;
  const body = phong({ map: skin, specular: "#9aa3ad", shininess: 55 });
  const metal = phong({ color: "#c4cad2", specular: "#9aa3ad", shininess: 50 });
  const white = lamb({ color: "#eef0f3" });
  const dark = lamb({ color: "#1b2333" });
  const navy = lamb({ color: "#1d3f7a" });
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
  add(latheX(cometR, C_TAIL, C_NOSE), body);
  // swept low wings (planform from the root at the belly), engines buried in the roots
  const wing: [number, number][] = [[3.4, 0], [-3.2, 17.5], [-5.5, 17.5], [-4.6, 0]];
  for (const m of [false, true]) {
    const w = add(wingGeo(wing, 0.34, m), metal); w.position.set(0, -0.85, 0);
    for (const s of [2.05, 3.05]) {
      const z = m ? -s : s;
      const nac = new THREE.CylinderGeometry(0.48, 0.48, 1.6, 20); nac.rotateZ(Math.PI / 2);
      add(nac, metal).position.set(3.25 - s * 0.26, -0.72, z);
      const hole = new THREE.CircleGeometry(0.36, 20); hole.rotateY(Math.PI / 2);
      add(hole, dark).position.set(4.06 - s * 0.26, -0.72, z);
      const ex = new THREE.CylinderGeometry(0.3, 0.36, 0.5, 16); ex.rotateZ(Math.PI / 2);
      add(ex, dark).position.set(-5.0, -0.78, m ? -s * 0.8 : s * 0.8);
    }
  }
  // tail fin + tailplanes (navy fin band)
  add(shapeGeo([[-10.5, 1.0], [-14.6, 6.6], [-16.3, 6.6], [-15.9, 0.6]], 0.26), white);
  const band = add(shapeGeo([[-13.6, 4.3], [-14.9, 6.0], [-16.25, 6.0], [-16.1, 4.3]], 0.3), navy); band.position.z = 0;
  const tp: [number, number][] = [[-12.4, 0], [-14.8, 5.2], [-16.1, 5.2], [-15.6, 0]];
  for (const m of [false, true]) add(wingGeo(tp, 0.2, m), metal).position.set(0, 0.95, 0);
  return { root, props: [] };
};

/** chunky twin-engine propeller airliner, cream and olive, nose +x */
export const buildProp = (): Aircraft => {
  const root = new THREE.Group(), props: THREE.Object3D[] = [];
  const r = 1.15, x0 = -9.5, x1 = 8.5;
  const rOf = (x: number) => x < -5 ? 0.25 + (r - 0.25) * Math.sin((Math.PI / 2) * Math.max(0, (x - x0) / 4.5)) : x < 6 ? r : r * Math.sqrt(Math.max(0, 1 - ((x - 6) / (x1 - 6)) ** 2));
  const skin = ctex("propSkin", 1024, 2048, (g) => {
    g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 1024, 2048);
    g.fillStyle = "#6f7d43"; g.fillRect(256 - 70, 0, 140, 2048); g.fillRect(768 - 70, 0, 140, 2048); // olive cheatlines
    g.fillStyle = "#8d9a5a"; g.fillRect(380, 0, 264, 2048); // olive belly
    for (const c of [256 - 35, 768 + 35]) for (let i = 0; i < 9; i++) { // small round-ish windows
      const y = 2048 * (1 - (-4.5 + i * 1.05 - x0) / (x1 - x0));
      g.fillStyle = "#e9edf2"; g.beginPath(); g.ellipse(c, y, 30, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2b4266"; g.beginPath(); g.ellipse(c, y, 22, 15, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#1c2638"; for (const c of [256 - 60, 768 + 60]) g.fillRect(c - 40, 2048 * (1 - (7.0 - x0) / (x1 - x0)), 80, 60);
  });
  const body = phong({ map: skin, specular: "#776f5a", shininess: 18 });
  const cream = lamb({ color: "#efe4c8" }), olive = lamb({ color: "#6f7d43" }), dark = lamb({ color: "#1e2430" });
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; root.add(o); return o; };
  add(latheX(rOf, x0, x1, 90, 40), body);
  const wing: [number, number][] = [[2.6, 0], [1.6, 13], [-0.2, 13], [-1.2, 0]];
  for (const m of [false, true]) {
    add(wingGeo(wing, 0.3, m), cream).position.set(0, -0.55, 0);
    const z = m ? -4.2 : 4.2;
    const nac = new THREE.CylinderGeometry(0.62, 0.5, 3.2, 20); nac.rotateZ(Math.PI / 2);
    add(nac, olive).position.set(2.4, -0.4, z);
    const spin = new THREE.ConeGeometry(0.3, 0.6, 16); spin.rotateZ(-Math.PI / 2);
    add(spin, dark).position.set(4.3, -0.4, z);
    // propeller: three blades on a hub, spun per frame (world.ts), plus a faint motion disc
    const hub = new THREE.Group(); hub.position.set(4.12, -0.4, z);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.55, 0.22).translate(0, 0.78, 0), dark); b.rotation.x = (k * Math.PI * 2) / 3; hub.add(b); }
    root.add(hub); props.push(hub);
  }
  add(shapeGeo([[-6.2, 0.8], [-8.6, 4.4], [-9.7, 4.4], [-9.6, 0.6]], 0.22), olive);
  const tp: [number, number][] = [[-7.6, 0], [-8.4, 3.6], [-9.4, 3.6], [-9.5, 0]];
  for (const m of [false, true]) add(wingGeo(tp, 0.18, m), cream).position.set(0, 0.5, 0);
  return { root, props };
};
