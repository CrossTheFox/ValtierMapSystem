/** Circuit chrome from `memoria-archive-en-app.html` (.ckt-*). */
export const ARCHIVE_LAB_CSS = `
.ckt-shell { position: absolute; inset: 0; background: #07070c; overflow: hidden; }
.ckt-viewport { position: absolute; inset: 0; overflow: hidden; background: #07070c; }
.ckt-viewport::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 4;
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 4px);
  opacity: 0.35;
}
.ckt-grid {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
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
  position: absolute; left: 0; top: 0; z-index: 1; width: 0; height: 0;
  transform-origin: 0 0; pointer-events: none;
}
.ckt-svg { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.ckt-svg .trace {
  fill: none; stroke-linecap: square; stroke-linejoin: miter; stroke-width: 2.2; opacity: 0.85;
  filter: drop-shadow(0 0 4px currentColor);
}
.ckt-svg .trace.ok { stroke: #3dd68c; color: #3dd68c; }
.ckt-svg .trace.hot { stroke: #ff3355; color: #ff3355; }
.ckt-svg .trace.warn { stroke: #f5c542; color: #f5c542; }
.ckt-svg .trace.idle { stroke: #667788; color: #667788; opacity: 0.55; }
.ckt-svg .trace.struct { stroke: #ffaa00; color: #ffaa00; opacity: 0.5; stroke-dasharray: 6 5; }
.ckt-svg .trace-flow {
  fill: none; stroke-linecap: round; stroke-width: 2; stroke-dasharray: 10 18;
  animation: cktFlow 1.1s linear infinite; opacity: 0.95;
}
.ckt-svg .trace-flow.ok { stroke: #a8ffe0; }
.ckt-svg .trace-flow.hot { stroke: #ffb0bc; animation-duration: 0.85s; }
.ckt-svg .trace-flow.warn { stroke: #ffe6a0; animation-duration: 1.3s; }
.ckt-svg .trace-flow.idle { stroke: #99aacc; animation-duration: 2s; opacity: 0.45; }
.ckt-svg .trace-flow.struct { stroke: #ffcc66; animation-duration: 2.2s; opacity: 0.4; }
@keyframes cktFlow { to { stroke-dashoffset: -28; } }
.ckt-svg .pad { fill: #0a0a12; stroke-width: 2; }
.ckt-svg .pad.ok { stroke: #3dd68c; filter: drop-shadow(0 0 5px #3dd68c); }
.ckt-svg .pad.hot { stroke: #ff3355; filter: drop-shadow(0 0 5px #ff3355); }
.ckt-svg .pad.warn { stroke: #f5c542; filter: drop-shadow(0 0 5px #f5c542); }
.ckt-svg .pad.idle { stroke: #778899; }
.ckt-svg .pad.struct { stroke: #ffaa00; }
.ckt-svg .trace.dim, .ckt-svg .trace-flow.dim { opacity: 0.12; }
.ckt-svg .pad.dim { opacity: 0.2; }
.ckt-svg .trace.live { stroke-width: 3.2; opacity: 1; }
.ckt-svg .rel-tag { pointer-events: none; }
.ckt-svg .rel-tag.dim { opacity: 0.16; }
.ckt-svg .rel-plate { fill: #07070c; stroke: rgba(255,255,255,0.16); stroke-width: 1; }
.ckt-svg .rel-label {
  font-family: "Fira Code", monospace; font-size: 10px; letter-spacing: 0.04em; fill: #ffffff;
}
.ckt-svg .rel-tag.ok .rel-label { fill: #a8ffe0; }
.ckt-svg .rel-tag.hot .rel-label { fill: #ffb0bc; }
.ckt-svg .rel-tag.warn .rel-label { fill: #ffe6a0; }
.ckt-svg .rel-tag.idle .rel-label { fill: #99aacc; }
.ckt-svg .rel-tag.struct .rel-label { fill: #ffcc66; }
.ckt-svg .rel-num-plate { fill: #07070c; stroke-width: 1.6; }
.ckt-svg .rel-num.ok .rel-num-plate { stroke: #3dd68c; }
.ckt-svg .rel-num.hot .rel-num-plate { stroke: #ff3355; }
.ckt-svg .rel-num.warn .rel-num-plate { stroke: #f5c542; }
.ckt-svg .rel-num.idle .rel-num-plate { stroke: #778899; }
.ckt-svg .rel-num.struct .rel-num-plate { stroke: #ffaa00; }
.ckt-svg .rel-num-label {
  font-family: "Fira Code", monospace; font-size: 9px; font-weight: 600; fill: #ffffff;
}
.ckt-svg .rel-step { fill: #ffffff; opacity: 0.9; }
.ckt-svg .rel-num.ok .rel-step { fill: #a8ffe0; }
.ckt-svg .rel-num.hot .rel-step { fill: #ffb0bc; }
.ckt-svg .rel-num.warn .rel-step { fill: #ffe6a0; }
.ckt-svg .rel-num.idle .rel-step { fill: #c5d0e0; }
.ckt-svg .rel-step.off { opacity: 0.22; }
.ckt-svg .rel-delta {
  font-family: "Fira Code", monospace; font-size: 9px; font-weight: 700;
}
.ckt-svg .trace.impact-idle,
.ckt-svg .trace-flow.impact-idle,
.ckt-svg .rel-tag.impact-idle,
.ckt-svg .rel-num.impact-idle,
.ckt-svg .pad.impact-idle { opacity: 0.16; }
.ckt-node.impact-idle { opacity: 0.34; filter: saturate(0.4); }
.ckt-node.seal-ok { border-color: #3dd68c; box-shadow: 0 0 0 1px #3dd68c, 0 0 22px rgba(61,214,140,0.55); z-index: 6; opacity: 1; filter: none; }
.ckt-node.seal-warn { border-color: #f5c542; box-shadow: 0 0 0 1px #f5c542, 0 0 22px rgba(245,197,66,0.5); z-index: 6; opacity: 1; filter: none; }
.ckt-node.seal-fail { border-color: #ff3355; box-shadow: 0 0 0 1px #ff3355, 0 0 22px rgba(255,51,85,0.5); z-index: 6; opacity: 1; filter: none; }
.ckt-float {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
  z-index: 8; pointer-events: none; white-space: nowrap;
  font-family: "Fira Code", monospace; font-size: 10px; letter-spacing: 0.03em;
  padding: 3px 7px; border: 1px solid; border-radius: 3px;
  background: rgba(7,7,12,0.94);
  box-shadow: 0 0 12px currentColor;
}
.ckt-svg .pkt { fill: #ffffff; filter: drop-shadow(0 0 4px currentColor); }
.ckt-svg .pkt.ok { fill: #a8ffe0; color: #3dd68c; }
.ckt-svg .pkt.hot { fill: #ffb0bc; color: #ff3355; }
.ckt-svg .pkt.warn { fill: #ffe6a0; color: #f5c542; }
.ckt-svg .pkt.idle { fill: #c5d0e0; color: #99aacc; }
.ckt-svg .pkt.struct { fill: #ffcc66; color: #ffaa00; }
.ckt-node.w0, .ckt-node.w1, .ckt-node.w2, .ckt-node.w3, .ckt-node.w4, .ckt-node.w5 {
  animation: cktWave 1.6s ease-in-out infinite;
}
@keyframes cktWave {
  0%, 100% { transform: translate3d(-50%, -50%, 0) scale(1); }
  50% { transform: translate3d(-50%, -50%, 0) scale(1.045); }
}
.ckt-node.w0.ckt-enter, .ckt-node.w1.ckt-enter, .ckt-node.w2.ckt-enter,
.ckt-node.w3.ckt-enter, .ckt-node.w4.ckt-enter, .ckt-node.w5.ckt-enter {
  animation: cktWave 1.6s ease-in-out infinite;
}
.ckt-svg .link-wire { stroke: #ff1493; stroke-width: 2; stroke-dasharray: 6 5; }
.ckt-svg .link-ghost { stroke: #ffffff; stroke-width: 1.25; stroke-dasharray: 3 4; }
.ckt-svg .hull { fill: rgba(0,242,234,0.05); stroke-width: 1.25; stroke-dasharray: 7 6; }
.ckt-node {
  position: absolute; transform: translate3d(-50%, -50%, 0); z-index: 2;
  pointer-events: none;
  padding: 10px 10px 12px; width: 148px; box-sizing: border-box;
  border: 1px solid rgba(255,255,255,0.14); border-radius: 4px;
  background: linear-gradient(160deg, rgba(16,18,28,0.96), rgba(8,8,14,0.92));
  text-align: center; color: #fff;
  box-shadow: 0 0 0 1px rgba(0,242,234,0.06), 0 8px 24px rgba(0,0,0,0.45);
}
.ckt-node::before, .ckt-node::after {
  content: ""; position: absolute; width: 10px; height: 10px;
  border: 1px solid rgba(0,242,234,0.55); pointer-events: none;
}
.ckt-node::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; }
.ckt-node::after { bottom: -1px; right: -1px; border-left: 0; border-top: 0; }
.ckt-node.aim {
  border-color: #ffffff;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.85), 0 0 26px rgba(0,242,234,0.45);
  z-index: 7;
}
.ckt-node.aim::before, .ckt-node.aim::after { border-color: #ffffff; width: 16px; height: 16px; }
.ckt-node.w0 { box-shadow: 0 0 0 1px #00f2ea, 0 0 22px rgba(0,242,234,0.55); z-index: 6; }
.ckt-node.w1 { box-shadow: 0 0 0 1px #ff1493, 0 0 22px rgba(255,20,147,0.5); z-index: 6; }
.ckt-node.w2 { box-shadow: 0 0 0 1px #f5c542, 0 0 18px rgba(245,197,66,0.45); z-index: 6; }
.ckt-node.w3, .ckt-node.w4, .ckt-node.w5 { box-shadow: 0 0 0 1px #aa66ff, 0 0 18px rgba(170,102,255,0.45); z-index: 6; }
.ckt-node.hot, .ckt-node.dragging {
  border-color: #ff1493;
  box-shadow: 0 0 22px rgba(255,20,147,0.28), 0 10px 28px rgba(0,0,0,0.5);
  z-index: 5;
}
.ckt-node.hot { transform: translate3d(-50%, -50%, 0) scale(1.04); }
.ckt-node.selected {
  border-color: #00f2ea;
  box-shadow: 0 0 0 1px rgba(0,242,234,0.45), 0 0 28px rgba(0,242,234,0.3);
  z-index: 6;
}
.ckt-node.selected::before, .ckt-node.selected::after { border-color: #00f2ea; width: 14px; height: 14px; }
.ckt-node.dim { opacity: 0.2; z-index: 1; box-shadow: none; }
.ckt-node.dim .av { filter: grayscale(1) brightness(0.55); }
.ckt-node .avw { position: relative; width: 64px; height: 64px; margin: 0 auto 8px; }
.ckt-node .av {
  width: 64px; height: 64px; margin: 0; border-radius: 50%;
  border: 2px solid #ff66ff; display: grid; place-items: center; overflow: hidden;
  background: radial-gradient(circle at 35% 30%, #2e3044, #121218);
  position: relative;
}
.ckt-node .av .code {
  font-family: Orbitron, sans-serif; font-size: 13px; letter-spacing: 0.12em;
}
.ckt-node .ring {
  position: absolute; inset: -6px; border-radius: 50%;
  border: 1px solid rgba(0,242,234,0.35);
  animation: cktRing 2.4s ease-out infinite; pointer-events: none;
}
@keyframes cktRing {
  0% { transform: scale(0.85); opacity: 0.7; }
  100% { transform: scale(1.35); opacity: 0; }
}
.ckt-node .nm {
  font-family: "Fira Sans", sans-serif; font-size: 0.78rem; font-weight: 600;
  letter-spacing: 0.02em; color: #fff;
}
.ckt-node .rank {
  margin-top: 3px; font-family: Orbitron, sans-serif; font-size: 0.42rem;
  letter-spacing: 0.14em;
}
.ckt-node .sy {
  font-family: "Fira Code", monospace; font-size: 0.58rem; color: #aaaaaa; margin-top: 2px;
}
.ckt-port {
  position: absolute; width: 7px; height: 7px; background: #0a0a12;
  border: 1px solid #00f2ea; box-shadow: 0 0 6px rgba(0,242,234,0.5);
}
.ckt-port.e { right: -4px; top: 50%; transform: translateY(-50%); }
.ckt-port.w { left: -4px; top: 50%; transform: translateY(-50%); }
.ckt-port.n { top: -4px; left: 50%; transform: translateX(-50%); }
.ckt-port.s { bottom: -4px; left: 50%; transform: translateX(-50%); }
.ckt-node.ckt-enter { animation: cktNodeEnter 0.26s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes cktNodeEnter {
  0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.86); }
  100% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1); }
}
.ckt-svg .rel-num.locked .rel-num-plate { fill: #120d02; stroke: #ffaa00; stroke-width: 1.4; }
.ckt-svg .rel-num.locked .rel-lock { fill: none; stroke: #ffcc66; stroke-width: 1.3; stroke-linecap: round; }
.ckt-svg .rel-num.locked .rel-lock-body { fill: #ffcc66; }
.ckt-svg .rel-num.rv-pending .rel-num-plate { stroke-width: 2.2; filter: drop-shadow(0 0 5px #ffffff); }
.ckt-svg .rel-num.rv-accepted .rel-num-plate { stroke: #3dd68c; stroke-width: 2.2; filter: drop-shadow(0 0 6px #3dd68c); }
.ckt-svg .trace.rv-accepted { stroke: #3dd68c; color: #3dd68c; }
.ckt-svg .rel-num.rv-rejected, .ckt-svg .trace.rv-rejected, .ckt-svg .trace-flow.rv-rejected,
.ckt-svg .rel-tag.rv-rejected, .ckt-svg .pad.rv-rejected { opacity: 0.32; }
.ckt-svg .ghost-trace {
  fill: none; stroke-width: 2.2; stroke-dasharray: 3 7; stroke-linecap: round;
  animation: cktFlow 0.9s linear infinite; filter: drop-shadow(0 0 5px currentColor);
}
.ckt-svg .ghost-plate { fill: rgba(7,7,12,0.94); stroke-width: 1; stroke-dasharray: 3 2; }
.ckt-svg .ghost-label { font-family: "Fira Code", monospace; font-size: 9.5px; font-weight: 600; letter-spacing: 0.04em; }
.ckt-node.seal-done { border-color: #3dd68c; box-shadow: 0 0 0 1px #3dd68c, 0 0 16px rgba(61,214,140,0.35); z-index: 6; opacity: 1; filter: none; }
.ckt-node.seal-rej { border-color: #778899; opacity: 0.55; filter: saturate(0.3); z-index: 5; }
.ckt-node.impact-anchor { border-color: #00f2ea; box-shadow: 0 0 0 1px #00f2ea, 0 0 22px rgba(0,242,234,0.35); opacity: 1; filter: none; z-index: 6; }
.ckt-node.impact-anchor .av { filter: none; }
.ckt-node.show-seal .ckt-float { animation: cktFloatIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes cktFloatIn {
  0% { opacity: 0; transform: translate(-50%, 6px) scale(0.92); }
  100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
.ckt-node.gen, .ckt-node.gen.ckt-enter { animation: cktScan 0.7s steps(2, end) infinite; }
@keyframes cktScan {
  0% { filter: brightness(1.3) saturate(1.2); }
  100% { filter: brightness(0.92); }
}
.ckt-node.gen::before, .ckt-node.gen::after {
  border-color: #00f2ea; width: 18px; height: 18px;
  animation: cktBracket 0.9s ease-in-out infinite alternate;
}
@keyframes cktBracket { from { width: 10px; height: 10px; } to { width: 22px; height: 22px; } }
.ckt-node.gen .avw::after {
  content: ""; position: absolute; left: -8px; right: -8px; top: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #00f2ea, transparent);
  box-shadow: 0 0 8px #00f2ea; animation: cktScanLine 1.1s linear infinite;
}
@keyframes cktScanLine { 0% { top: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
.lab-stage { position: absolute; inset: 0; background: #07070c; }
.lab-stage .lab-camera {
  position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%;
  display: block; touch-action: none; background: transparent; pointer-events: auto;
}
`;
