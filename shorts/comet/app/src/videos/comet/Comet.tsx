// "Why plane windows are round" — 10 s trial in the flat-characters-in-a-3D-toon-world style.
// One three.js world (world.ts) posed per frame from story.ts. Post chain (bridge short's): ink -> lens blur pre + main
// -> bloom + NEUTRAL tone map + grade, MSAA 4. A 4-frame white flash after the hook. English 1-2 word captions on top
// (white bold, thin black outline, lower-middle, hard swaps on each word, like the reference) and the voice track.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { World } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { TOTAL, FLASH_AT, FPS, shotAt, dofAt } from "./story";
import CAPS from "./caps.json";

const { fontFamily } = loadFont("normal", { weights: ["800"], subsets: ["latin"] });
export const COMET_FRAMES = TOTAL;

type PostToggles = { ink: boolean; lens: boolean; bloom: boolean; grade: boolean; caps: boolean };
const toggles = (): PostToggles => ({ ink: true, lens: true, bloom: true, grade: true, caps: true, ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={(getInputProps() as { msaa?: number }).msaa ?? 4}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera, s = shotAt(f);
  const target = world.update(s.id, f, cam, scene);
  noInkFallback(world.root);
  if ((getInputProps() as { dbg?: boolean }).dbg) console.log("INNER", f, s.id, JSON.stringify(cam.position), cam.fov, scene.children.length, world.root.parent ? "attached" : "detached", JSON.stringify(target));
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, s.light);
  return (<><primitive object={world.root} dispose={null} />{post}</>);
};

const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;

/** reference captions: one word (sometimes two) at a time, white bold, thin black outline, lower-middle, hard swaps */
const Captions: React.FC = () => {
  const f = useCurrentFrame(), t = f / FPS;
  const c = (CAPS as [number, number, string][]).filter(([s]) => t >= s - 0.03).pop();
  if (!c || t > c[1] + 0.35) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: 1300, width: "100%", textAlign: "center", fontFamily, fontWeight: 800, fontSize: 82,
        color: "#ffffff", WebkitTextStroke: "9px #111111", paintOrder: "stroke fill", textShadow: "0 4px 10px rgba(0,0,0,.45)", letterSpacing: 0.5 }}>{c[2]}</div>
    </AbsoluteFill>
  );
};

export const CometShort: React.FC = () => {
  const f = useCurrentFrame();
  const on = toggles();
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      <ThreeCanvas width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows
        gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }} camera={{ fov: 40, near: 0.1, far: 1500 }}>
        <Inner />
      </ThreeCanvas>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {on.caps && <Captions />}
      <Audio src={staticFile("comet/voice10.wav")} />
    </AbsoluteFill>
  );
};
