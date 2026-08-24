import { createElement as h } from "react";

/**
 * Shared inline SVG icons — ported from the mockup's `C2_SVG`/`C2_STAR` literals
 * (`docs/mockups/kit-job-header/index.html` `#chat` lab, ~line 7896). Used by
 * both the dossier (`KitCardBodyB2`/header ATK mark) and the C2 chat card
 * (`AbilityC2Card`) so the "this has an attack" / "this is a Limit Break"
 * glyphs are pixel-identical in both places (CANON).
 *
 * Plain `.js` module (no JSX) built with `React.createElement` so it can live
 * under `src/constants/` alongside the other data modules. Size via `size`
 * prop (px); color follows the parent's `color`/`currentColor`.
 */

/** Crossed blades — "this card has an attack" marker (`.atk-mark` when `hasAttack`). */
export function KitSvgCross({ size = 14 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
        h("path", { d: "M14.5 17.5 3 6V3h3l11.5 11.5" }),
        h("path", { d: "m13 19 6-6" }),
        h("path", { d: "m16 16 4 4" }),
        h("path", { d: "m19 21 2-2" }),
        h("path", { d: "M14.5 6.5 18 3h3v3l-3.5 3.5" }),
        h("path", { d: "m5 14 4 4" }),
        h("path", { d: "m7 17-3 3" }),
        h("path", { d: "m3 19 2 2" })
    );
}

/** Radar pulse — "this card is Standard (no attack)" marker (`.atk-mark` when `!hasAttack`). */
export function KitSvgPulse({ size = 14 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2" },
        h("circle", { cx: "12", cy: "12", r: "3" }),
        h("circle", { cx: "12", cy: "12", r: "7", opacity: ".55" }),
        h("circle", { cx: "12", cy: "12", r: "11", opacity: ".3" })
    );
}

/** Gold star — Limit Break marker (`.lb-mark`). */
export function KitSvgLbStar({ size = 16 }) {
    const d = "M12 2l2.4 6.2L21 9l-5 4.2L17.5 21 12 17.4 6.5 21 8 13.2 3 9l6.6-.8L12 2z";
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.8" },
        h("path", { d, fill: "currentColor", fillOpacity: ".25" }),
        h("path", { d })
    );
}

/** Action-cost clock — `.vchip.act` icon. */
export function KitSvgCost({ size = 14 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2" },
        h("circle", { cx: "12", cy: "12", r: "8" }),
        h("path", { d: "M12 8v4l3 2" })
    );
}

/** Range compass — `.vchip.rng` icon. */
export function KitSvgRange({ size = 14 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "2" },
        h("circle", { cx: "12", cy: "12", r: "3" }),
        h("path", { d: "M12 2v3M12 19v3M2 12h3M19 12h3" })
    );
}

/** AoE burst — generic fallback. Prefer {@link KitSvgAoeByKey}. */
export function KitSvgAoe({ size = 14 }) {
    return KitSvgAoeAura({ size });
}

function aoeIcon(size, strokeWidth, children) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth },
        ...children,
    );
}

/** Blast — origin away + circle (KIT_SVG.aoe.blast). */
export function KitSvgAoeBlast({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("rect", { x: "2.5", y: "9.5", width: "5", height: "5", rx: "0.5", fill: "currentColor", fillOpacity: ".35" }),
        h("path", { d: "M8 12h3.2", strokeLinecap: "round" }),
        h("circle", { cx: "16.5", cy: "12", r: "1.5", fill: "currentColor" }),
        h("circle", { cx: "16.5", cy: "12", r: "4.6" }),
        h("path", { d: "M16.5 7.2v1.4M16.5 15.4v1.4M11.7 12h1.4M19.9 12h1.4", opacity: ".55" }),
    ]);
}

/** Close blast — origin touches circle (KIT_SVG.aoe.closeblast). */
export function KitSvgAoeCloseblast({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("circle", { cx: "7", cy: "12", r: "2", fill: "currentColor" }),
        h("circle", { cx: "14.2", cy: "12", r: "1.35", fill: "currentColor" }),
        h("circle", { cx: "14.2", cy: "12", r: "5.2" }),
        h("path", { d: "M9.2 12h2.2", strokeLinecap: "round", opacity: ".65" }),
        h("path", { d: "M7 9.2a5.5 5.5 0 0 1 0 5.6", opacity: ".4" }),
    ]);
}

/** Aura — dashed rings on self (KIT_SVG.aoe.aura). */
export function KitSvgAoeAura({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("circle", { cx: "12", cy: "12", r: "2", fill: "currentColor" }),
        h("circle", { cx: "12", cy: "12", r: "5.2", strokeDasharray: "1.6 1.8" }),
        h("circle", { cx: "12", cy: "12", r: "8.4", strokeDasharray: "1.2 2.2", opacity: ".55" }),
        h("path", { d: "M12 2.8v1.6M12 19.6v1.6M2.8 12h1.6M19.6 12h1.6", opacity: ".35" }),
    ]);
}

/** Line — orthogonal ray (KIT_SVG.aoe.line). */
export function KitSvgAoeLine({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("path", { d: "M3 12h18", strokeLinecap: "round" }),
        h("path", { d: "M6 9v6M18 9v6" }),
        h("circle", { cx: "4", cy: "12", r: "1.4", fill: "currentColor" }),
    ]);
}

/** Arc — contiguous wedge (KIT_SVG.aoe.arc). */
export function KitSvgAoeArc({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("path", { d: "M5 18a8.5 8.5 0 0 1 14 0" }),
        h("path", { d: "M8 15a5 5 0 0 1 8 0" }),
        h("circle", { cx: "12", cy: "19", r: "1.5", fill: "currentColor" }),
    ]);
}

/** Cross — orthogonal arms (KIT_SVG.aoe.xpat). */
export function KitSvgAoeXpat({ size = 14 }) {
    return aoeIcon(size, "2", [
        h("path", { d: "M12 3v18M3 12h18", strokeLinecap: "round" }),
        h("circle", { cx: "12", cy: "12", r: "1.8", fill: "currentColor" }),
    ]);
}

const AOE_ICON = {
    blast: KitSvgAoeBlast,
    closeblast: KitSvgAoeCloseblast,
    aura: KitSvgAoeAura,
    line: KitSvgAoeLine,
    arc: KitSvgAoeArc,
    xpat: KitSvgAoeXpat,
};

/** Pick the mockup glyph for an AoE pattern key. */
export function KitSvgAoeByKey({ aoeKey, size = 14 }) {
    const Icon = AOE_ICON[aoeKey] || KitSvgAoeAura;
    return h(Icon, { size });
}

/** Price-tag — tag popover trigger (`.tag-btn`). */
export function KitSvgTag({ size = 14 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: "1.8" },
        h("path", { d: "M20.59 13.41 11.18 4H4v7.18l9.41 9.41a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83z" }),
        h("circle", { cx: "7.5", cy: "7.5", r: "1.2", fill: "currentColor" })
    );
}

function iconSvg(size, strokeWidth, children) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" },
        ...children
    );
}

/** Plate VIT — heart. */
export function KitSvgVit({ size = 15 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }),
    ]);
}

/** Plate DEF — shield. */
export function KitSvgDef({ size = 15 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
    ]);
}

/** Plate SPD — bolt. */
export function KitSvgSpd({ size = 15 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M13 2 3 14h8l-1 8 11-13h-8l0-7z" }),
    ]);
}

/** Plate FRAY — open palm. */
export function KitSvgFray({ size = 15 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M18 11V6a2 2 0 1 0-4 0v5" }),
        h("path", { d: "M14 10V4a2 2 0 1 0-4 0v8" }),
        h("path", { d: "M10 9.5V6a2 2 0 1 0-4 0v8" }),
        h("path", { d: "M18 11a6 6 0 0 1-6 10 6 6 0 0 1-6-6V8" }),
    ]);
}

/** Plate DIE — d20. */
export function KitSvgDie({ size = 22 }) {
    return iconSvg(size, "1.6", [
        h("path", { d: "M12 2 21 8.5v7L12 22 3 15.5v-7L12 2z" }),
        h("path", { d: "M12 22V12" }),
        h("path", { d: "M3 8.5 12 12 21 8.5" }),
        h("path", { d: "m7.5 5.6 9 5.4" }),
    ]);
}

/** Plate ARM — chest plate. */
export function KitSvgArm({ size = 15 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M4 7 12 3l8 4v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V7z" }),
        h("path", { d: "M12 7v13" }),
    ]);
}

/** Job-swap arrows (plate `.swap-ico`). */
export function KitSvgSwap({ size = 13 }) {
    return iconSvg(size, "1.7", [
        h("path", { d: "M7 7h11l-3-3M17 17H6l3 3" }),
        h("path", { d: "M18 7v4M6 17v-4" }),
    ]);
}

/** AP gem star. */
export function KitSvgApStar({ size = 13 }) {
    return h(
        "svg",
        { viewBox: "0 0 24 24", width: size, height: size, fill: "currentColor" },
        h("path", { d: "M12 2 14.2 9.2 22 9.5 16 14.2 18 22 12 17.8 6 22 8 14.2 2 9.5 9.8 9.2 12 2z" })
    );
}

/** Maletín briefcase. */
export function KitSvgBriefcase({ size = 20 }) {
    return iconSvg(size, "1.7", [
        h("rect", { x: "3", y: "8", width: "18", height: "12", rx: "1.5" }),
        h("path", { d: "M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
        h("path", { d: "M3 13h18" }),
    ]);
}

/** Trait-mode rail glyphs. */
export function KitSvgModePassive({ size = 22 }) {
    return iconSvg(size, "1.7", [
        h("circle", { cx: "12", cy: "12", r: "8" }),
        h("circle", { cx: "12", cy: "12", r: "3" }),
    ]);
}

export function KitSvgModeActive({ size = 22 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M13 2 3 14h8l-1 8 11-13h-8z" }),
    ]);
}

export function KitSvgModeTrigger({ size = 22 }) {
    return iconSvg(size, "1.8", [
        h("path", { d: "M13 2v8h7l-9 12v-8H4l9-12z" }),
    ]);
}

export function KitSvgModeInterrupt({ size = 22 }) {
    return iconSvg(size, "2", [
        h("path", { d: "M6 6 18 18M18 6 6 18" }),
    ]);
}
