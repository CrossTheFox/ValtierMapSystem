/** Injected once — Option 8 circuit visual language (+ UX polish). */
export const CIRCUIT_CSS = `
/* Graph bootstrap — wait for wiki entities + relations snapshots */
.ckt-graph-loading {
  position: absolute; inset: 0; z-index: 40;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0;
  background: rgba(7, 7, 12, 0.82);
  backdrop-filter: blur(8px);
  pointer-events: all;
  animation: cktGraphLoadIn 0.28s ease;
}
@keyframes cktGraphLoadIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ckt-shell { position: relative; width: 100%; height: 100%; min-height: 0; background: #07070c; overflow: hidden; }
.ckt-shell.wave-live .ckt-svg .trace-flow { animation-duration: 0.45s !important; stroke-width: 3; }
.ckt-shell.wave-live .ckt-node.wave1 { animation: cktWaveHit 0.7s ease; }
.ckt-shell.wave-live .ckt-node.wave2 { animation: cktWaveHit 0.7s ease 0.45s; }
.ckt-shell.wave-preview .ckt-node.wave0 {
  border-color: #00f2ea;
  box-shadow: 0 0 0 1px rgba(0,242,234,0.55), 0 0 26px rgba(0,242,234,0.4);
  animation: cktWaveHit 0.55s ease;
}
.ckt-shell.wave-preview .ckt-node.wave1 {
  border-color: rgba(0,242,234,0.65);
  box-shadow: 0 0 18px rgba(0,242,234,0.28), 0 8px 24px rgba(0,0,0,0.45);
  animation: cktWaveHit 0.7s ease;
}
.ckt-shell.wave-preview .ckt-node.wave2 {
  border-color: rgba(255,20,147,0.45);
  box-shadow: 0 0 14px rgba(255,20,147,0.22), 0 8px 24px rgba(0,0,0,0.45);
  animation: cktWaveHit 0.7s ease 0.12s;
}
/* Anyone not in the impact waves stays off — do not rely only on .dim (compositor / pkt-lit). */
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) {
  opacity: 0.18 !important;
  filter: none;
  box-shadow: none;
  z-index: 1;
  border-color: rgba(255,255,255,0.08);
}
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) .av,
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) img {
  filter: grayscale(1) brightness(0.55);
  border-color: #445 !important;
  box-shadow: none !important;
}
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) .ring {
  display: none;
}
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) .rank,
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) .nm,
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self) .sy {
  color: #667788 !important;
}
.ckt-shell.wave-preview .ckt-node[data-ckt-wave="off"] {
  opacity: 0.18 !important;
}
.ckt-shell.wave-preview .ckt-node:not(.wave0):not(.wave1):not(.wave2):not(.selected):not(.self):hover,
.ckt-shell.wave-preview .ckt-node[data-ckt-wave="off"]:hover {
  opacity: 0.48 !important;
}
@keyframes cktWaveHit {
  0%, 100% { box-shadow: 0 0 0 1px rgba(0,242,234,0.06), 0 8px 24px rgba(0,0,0,0.45); }
  40% { box-shadow: 0 0 30px rgba(0,242,234,0.55), 0 0 0 1px rgba(0,242,234,0.45); }
}
/* Packet Cascade — Evento narrativo loading loop */
.ckt-shell.ckt-cascade-live .ckt-node.self { animation: none; }
.ckt-pkt-layer {
  position: absolute; inset: 0; z-index: 9; pointer-events: none;
}
.ckt-pkt {
  position: absolute; left: 0; top: 0;
  width: 9px; height: 9px; border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 12px #00f2ea, 0 0 22px rgba(0,242,234,0.55);
  opacity: 0;
  will-change: transform, opacity;
  backface-visibility: hidden;
}
.ckt-pkt.ok { box-shadow: 0 0 12px #3dd68c, 0 0 22px rgba(61,214,140,0.5); }
.ckt-pkt.hot { box-shadow: 0 0 12px #ff3355, 0 0 22px rgba(255,51,85,0.55); }
.ckt-pkt.warn { box-shadow: 0 0 12px #f5c542, 0 0 22px rgba(245,197,66,0.5); }
.ckt-svg .trace.ckt-armed {
  stroke-width: 3.2; opacity: 1;
  filter: drop-shadow(0 0 8px currentColor);
}
.ckt-node.ckt-pkt-lit { opacity: 1; }
.ckt-shell.wave-preview .ckt-node.dim,
.ckt-shell.wave-preview .ckt-node.ckt-pkt-lit.dim { opacity: 0.2 !important; }
.ckt-node.ckt-pkt-hit {
  animation: cktPktHit 0.5s ease;
}
.ckt-node.hostile.ckt-pkt-hit { animation-name: cktPktHitHot; }
.ckt-node.rival.ckt-pkt-hit { animation-name: cktPktHitWarn; }
@keyframes cktPktHit {
  0%, 100% { box-shadow: 0 0 0 1px rgba(0,242,234,0.06), 0 8px 24px rgba(0,0,0,0.45); }
  40% {
    box-shadow: 0 0 34px rgba(0,242,234,0.65), 0 0 0 1px rgba(0,242,234,0.55);
    transform: translate3d(-50%, -50%, 0) scale(1.06);
  }
}
@keyframes cktPktHitHot {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255,51,85,0.1), 0 8px 24px rgba(0,0,0,0.45); }
  40% {
    box-shadow: 0 0 34px rgba(255,51,85,0.7), 0 0 0 1px rgba(255,51,85,0.55);
    transform: translate3d(-50%, -50%, 0) scale(1.06);
  }
}
@keyframes cktPktHitWarn {
  0%, 100% { box-shadow: 0 0 0 1px rgba(245,197,66,0.1), 0 8px 24px rgba(0,0,0,0.45); }
  40% {
    box-shadow: 0 0 34px rgba(245,197,66,0.65), 0 0 0 1px rgba(245,197,66,0.5);
    transform: translate3d(-50%, -50%, 0) scale(1.06);
  }
}
.ckt-cascade-badge {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 8; pointer-events: none;
  font-family: Orbitron, sans-serif; font-size: 0.52rem; letter-spacing: 0.14em;
  color: #00f2ea; padding: 6px 12px; border-radius: 4px;
  border: 1px solid rgba(0,242,234,0.4);
  background: rgba(8,8,14,0.88);
  box-shadow: 0 0 16px rgba(0,242,234,0.25);
  white-space: nowrap;
}
/* F1 · Seal Grade — post-validation */
.ckt-node.seal-ok { border-color: #3dd68c; box-shadow: 0 0 22px rgba(61,214,140,0.45), 0 8px 24px rgba(0,0,0,0.45); }
.ckt-node.seal-warn { border-color: #f5c542; box-shadow: 0 0 22px rgba(245,197,66,0.4), 0 8px 24px rgba(0,0,0,0.45); }
.ckt-node.seal-fail { border-color: #ff3355; box-shadow: 0 0 22px rgba(255,51,85,0.45), 0 8px 24px rgba(0,0,0,0.45); }
.ckt-node .ckt-seal-mark {
  position: absolute; top: -8px; left: 50%; transform: translateX(-50%) scale(0);
  font-family: Orbitron, sans-serif; font-size: 0.55rem; letter-spacing: 0.08em;
  padding: 3px 8px; border-radius: 3px; border: 1px solid; background: rgba(8,8,14,0.95);
  opacity: 0; pointer-events: none; z-index: 9; white-space: nowrap;
}
.ckt-node.show-seal .ckt-seal-mark {
  animation: cktSealIn 0.55s cubic-bezier(0.16,1,0.3,1) forwards;
}
@keyframes cktSealIn {
  0% { opacity: 0; transform: translateX(-50%) scale(0.4); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}
.ckt-verdict-banner {
  position: absolute; left: 50%; bottom: 56px; transform: translateX(-50%) translateY(20px);
  z-index: 9; opacity: 0; pointer-events: none;
  font-family: Orbitron, sans-serif; letter-spacing: 0.14em;
  padding: 10px 16px; border-radius: 6px; border: 1px solid; background: rgba(8,8,14,0.92);
  text-align: center; min-width: 260px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.5);
}
.ckt-verdict-banner.on {
  animation: cktBannerIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
}
@keyframes cktBannerIn {
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.ckt-verdict-banner .big { font-size: 0.78rem; margin-bottom: 4px; }
.ckt-verdict-banner .meta {
  font-family: "Fira Code", monospace; font-size: 0.58rem;
  color: #aaaaaa; letter-spacing: 0;
}
.ckt-shell.ckt-seal-result .ckt-cascade-badge { display: none; }
.ckt-viewport {
  position: absolute; inset: 0;
  overflow: hidden; cursor: grab; touch-action: none;
  background: #07070c;
}
.ckt-viewport.dragging { cursor: grabbing; }
.ckt-viewport.ckt-panning .ckt-world {
  will-change: transform;
}
.ckt-viewport.ckt-panning .ckt-grid {
  will-change: background-position, background-size;
}
.ckt-viewport::after {
  content: "";
  position: absolute; inset: 0; pointer-events: none; z-index: 4;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px
  );
  opacity: 0.35;
}
.ckt-viewport.ckt-panning::after,
.ckt-shell.ckt-animating .ckt-viewport::after {
  opacity: 0.12;
}
/* Viewport-fixed washes — no world rectangle clip */
.ckt-atmosphere {
  position: absolute; inset: 0; z-index: 0;
  pointer-events: none;
  background: linear-gradient(180deg,
    rgba(61,214,140,0.11) 0%,
    rgba(61,214,140,0.04) 28%,
    transparent 42%,
    transparent 58%,
    rgba(245,197,66,0.04) 72%,
    rgba(255,51,85,0.1) 100%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 32%, transparent 88%);
  mask-image: radial-gradient(ellipse at center, #000 32%, transparent 88%);
}
/* Infinite tiling grid — viewport-fixed; fade is a viewport mask */
.ckt-grid {
  position: absolute; inset: 0; z-index: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0,242,234,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,242,234,0.05) 1px, transparent 1px),
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 80px 80px, 80px 80px, 20px 20px, 20px 20px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 28%, transparent 82%);
  mask-image: radial-gradient(ellipse at center, #000 28%, transparent 82%);
}
.ckt-world {
  position: absolute; left: 0; top: 0; z-index: 1;
  width: 1600px; height: 1000px;
  transform-origin: 0 0;
  background: transparent;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
}
.ckt-horizon {
  position: absolute; left: 120px; right: 80px; top: 500px; height: 1px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(0,242,234,0.15) 8%, rgba(0,242,234,0.45) 50%, rgba(0,242,234,0.15) 92%, transparent);
  box-shadow: 0 0 12px rgba(0,242,234,0.2);
}
.ckt-horizon::before {
  content: "SYNC 0 · ECUADOR";
  position: absolute; left: 50%; top: -14px; transform: translateX(-50%);
  font-family: Orbitron, sans-serif; font-size: 0.42rem; letter-spacing: 0.18em;
  color: rgba(0,242,234,0.45);
}
/* Screen-fixed sync ruler (chrome) */
.ckt-axis {
  position: absolute; left: 8px; top: 0; bottom: 0; width: 72px;
  pointer-events: none; z-index: 5;
  border-left: 1px solid rgba(0,242,234,0.45);
  background: linear-gradient(180deg, rgba(61,214,140,0.22), rgba(0,242,234,0.12) 50%, rgba(255,51,85,0.22));
  background-size: 3px 100%; background-repeat: no-repeat; background-position: left center;
}
.ckt-axis .cap {
  position: absolute; left: 0; top: 0;
  padding-left: 18px;
  font-family: Orbitron, sans-serif; font-size: 0.72rem; letter-spacing: 0.1em; white-space: nowrap;
  font-weight: 600;
  will-change: transform;
  backface-visibility: hidden;
}
.ckt-axis .cap.top { color: #3dd68c; }
.ckt-axis .cap.mid { color: #00f2ea; font-size: 0.78rem; }
.ckt-axis .cap.bot { color: #ff3355; }
.ckt-axis .cap.is-off,
.ckt-axis .tick.is-off { opacity: 0; pointer-events: none; }
.ckt-axis .tick {
  position: absolute; left: 0; right: 0; top: 0; height: 1px;
  background: rgba(0,242,234,0.55);
  box-shadow: 0 0 6px rgba(0,242,234,0.25);
  will-change: transform;
  backface-visibility: hidden;
}
.ckt-axis .tick.mid {
  height: 2px;
  background: #00f2ea;
  box-shadow: 0 0 8px rgba(0,242,234,0.45);
}
.ckt-axis .tick span {
  position: absolute; left: 18px; top: -9px;
  font-family: "Fira Code", monospace; font-size: 0.7rem; font-weight: 600;
  color: #00f2ea;
  text-shadow: 0 0 8px rgba(0,242,234,0.35);
}
.ckt-zone-tag {
  position: absolute; left: 110px;
  font-family: Orbitron, sans-serif; font-size: 0.48rem; letter-spacing: 0.22em;
  pointer-events: none; padding: 4px 10px; border-radius: 2px;
  border: 1px solid transparent; backdrop-filter: blur(6px);
}
.ckt-zone-tag.up { top: 78px; color: rgba(61,214,140,0.75); border-color: rgba(61,214,140,0.28); background: rgba(61,214,140,0.06); }
.ckt-zone-tag.mid { top: 456px; color: rgba(0,242,234,0.65); border-color: rgba(0,242,234,0.22); background: rgba(0,242,234,0.05); }
.ckt-zone-tag.down { top: 860px; color: rgba(255,51,85,0.75); border-color: rgba(255,51,85,0.28); background: rgba(255,51,85,0.06); }
.ckt-hub-ring {
  position: absolute; left: 800px; top: 500px; width: 220px; height: 220px;
  transform: translate(-50%, -50%); border-radius: 50%;
  border: 1px dashed rgba(0,242,234,0.22); pointer-events: none;
  box-shadow: 0 0 0 60px rgba(0,242,234,0.02), 0 0 40px rgba(0,242,234,0.08);
  animation: cktHubSpin 28s linear infinite;
}
@keyframes cktHubSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
.ckt-bus-label {
  position: absolute; font-family: Orbitron, sans-serif; font-size: 0.5rem;
  letter-spacing: 0.2em; color: rgba(255,170,0,0.45); pointer-events: none; white-space: nowrap;
}
.ckt-svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 1; }
.ckt-svg.ckt-svg-back { z-index: 0; }
.ckt-svg.ckt-svg-front { z-index: 3; }
.ckt-svg .trace {
  fill: none; stroke-linecap: square; stroke-linejoin: miter; stroke-width: 2.2; opacity: 0.85;
  filter: drop-shadow(0 0 4px currentColor);
}
.ckt-svg .trace.ok { stroke: #3dd68c; color: #3dd68c; }
.ckt-svg .trace.hot { stroke: #ff3355; color: #ff3355; }
.ckt-svg .trace.warn { stroke: #f5c542; color: #f5c542; }
.ckt-svg .trace.idle { stroke: #667788; color: #667788; opacity: 0.55; }
.ckt-svg .trace.struct { stroke: #ffaa00; color: #ffaa00; opacity: 0.5; stroke-dasharray: 6 5; }
.ckt-svg .trace.secondary { stroke: #667788; color: #667788; opacity: 0.28; stroke-dasharray: 4 6; }
.ckt-svg .trace.impact {
  stroke: #00f2ea; color: #00f2ea; stroke-width: 3.6; opacity: 1;
  filter: drop-shadow(0 0 10px rgba(0,242,234,0.85));
}
.ckt-svg .trace-flow {
  fill: none; stroke-linecap: round; stroke-width: 2; stroke-dasharray: 10 18;
  animation: cktFlow 1.1s linear infinite; opacity: 0.95; pointer-events: none;
}
.ckt-svg .trace-flow.ok { stroke: #a8ffe0; }
.ckt-svg .trace-flow.hot { stroke: #ffb0bc; animation-duration: 0.85s; }
.ckt-svg .trace-flow.warn { stroke: #ffe6a0; animation-duration: 1.3s; }
.ckt-svg .trace-flow.idle { stroke: #99aacc; animation-duration: 2s; opacity: 0.45; }
.ckt-svg .trace-flow.struct { stroke: #ffcc66; animation-duration: 2.2s; opacity: 0.4; }
.ckt-svg .trace-flow.secondary { stroke: #99aacc; animation-duration: 2.4s; opacity: 0.25; }
.ckt-svg .trace-flow.impact {
  stroke: #ffffff; stroke-width: 2.6; animation-duration: 0.65s; opacity: 1;
}
@keyframes cktFlow { to { stroke-dashoffset: -28; } }
.ckt-svg .pad { fill: #0a0a12; stroke-width: 2; }
.ckt-svg .pad.ok { stroke: #3dd68c; filter: drop-shadow(0 0 5px #3dd68c); }
.ckt-svg .pad.hot { stroke: #ff3355; filter: drop-shadow(0 0 5px #ff3355); }
.ckt-svg .pad.warn { stroke: #f5c542; filter: drop-shadow(0 0 5px #f5c542); }
.ckt-svg .pad.idle { stroke: #778899; }
.ckt-svg .pad.struct { stroke: #ffaa00; }
.ckt-svg .pad.impact { stroke: #00f2ea; filter: drop-shadow(0 0 6px #00f2ea); }
.ckt-node {
  position: absolute; transform: translate3d(-50%, -50%, 0); z-index: 2;
  padding: 10px 10px 12px;
  border: 1px solid rgba(255,255,255,0.14); border-radius: 4px;
  background: linear-gradient(160deg, rgba(16,18,28,0.96), rgba(8,8,14,0.92));
  text-align: center; cursor: pointer;
  transition: transform .18s ease, border-color .18s, box-shadow .18s, opacity .18s;
  box-shadow: 0 0 0 1px rgba(0,242,234,0.06), 0 8px 24px rgba(0,0,0,0.45);
  color: #fff;
}
.ckt-node.has-drag-handle { padding-top: 22px; }
.ckt-drag-handle {
  position: absolute; top: 0; left: 0; right: 0; height: 18px;
  z-index: 7; cursor: grab; touch-action: none;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(0,242,234,0.16), rgba(0,242,234,0.02));
  border-bottom: 1px solid rgba(0,242,234,0.22);
}
.ckt-drag-handle::after {
  content: ""; position: absolute; left: 50%; top: 7px;
  width: 28px; height: 3px; margin-left: -14px; border-radius: 2px;
  background: rgba(0,242,234,0.55);
  box-shadow: 0 0 6px rgba(0,242,234,0.35);
}
.ckt-drag-handle:active, .ckt-node.dragging .ckt-drag-handle { cursor: grabbing; }
.ckt-node.dragging {
  transition: none !important;
  transform: translate3d(-50%, -50%, 0) !important;
  z-index: 12;
  border-color: #ff1493;
  box-shadow: 0 0 22px rgba(255,20,147,0.35), 0 12px 32px rgba(0,0,0,0.55);
}
.ckt-node.dragging:hover {
  transform: translate3d(-50%, -50%, 0) !important;
}
.ckt-node::before, .ckt-node::after {
  content: ""; position: absolute; width: 10px; height: 10px;
  border: 1px solid rgba(0,242,234,0.55); pointer-events: none;
}
.ckt-node::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.ckt-node::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
.ckt-node:hover {
  transform: translate3d(-50%, -50%, 0) scale(1.04);
  border-color: #ff1493;
  box-shadow: 0 0 22px rgba(255,20,147,0.28), 0 10px 28px rgba(0,0,0,0.5);
  z-index: 5;
}
.ckt-node.selected, .ckt-node.wave0 {
  border-color: #00f2ea;
  box-shadow: 0 0 0 1px rgba(0,242,234,0.45), 0 0 28px rgba(0,242,234,0.3);
  z-index: 6;
}
.ckt-node.selected::before, .ckt-node.selected::after,
.ckt-node.wave0::before, .ckt-node.wave0::after { border-color: #00f2ea; width: 14px; height: 14px; }
.ckt-node.wave1 { z-index: 5; }
.ckt-node.wave2 { z-index: 4; }
.ckt-node.dim {
  opacity: 0.2;
  z-index: 1;
  box-shadow: none;
}
.ckt-node.dim .av, .ckt-node.dim img {
  filter: grayscale(1) brightness(0.55);
}
.ckt-node.dim:hover {
  opacity: 0.45;
  z-index: 2;
}
.ckt-node.dim:hover .av, .ckt-node.dim:hover img {
  filter: grayscale(0.35) brightness(0.8);
}
.ckt-shell.wave-preview .ckt-node.dim { pointer-events: auto; }
.ckt-node.self {
  z-index: 4; border-color: rgba(0,242,234,0.55);
  box-shadow: 0 0 28px rgba(0,242,234,0.35), inset 0 0 24px rgba(0,242,234,0.06);
  animation: cktRootPulse 3.2s ease-in-out infinite;
}
@keyframes cktRootPulse {
  0%, 100% { box-shadow: 0 0 22px rgba(0,242,234,0.28), inset 0 0 20px rgba(0,242,234,0.05); }
  50% { box-shadow: 0 0 36px rgba(0,242,234,0.5), inset 0 0 28px rgba(0,242,234,0.1); }
}
.ckt-node .av {
  width: 64px; height: 64px; margin: 0 auto 8px; border-radius: 50%;
  border: 2px solid #ff66ff;
  display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(circle at 35% 30%, #2e3044, #121218);
  /* Isolate avatar so world pan/zoom does not bake a low-res texture */
  transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
.ckt-node.self .av { width: 80px; height: 80px; border-color: #00f2ea; box-shadow: 0 0 16px rgba(0,242,234,0.4); }
.ckt-node.ally .av { border-color: #3dd68c; box-shadow: 0 0 12px rgba(61,214,140,0.35); }
.ckt-node.rival .av { border-color: #f5c542; box-shadow: 0 0 12px rgba(245,197,66,0.3); }
.ckt-node.hostile .av { border-color: #ff3355; box-shadow: 0 0 12px rgba(255,51,85,0.4); }
.ckt-node.neutral .av { border-color: #889; }
.ckt-node.struct .av { border-color: #ffaa00; border-radius: 6px; }
.ckt-struct-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  cursor: help;
}
.ckt-struct-flags {
  font-family: "Share Tech Mono", monospace;
  font-size: 0.42rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 170, 0, 0.85);
  line-height: 1.2;
  text-align: center;
  max-width: 100%;
}
.ckt-node .av img {
  width: 100%; height: 100%; object-fit: cover;
  image-rendering: auto;
  image-rendering: high-quality;
  -ms-interpolation-mode: bicubic;
}
.ckt-node .ring {
  position: absolute; inset: -6px; border-radius: 50%;
  border: 1px solid rgba(0,242,234,0.35);
  animation: cktRing 2.4s ease-out infinite; pointer-events: none;
}
.ckt-node.hostile .ring { border-color: rgba(255,51,85,0.4); }
.ckt-node.ally .ring { border-color: rgba(61,214,140,0.4); }
@keyframes cktRing {
  0% { transform: scale(0.85); opacity: 0.7; }
  100% { transform: scale(1.35); opacity: 0; }
}
.ckt-node .nm { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.02em; color: #fff; }
.ckt-node .rank {
  margin-top: 3px; font-family: Orbitron, sans-serif; font-size: 0.42rem;
  letter-spacing: 0.14em; color: #00f2ea;
}
.ckt-node .sy { font-family: "Fira Code", monospace; font-size: 0.58rem; color: #aaaaaa; margin-top: 2px; }
.ckt-node .mini-meter {
  margin: 8px auto 0; width: 88%; height: 6px; border-radius: 1px;
  background: linear-gradient(90deg, #ff3355, #2a2a36 50%, #3dd68c);
  border: 1px solid rgba(255,255,255,0.12); position: relative;
}
.ckt-node .mini-meter .thumb {
  position: absolute; top: 50%; width: 7px; height: 7px;
  transform: translate(-50%, -50%) rotate(45deg);
  background: #fff; border: 1px solid #00f2ea; box-shadow: 0 0 6px #00f2ea;
}
.ckt-port {
  position: absolute; width: 7px; height: 7px; background: #0a0a12;
  border: 1px solid #00f2ea; box-shadow: 0 0 6px rgba(0,242,234,0.5);
}
.ckt-port.e { right: -4px; top: 50%; transform: translateY(-50%); }
.ckt-port.w { left: -4px; top: 50%; transform: translateY(-50%); }
.ckt-port.n { top: -4px; left: 50%; transform: translateX(-50%); }
.ckt-port.s { bottom: -4px; left: 50%; transform: translateX(-50%); }
.ckt-svg.ckt-traces-exit {
  opacity: 0;
  transition: opacity 0.28s ease;
  pointer-events: none;
}
.ckt-svg.ckt-traces-enter {
  animation: cktTracesEnter 0.36s ease-out;
}
@keyframes cktTracesEnter {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
.ckt-node-action {
  pointer-events: auto;
}
.ckt-shell.ckt-animating .ckt-node.self {
  animation: none;
}
.ckt-shell.ckt-animating .ckt-node:hover {
  transform: translate3d(-50%, -50%, 0);
}
.ckt-node.ckt-exit,
.ckt-node.ckt-enter,
.ckt-node.ckt-travel-target {
  transition: none !important;
  will-change: transform, opacity;
  pointer-events: none;
}
.ckt-node.ckt-exit {
  animation: cktNodeExit 0.22s cubic-bezier(0.4, 0, 1, 1) forwards;
}
.ckt-node.ckt-exit:hover {
  border-color: rgba(255,255,255,0.14);
  box-shadow: 0 0 0 1px rgba(0,242,234,0.06), 0 8px 24px rgba(0,0,0,0.45);
}
.ckt-node.ckt-enter {
  animation: cktNodeEnter 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
}
.ckt-node.ckt-travel-target {
  animation: cktTravelTarget 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  z-index: 5;
}
.ckt-viewport.ckt-node-dragging { cursor: grabbing; }
.ckt-viewport.ckt-node-dragging .ckt-node { cursor: grabbing; }
/* Compositor-only keyframes (no filter/blur — keeps avatar sharp at 60fps) */
@keyframes cktNodeExit {
  0% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1) skewX(0); }
  35% { opacity: 0.8; transform: translate3d(-50%, -50%, 0) scale(1.05) skewX(-3deg);
    box-shadow: 0 0 22px rgba(0,242,234,0.45), 0 0 0 1px rgba(0,242,234,0.35); }
  100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.74) skewX(7deg);
    box-shadow: 0 0 0 1px transparent; }
}
@keyframes cktNodeEnter {
  0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.72) skewX(-5deg);
    box-shadow: 0 0 24px rgba(255,170,0,0.5); }
  55% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1.04) skewX(2deg);
    box-shadow: 0 0 16px rgba(255,170,0,0.35); }
  100% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1) skewX(0); }
}
@keyframes cktTravelTarget {
  0% { transform: translate3d(-50%, -50%, 0) scale(1);
    box-shadow: 0 0 0 1px rgba(0,242,234,0.12), 0 8px 24px rgba(0,0,0,0.45); }
  45% { transform: translate3d(-50%, -50%, 0) scale(1.08);
    border-color: #00f2ea;
    box-shadow: 0 0 0 1px #00f2ea, 0 0 28px rgba(0,242,234,0.55); }
  100% { transform: translate3d(-50%, -50%, 0) scale(1.05);
    border-color: #00f2ea;
    box-shadow: 0 0 0 1px #00f2ea, 0 0 24px rgba(0,242,234,0.5); }
}
`;

let injected = false;
export function ensureCircuitCss() {
    if (typeof document === "undefined") return;
    const tag = "opt8-ux20";
    const existing = document.querySelector(`style[data-ckt="${tag}"]`);
    if (existing && injected) return;
    document.querySelectorAll("style[data-ckt]").forEach((n) => n.remove());
    injected = true;
    const el = document.createElement("style");
    el.setAttribute("data-ckt", tag);
    el.textContent = CIRCUIT_CSS;
    document.head.appendChild(el);
}
