import React from 'react';
import {
  AbsoluteFill, Img, Sequence, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Montserrat';

const { fontFamily } = loadFont('normal', { weights: ['900'], subsets: ['cyrillic', 'latin'] });

export const FPS = 30;
export const TOTAL = 318; // 10.6 c
const f = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/* ---------- слои ---------- */
type CamProps = { z0: number; z1: number; fx: number; fy: number; dur: number; children: React.ReactNode; shake?: number };
const Camera: React.FC<CamProps> = ({ z0, z1, fx, fy, dur, children, shake = 0 }) => {
  const fr = useCurrentFrame();
  const z = interpolate(fr, [0, dur], [z0, z1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const sx = shake ? Math.sin(fr * 2.3) * shake : 0, sy = shake ? Math.cos(fr * 1.9) * shake : 0;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px,${sy}px) scale(${z})`, transformOrigin: `${fx * 100}% ${fy * 100}%` }}>
      {children}
    </AbsoluteFill>
  );
};
const Layer: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <AbsoluteFill style={style}><Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></AbsoluteFill>
);

/* персонаж: дыхание, покачивание, «поп» при появлении, опорная точка — ноги */
type CharProps = {
  src: string; foot: [number, number]; popAt?: number; hopAt?: number[]; pulseAt?: number[];
  sway?: number; jitter?: number; enterX?: number; parallax?: number; dur: number;
};
const Character: React.FC<CharProps> = ({ src, foot, popAt = 0, hopAt = [], pulseAt = [], sway = 1.2, jitter = 0, enterX = 0, parallax = 0.05, dur }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: fr - popAt, fps, config: { damping: 9, stiffness: 180, mass: 0.6 } });
  const breath = Math.sin((fr / fps) * 2.6 * Math.PI * 0.5) * 0.012;
  let sy = 1 + breath + (1 - pop) * -0.12;
  let sx = 1 - breath * 0.6 + (1 - pop) * 0.1;
  let ty = 0;
  for (const h of hopAt) {
    const p = (fr - h) / 10;
    if (p > 0 && p < 1) { ty -= Math.sin(p * Math.PI) * 55; }
    const land = (fr - h - 10) / 6;
    if (land > 0 && land < 1) { const k = Math.sin(land * Math.PI); sy -= 0.08 * k; sx += 0.06 * k; }
  }
  for (const p0 of pulseAt) {
    const p = spring({ frame: fr - p0, fps, config: { damping: 7, stiffness: 260, mass: 0.5 } });
    const k = fr >= p0 ? Math.sin(Math.min(1, (fr - p0) / 8) * Math.PI) * (1 - Math.min(1, (fr - p0) / 16)) : 0;
    sx += k * 0.07 * p; sy += k * 0.07 * p;
  }
  const rot = Math.sin((fr / fps) * 1.7) * sway;
  const jx = jitter ? Math.sin(fr * 3.1) * jitter : 0, jy = jitter ? Math.cos(fr * 2.7) * jitter * 0.5 : 0;
  const ex = enterX * (1 - pop);
  const pz = interpolate(fr, [0, dur], [1, 1 + parallax], clamp);
  return (
    <AbsoluteFill style={{ transform: `scale(${pz})`, transformOrigin: `${foot[0] * 100}% ${foot[1] * 100}%` }}>
      <AbsoluteFill style={{
        transform: `translate(${ex + jx}px, ${ty + jy}px) rotate(${rot}deg) scale(${sx}, ${sy})`,
        transformOrigin: `${foot[0] * 100}% ${foot[1] * 100}%`,
        filter: 'drop-shadow(0 18px 18px rgba(0,0,0,.28))',
      }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Flash: React.FC<{ at: number; color?: string; max?: number; len?: number }> = ({ at, color = '255,255,255', max = 0.5, len = 6 }) => {
  const fr = useCurrentFrame();
  const o = interpolate(fr, [at, at + len], [max, 0], clamp);
  return fr >= at ? <AbsoluteFill style={{ background: `rgba(${color},${o})` }} /> : null;
};

/* ---------- сцены ---------- */
const S = {
  s1: [0, f(1.4)], s2: [f(1.4), f(2.3)], s3: [f(2.3), f(4.6)], s4: [f(4.6), f(6.0)],
  s5: [f(6.0), f(7.5)], s6: [f(7.5), f(9.0)], s7: [f(9.0), TOTAL],
} as const;
const len = (k: keyof typeof S) => S[k][1] - S[k][0];

const Shot1 = () => (
  <Camera z0={1.0} z1={1.07} fx={0.45} fy={0.35} dur={len('s1')}>
    <Layer src="s1_bg.jpg" />
    <Character src="s1_char.png" foot={[0.4, 0.92]} popAt={1} dur={len('s1')} parallax={0.06} />
  </Camera>
);
const Shot2 = () => (
  <Camera z0={1.05} z1={1.16} fx={0.4} fy={0.3} dur={len('s2')}>
    <Layer src="s2_bg.jpg" />
    <Character src="s2_char.png" foot={[0.85, 1.0]} popAt={0} enterX={120} sway={2} dur={len('s2')} parallax={0.04} />
  </Camera>
);
const Shot3 = () => {
  const fr = useCurrentFrame();
  const pan = interpolate(fr, [0, len('s3')], [40, -30], clamp);
  return (
    <Camera z0={1.12} z1={1.03} fx={0.55} fy={0.4} dur={len('s3')}>
      <Layer src="s3_bg.jpg" style={{ transform: `translateX(${pan * 0.6}px)` }} />
      <AbsoluteFill style={{ transform: `translateX(${pan}px)` }}>
        <Character src="s3_char.png" foot={[0.35, 0.93]} popAt={0} hopAt={[f(0.9)]} pulseAt={[f(3.65 - 2.3)]} dur={len('s3')} parallax={0.05} />
      </AbsoluteFill>
    </Camera>
  );
};
const Shot4 = () => {
  const fr = useCurrentFrame();
  const hit = f(5.45 - 4.6);
  const sh = fr > hit ? 10 * Math.max(0, 1 - (fr - hit) / 12) : 0;
  const glow = 0.5 + 0.5 * Math.sin(fr * 0.6);
  return (
    <>
      <Camera z0={1.0} z1={1.16} fx={0.5} fy={0.3} dur={len('s4')} shake={sh}>
        <Layer src="s4_bg.jpg" style={{ filter: `saturate(${1 + glow * 0.3}) brightness(${1 + (fr > hit ? 0.08 * glow : 0)})` }} />
      </Camera>
      <Flash at={hit} color="229,57,53" max={0.32} len={10} />
    </>
  );
};
const Shot5 = () => {
  const fr = useCurrentFrame();
  const punch = f(6.55 - 6.0);
  const pz = interpolate(fr, [punch, punch + 4], [1, 1.22], clamp);
  const sh = fr > punch ? 14 * Math.max(0, 1 - (fr - punch) / 20) : 0;
  return (
    <>
      <Camera z0={1.03} z1={1.08} fx={0.35} fy={0.28} dur={len('s5')} shake={sh}>
        <AbsoluteFill style={{ transform: `scale(${pz})`, transformOrigin: '35% 25%' }}>
          <Layer src="s5_bg.jpg" />
          <Character src="s5_char.png" foot={[0.3, 0.9]} popAt={0} hopAt={[2]} jitter={3} sway={0.6} dur={len('s5')} parallax={0.05} />
        </AbsoluteFill>
      </Camera>
      <Flash at={punch} max={0.55} len={5} />
    </>
  );
};
const Shot6 = () => {
  const fr = useCurrentFrame();
  const g = 0.5 + 0.5 * Math.sin(fr * 0.35);
  return (
    <Camera z0={1.18} z1={1.02} fx={0.45} fy={0.3} dur={len('s6')}>
      <Layer src="s6_bg.jpg" style={{ filter: `brightness(${1 + g * 0.06}) saturate(${1 + g * 0.25})` }} />
    </Camera>
  );
};
const Shot7 = () => (
  <Camera z0={1.0} z1={1.08} fx={0.4} fy={0.3} dur={len('s7')}>
    <Layer src="s7_bg.jpg" />
    <Character src="s7_char.png" foot={[0.45, 0.75]} popAt={0} pulseAt={[f(9.7 - 9.0)]} hopAt={[f(9.7 - 9.0) - 2]} dur={len('s7')} parallax={0.06} />
  </Camera>
);

/* ---------- субтитры: 1–2 слова, * — красное ---------- */
const SUBS: [number, string][] = [
  [0.10, 'ПОЧЕМУ ОКНА'], [0.75, 'В САМОЛЁТЕ'], [1.40, 'КРУГЛЫЕ?'],
  [2.30, 'В ПЯТИДЕСЯТЫХ'], [3.10, 'ИХ ДЕЛАЛИ'], [3.65, 'КВАДРАТНЫМИ'],
  [4.60, 'ДАВЛЕНИЕ'], [5.10, 'БИЛО В'], [5.45, '*УГЛЫ'],
  [6.00, 'И КОРПУС'], [6.55, '*ТРЕСКАЛСЯ'],
  [7.50, 'КРУГ'], [7.85, 'РАСПРЕДЕЛЯЕТ'], [8.50, 'НАГРУЗКУ'],
  [9.10, 'ПОЭТОМУ ОНИ'], [9.70, 'КРУГЛЫЕ'],
];
const Subs = () => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = fr / fps;
  let i = -1; SUBS.forEach(([s], j) => { if (t >= s) i = j; });
  if (i < 0 || t > 10.45) return null;
  const [s0, raw] = SUBS[i];
  const danger = raw.startsWith('*'), txt = raw.replace('*', '');
  const pop = spring({ frame: fr - f(s0), fps, config: { damping: 10, stiffness: 300, mass: 0.5 } });
  const scale = interpolate(pop, [0, 1], [1.3, 1]);
  const size = txt.length > 11 ? 84 : 96;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      <div style={{
        position: 'absolute', top: 1290, width: '100%', textAlign: 'center',
        fontFamily, fontWeight: 900, fontSize: size, letterSpacing: 1,
        color: danger ? '#FF3B30' : '#FFFFFF', transform: `scale(${scale})`,
        WebkitTextStroke: '16px #0B0B0F', paintOrder: 'stroke fill',
        textShadow: '0 8px 18px rgba(0,0,0,.65)',
      }}>{txt}</div>
    </AbsoluteFill>
  );
};

/* ---------- склейки ---------- */
const Whoosh: React.FC<{ at: number }> = ({ at }) => {
  const fr = useCurrentFrame();
  const p = (fr - (at - 4)) / 9;
  if (p < 0 || p > 1) return null;
  let seed = at * 97 + 13; const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const bars = Array.from({ length: 9 }, (_, i) => {
    const w = 60 + r() * 170, sp = 0.6 + r() * 0.8, x0 = r() * 1080;
    const x = (((x0 + (p - 0.5) * 1080 * 2.4 * sp) % 1380) + 1380) % 1380 - 150;
    return <div key={i} style={{ position: 'absolute', left: x, top: 0, width: w, height: 1920, background: `rgba(6,8,14,${0.8 + r() * 0.15})` }} />;
  });
  return <AbsoluteFill>{bars}<AbsoluteFill style={{ background: `rgba(6,8,14,${Math.sin(p * Math.PI) * 0.5})` }} /></AbsoluteFill>;
};

const Vignette = () => (
  <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 45%, rgba(0,0,0,.42) 100%)' }} />
);

export const Okna: React.FC = () => {
  const shots: [keyof typeof S, React.FC][] = [['s1', Shot1], ['s2', Shot2], ['s3', Shot3], ['s4', Shot4], ['s5', Shot5], ['s6', Shot6], ['s7', Shot7]];
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      {shots.map(([k, C]) => (
        <Sequence key={k} from={S[k][0]} durationInFrames={len(k)}><C /></Sequence>
      ))}
      <Vignette />
      <Subs />
      {[S.s2[0], S.s4[0], S.s5[0], S.s7[0]].map(a => <Flash key={a} at={a} max={0.35} len={5} />)}
      <Whoosh at={S.s3[0]} />
      <Whoosh at={S.s6[0]} />
    </AbsoluteFill>
  );
};
