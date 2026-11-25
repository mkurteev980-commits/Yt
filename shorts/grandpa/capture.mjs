// node capture.mjs <url> <outDir> <dur> [fps] — drives headless Chrome via CDP: render(t) then grab the output canvas as JPEG
import fs from "node:fs";
const [, , url, outDir, dur, fpsArg] = process.argv; const fps = Number(fpsArg ?? 30);
let pages;
for (let i = 0; i < 60; i++) { try { pages = await (await fetch("http://127.0.0.1:9334/json")).json(); if (pages.find((p) => p.type === "page")) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
const ws = new WebSocket(pages.find((p) => p.type === "page").webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = {}; ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await call("Page.navigate", { url });
for (let i = 0; i < 120; i++) { const m = await call("Runtime.evaluate", { expression: "!!window.READY", returnByValue: true }); if (m.result.result.value) break; await new Promise((r) => setTimeout(r, 250)); }
const N = Math.round(Number(dur) * fps);
for (let i = 0; i < N; i++) {
  const m = await call("Runtime.evaluate", { expression: `render(${(i / fps).toFixed(4)}); document.getElementById('out').toDataURL('image/jpeg', 0.93)`, returnByValue: true });
  fs.writeFileSync(`${outDir}/f${String(i).padStart(5, "0")}.jpg`, Buffer.from(m.result.result.value.split(",")[1], "base64"));
  if (i % 60 === 0) console.log("frame", i, "/", N);
}
process.exit(0);
