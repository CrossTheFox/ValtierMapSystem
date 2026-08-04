/**
 * Neural Mesh graph layout — ICON job kit → radial nodes/edges.
 * Mirrors docs/mockups/skill-tree-neural-mesh.html geometry.
 */
import { isRectNodeShape, isViewportCamera, NEURAL_MESH_WORLD } from "./neuralMeshConfig";

function keyOf(a) {
    return a?.key || a?.id || "";
}

function isUnlocked(set, key) {
    return Boolean(key && set.has(key));
}

function abilityChapter(a) {
    const n = Number(a?.chapter ?? a?.unlockChapter ?? 1);
    return Number.isFinite(n) && n >= 1 ? Math.min(3, Math.floor(n)) : 1;
}

function resolveAbilityState(key, unlockedSet, chapter, ab) {
    if (isUnlocked(unlockedSet, key)) return "unlocked";
    if (abilityChapter(ab) > chapter) return "locked";
    return "unowned";
}

function resolveTalentState(key, unlockedSet, siblingKeys, abilityState) {
    if (abilityState !== "unlocked") {
        return abilityState === "locked" ? "locked" : "unowned";
    }
    if (isUnlocked(unlockedSet, key)) return "unlocked";
    if (siblingKeys.some((k) => k !== key && isUnlocked(unlockedSet, k))) return "xor-out";
    return "available";
}

function resolveMasteryState(key, unlockedSet, abilityState) {
    if (abilityState !== "unlocked") {
        return abilityState === "locked" ? "locked" : "unowned";
    }
    if (isUnlocked(unlockedSet, key)) return "unlocked";
    return "available";
}

function shortLabel(label, max = 12) {
    const s = String(label || "").trim();
    if (s.length <= max) return s.toUpperCase();
    return `${s.slice(0, max - 1)}…`.toUpperCase();
}

/** Strip "Clase:" / "Class:" so the hub shows only the job name. */
function jobHubLabel(raw, fallback) {
    let s = String(raw || fallback || "JOB").trim();
    s = s.replace(/^(clase|class)\s*:?\s*/i, "").trim();
    return shortLabel(s || fallback || "JOB", 16);
}

/** Polar → elliptical (orbital) coordinates. */
function atOrbit(cx, cy, rx, ry, ang) {
    return {
        x: cx + Math.cos(ang) * rx,
        y: cy + Math.sin(ang) * ry,
    };
}

/**
 * @param {{
 *   abilities: Array<Record<string, unknown>>,
 *   unlockedKeys?: string[],
 *   chapter?: number,
 *   jobLabel?: string,
 *   classAccent?: string,
 *   width: number,
 *   height: number,
 * }} opts
 */
export function buildNeuralMeshGraph(opts) {
    const {
        abilities = [],
        unlockedKeys = [],
        chapter = 1,
        jobLabel = "JOB",
        classAccent = "#ff66ff",
        width,
        height,
    } = opts;

    const unlockedSet = new Set((unlockedKeys || []).filter(Boolean));
    const byParent = new Map();
    for (const a of abilities) {
        const pid = a?.parentId;
        if (!pid) continue;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(a);
    }

    const classRoot = abilities.find((a) => a.type === "class_root") || null;
    const traits = abilities.filter((a) => a.type === "trait").slice(0, 6);
    const pool = abilities.filter((a) => a.type === "ability").slice(0, 7);
    const limitBreak = abilities.find((a) => a.type === "ultimate") || null;

    /** @type {Array<Record<string, unknown>>} */
    const abs = [];
    if (limitBreak) abs.push({ ...limitBreak, isLB: true });
    for (const a of pool) abs.push({ ...a, isLB: false });

    let w = Math.max(320, width || 800);
    let h = Math.max(280, height || 560);
    let cx;
    let cy;
    let Rx;
    let Ry;
    let R;

    if (isViewportCamera()) {
        /*
         * Circular world (HTML mockup computeLayout): true circumference orbits.
         * Screen size only affects the Viewport camera, not node placement.
         */
        w = NEURAL_MESH_WORLD.size;
        h = NEURAL_MESH_WORLD.size;
        cx = w * 0.5;
        cy = h * 0.5;
        R = NEURAL_MESH_WORLD.R;
        Rx = R;
        Ry = R;
    } else {
        /*
         * Fixed camera checkpoint: elliptical fit-to-stage (pre-viewport).
         * Restore via NEURAL_MESH_CAMERA_MODE = "fixed".
         */
        cx = w * 0.5;
        cy = h * 0.52;
        const padX = Math.max(36, w * 0.04);
        const padY = Math.max(44, h * 0.08);
        Rx = Math.max(120, w * 0.5 - padX);
        Ry = Math.max(100, h * 0.5 - padY);
        const aspect = w / Math.max(1, h);
        const circle = Math.min(Rx, Ry);
        if (aspect >= 1.12) {
            const stretch = Math.min(1.65, 0.95 + (aspect - 1) * 0.85);
            Rx = Math.min(Rx, circle * stretch);
            Ry = Math.min(Ry, circle * (aspect >= 1.35 ? 0.92 : 1));
        } else if (aspect < 0.92) {
            Ry = Math.min(Ry, circle * 1.25);
            Rx = circle;
        } else {
            Rx = circle;
            Ry = circle;
        }
        R = Math.min(Rx, Ry);
    }

    /** @type {Array<Record<string, unknown>>} */
    const nodes = [];
    /** @type {Array<{ from: string, to: string }>} */
    const edges = [];

    const classKey = keyOf(classRoot) || `class:${jobLabel}`;
    const classState = classRoot
        ? resolveAbilityState(classKey, unlockedSet, chapter, classRoot)
        : "unlocked";

    const hubName = jobHubLabel(classRoot?.label || jobLabel, jobLabel);
    const classR = Math.max(32, R * 0.15);
    nodes.push({
        id: classKey,
        key: classKey,
        kind: "class",
        label: hubName,
        fullLabel: hubName,
        x: cx,
        y: cy,
        r: classR,
        nw: classR * 2,
        nh: classR * 2,
        state: classState === "unlocked" ? "unlocked" : classState,
        accent: classAccent,
        data: classRoot || { label: hubName, type: "class_root", content: "" },
        parentId: null,
    });

    const fTrait = 0.36;
    const fAb = 0.62;
    const fTal = 0.82;
    const fMast = 0.94;
    const abStep = (2 * Math.PI) / Math.max(1, abs.length || 1);

    /** Sizes scale mildly with orbit so 1080p stays readable */
    const s = Math.min(1.2, Math.max(0.92, R / 200));
    const rect = isRectNodeShape();
    // "rect" = previous rectangular plates (flip NEURAL_MESH_NODE_SHAPE in neuralMeshConfig.js)
    const sizeOf = rect
        ? {
              trait: { nw: 78 * s, nh: 30 * s, r: 16 * s },
              ability: { nw: 90 * s, nh: 34 * s, r: 18 * s },
              limitbreak: { nw: 96 * s, nh: 36 * s, r: 20 * s },
              talent: { nw: 58 * s, nh: 26 * s, r: 13 * s },
              mastery: { nw: 62 * s, nh: 26 * s, r: 14 * s },
              ultimate: { nw: 82 * s, nh: 32 * s, r: 17 * s },
          }
        : {
              trait: { r: 26 * s, nw: 52 * s, nh: 52 * s },
              ability: { r: 30 * s, nw: 60 * s, nh: 60 * s },
              limitbreak: { r: 32 * s, nw: 64 * s, nh: 64 * s },
              talent: { r: 20 * s, nw: 40 * s, nh: 40 * s },
              mastery: { r: 21 * s, nw: 42 * s, nh: 42 * s },
              ultimate: { r: 28 * s, nw: 56 * s, nh: 56 * s },
          };

    traits.forEach((t, i) => {
        const gap = Math.floor(((i + 0.5) * Math.max(1, abs.length)) / Math.max(1, traits.length)) % Math.max(1, abs.length || 1);
        const ang = -Math.PI / 2 + (gap + 0.5) * abStep;
        const k = keyOf(t);
        const st = resolveAbilityState(k, unlockedSet, chapter, t);
        const sz = sizeOf.trait;
        const p = atOrbit(cx, cy, Rx * fTrait, Ry * fTrait, ang);
        nodes.push({
            id: k,
            key: k,
            kind: "trait",
            label: shortLabel(t.label, 18),
            fullLabel: t.label,
            x: p.x,
            y: p.y,
            r: sz.r,
            nw: sz.nw,
            nh: sz.nh,
            state: st,
            data: t,
            parentId: classKey,
        });
        edges.push({ from: classKey, to: k });
    });

    abs.forEach((ab, i) => {
        const ang = -Math.PI / 2 + i * abStep;
        const abKey = keyOf(ab);
        const abState = resolveAbilityState(abKey, unlockedSet, chapter, ab);
        const kind = ab.isLB ? "limitbreak" : "ability";
        const sz = sizeOf[kind];
        const p = atOrbit(cx, cy, Rx * fAb, Ry * fAb, ang);
        nodes.push({
            id: abKey,
            key: abKey,
            kind,
            label: ab.isLB ? shortLabel(ab.label || "LIMIT BREAK", 18) : shortLabel(ab.label, 18),
            fullLabel: ab.label,
            x: p.x,
            y: p.y,
            r: sz.r,
            nw: sz.nw,
            nh: sz.nh,
            state: abState,
            data: ab,
            parentId: classKey,
            angle: ang,
        });
        edges.push({ from: classKey, to: abKey });

        const kids = byParent.get(abKey) || [];
        const talents = kids.filter((x) => x.type === "upgrade").slice(0, 2);
        const mastery = kids.find((x) => x.type === "mastery") || null;
        const talKeys = talents.map(keyOf);

        if (ab.isLB) {
            if (mastery) {
                const mk = keyOf(mastery);
                const usz = sizeOf.ultimate;
                const up = atOrbit(cx, cy, Rx * fTal, Ry * fTal, ang);
                nodes.push({
                    id: mk,
                    key: mk,
                    kind: "ultimate",
                    label: shortLabel(mastery.label || "ULTIMATE", 16),
                    fullLabel: mastery.label || "Ultimate",
                    x: up.x,
                    y: up.y,
                    r: usz.r,
                    nw: usz.nw,
                    nh: usz.nh,
                    state: resolveMasteryState(mk, unlockedSet, abState),
                    data: mastery,
                    parentId: abKey,
                });
                edges.push({ from: abKey, to: mk });
            }
        } else {
            const spread = 0.16;
            talents.forEach((tal, ti) => {
                const a2 = ang + (ti === 0 ? -spread : spread);
                const tk = keyOf(tal);
                const tsz = sizeOf.talent;
                const tp = atOrbit(cx, cy, Rx * fTal, Ry * fTal, a2);
                nodes.push({
                    id: tk,
                    key: tk,
                    kind: "talent",
                    label: shortLabel(tal.label, 14),
                    fullLabel: tal.label,
                    x: tp.x,
                    y: tp.y,
                    r: tsz.r,
                    nw: tsz.nw,
                    nh: tsz.nh,
                    state: resolveTalentState(tk, unlockedSet, talKeys, abState),
                    data: { ...tal, parentAbility: ab.label },
                    parentId: abKey,
                });
                edges.push({ from: abKey, to: tk });
            });
            if (mastery) {
                const mk = keyOf(mastery);
                const msz = sizeOf.mastery;
                const mp = atOrbit(cx, cy, Rx * fMast, Ry * fMast, ang);
                nodes.push({
                    id: mk,
                    key: mk,
                    kind: "mastery",
                    label: shortLabel(mastery.label, 14),
                    fullLabel: mastery.label,
                    x: mp.x,
                    y: mp.y,
                    r: msz.r,
                    nw: msz.nw,
                    nh: msz.nh,
                    state: resolveMasteryState(mk, unlockedSet, abState),
                    data: { ...mastery, parentAbility: ab.label },
                    parentId: abKey,
                });
                edges.push({ from: abKey, to: mk });
            }
        }
    });

    return { nodes, edges, cx, cy, R, Rx, Ry, width: w, height: h, classAccent };
}

export function ancestorsOf(nodeId, edges) {
    const ids = [nodeId];
    let cur = nodeId;
    for (let i = 0; i < 12; i++) {
        const edge = edges.find((e) => e.to === cur);
        if (!edge) break;
        ids.push(edge.from);
        cur = edge.from;
    }
    return ids.reverse();
}

export function kindLabel(kind) {
    return (
        {
            class: "CLASE / JOB",
            trait: "TRAIT",
            ability: "HABILIDAD",
            limitbreak: "LIMIT BREAK",
            talent: "TALENTO",
            mastery: "MASTERY",
            ultimate: "ULTIMATE",
        }[kind] || String(kind || "").toUpperCase()
    );
}

export function stateCode(state) {
    if (state === "unlocked") return { cls: "ok", text: "OWNED" };
    if (state === "available") return { cls: "warn", text: "AVAILABLE · 1 EP" };
    if (state === "unowned") return { cls: "warn", text: "AVAILABLE · 1 EP" };
    if (state === "xor-out") return { cls: "cmt", text: "XOR · sibling taken" };
    return { cls: "cmt", text: "LOCKED" };
}
