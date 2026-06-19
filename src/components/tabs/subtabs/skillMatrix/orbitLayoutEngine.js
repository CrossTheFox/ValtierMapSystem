import { UI_COLORS } from "../../../../constants/uiColors";

export const D2R = (d) => (d * Math.PI) / 180;

export function archGlow(arch) {
    const a = (arch || "").toLowerCase();
    if (a === "wright") return UI_COLORS.anomaly;
    if (a === "stalwart") return "#ff3355";
    if (a === "vagabond") return "#ffcc00";
    if (a === "mendicant") return "#66ff99";
    return UI_COLORS.accent;
}

/** Bisector base (°) por índice fijo en `assignedClassIds` — orden del documento. */
export const BASE_BISECTORS_BY_COUNT = {
    1: [-90],
    2: [-90, 90],
    3: [-90, 150, 30],
};

/** Apertura media del gajo (°): 1 job = semicírculo superior; 2 = mitades; 3 = 120°. */
export const HALF_SPAN_BY_COUNT = {
    1: 90,
    2: 90,
    3: 60,
};

export const SECTOR_EDGE_PAD_DEG = 5;

export const ORBIT_FRAC = {
    class: 0.055,
    trait: 0.295,
    ability: 0.455,
    upgrade: 0.595,
    mastery: 0.755,
    lb: 0.91,
};

export const LB_MASTERY_OFFSET_DEG = 12;

export function normalizeDeg(d) {
    let x = d % 360;
    if (x <= -180) x += 360;
    if (x > 180) x -= 360;
    return x;
}

export function polar(cx, cy, r, deg) {
    const rad = D2R(deg);
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}

export function wedgePath(bisectorDeg, halfSpanDeg, cx, cy, rOut) {
    const a0 = bisectorDeg - halfSpanDeg;
    const a1 = bisectorDeg + halfSpanDeg;
    const p0 = polar(cx, cy, rOut, a0);
    const p1 = polar(cx, cy, rOut, a1);
    const largeArc = Math.abs(a1 - a0) >= 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${rOut} ${rOut} 0 ${largeArc} 1 ${p1.x} ${p1.y} Z`;
}

function abilityByKey(laneAbs) {
    return Object.fromEntries(laneAbs.map((a) => [a.key, a]));
}

export function collectCrossAbilityEdges(laneAbs, nodeKeys) {
    const byKey = abilityByKey(laneAbs);
    /** @type {{ k1: string, k2: string, dash?: boolean, col: string }[]} */
    const extra = [];
    for (const a of laneAbs) {
        if (a.type !== "ability") continue;
        const req = a.requiresKey || a.requiresAbilityKey || a.prerequisiteKey;
        if (typeof req === "string" && nodeKeys.has(req) && nodeKeys.has(a.key)) {
            extra.push({ k1: req, k2: a.key, dash: true, col: "rgba(255,200,120,0.78)" });
        }
        const raw = a.unlocksKeys ?? a.unlocks;
        const unlocks = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
        for (const u of unlocks) {
            if (typeof u === "string" && nodeKeys.has(a.key) && nodeKeys.has(u)) {
                extra.push({ k1: a.key, k2: u, dash: false, col: "rgba(120,220,255,0.72)" });
            }
        }
        const pid = a.parentId;
        if (typeof pid === "string" && byKey[pid]?.type === "ability" && nodeKeys.has(pid) && nodeKeys.has(a.key)) {
            extra.push({ k1: pid, k2: a.key, dash: true, col: "rgba(255,255,255,0.38)" });
        }
    }
    return extra;
}

export function orbitGuideMeta(geom) {
    const f = ORBIT_FRAC;
    const gapBeforeLb = (f.mastery + f.lb) / 2;
    const radii = [f.class, f.trait, f.ability, f.upgrade, f.mastery, gapBeforeLb, f.lb];
    return { radii, dashedGuideIndex: 5 };
}

export function anglesInSector(bisectorDeg, count, halfSpanDeg, edgePad = SECTOR_EDGE_PAD_DEG) {
    if (count <= 0) return [];
    const start = bisectorDeg - halfSpanDeg + edgePad;
    const end = bisectorDeg + halfSpanDeg - edgePad;
    const span = end - start;
    if (count === 1) return [bisectorDeg];
    return Array.from({ length: count }, (_, i) => start + ((i + 0.5) / count) * span);
}

export function upgradeFanDeg(abilityCount) {
    if (abilityCount <= 3) return 7;
    if (abilityCount <= 5) return 6;
    if (abilityCount <= 6) return 5.5;
    return 4.25;
}

export function stableSortNodes(arr) {
    return [...(arr || [])].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

/**
 * @param {number} bisectorDeg
 * @param {number} halfSpanDeg
 * @param {{ cx: number, cy: number, rOut: number }} geom
 */
export function layoutSectorBranch(bisectorDeg, halfSpanDeg, treeData, classRoot, accent, laneAbs, geom) {
    const { cx, cy, rOut } = geom;
    /** @type {Map<string, { x: number, y: number, ability: Record<string, unknown> }>} */
    const items = new Map();
    /** @type {{ x1: number, y1: number, x2: number, y2: number, accent: string, dash?: boolean }[]} */
    const edges = [];

    const pushEdge = (k1, k2, col, dash = false) => {
        const a = items.get(k1);
        const b = items.get(k2);
        if (!a || !b) return;
        edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, accent: col, dash });
    };

    const add = (ability, r, angDeg) => {
        if (!ability?.key) return;
        const { x, y } = polar(cx, cy, r, angDeg);
        items.set(ability.key, { x, y, ability, angleDeg: angDeg, r });
    };

    const byParent = new Map();
    for (const s of [...(treeData?.upgrades || []), ...(treeData?.masteries || [])]) {
        const p = s.parentId;
        if (!p) continue;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p).push(s);
    }

    const lb = treeData?.limitBreak;
    const f = ORBIT_FRAC;
    const guideMeta = orbitGuideMeta(geom);

    const rClass = rOut * f.class;
    const rTrait = rOut * f.trait;
    const rAbility = rOut * f.ability;
    const rUpgrade = rOut * f.upgrade;
    const rMastery = rOut * f.mastery;
    const rLb = rOut * f.lb;

    if (classRoot?.key) {
        add(classRoot, rClass, bisectorDeg);
    }

    const traits = [...(treeData?.traits || [])].slice(0, 6);
    const traitAngles = anglesInSector(bisectorDeg, traits.length, halfSpanDeg);
    traits.forEach((t, i) => {
        add(t, rTrait, traitAngles[i]);
        if (classRoot?.key) {
            const col = t.parentId === classRoot.key ? `${accent}99` : "rgba(255,255,255,0.22)";
            pushEdge(classRoot.key, t.key, col, true);
        }
    });

    if (lb?.key) {
        add(lb, rLb, bisectorDeg);
        if (classRoot?.key) pushEdge(classRoot.key, lb.key, "#ff0055dd");
    }

    const abilities = [...(treeData?.abilities || [])].slice(0, 8);
    const abilityAngles = anglesInSector(bisectorDeg, abilities.length, halfSpanDeg);
    const fan = upgradeFanDeg(abilities.length);
    abilities.forEach((ab, i) => {
        const ang = abilityAngles[i];
        add(ab, rAbility, ang);
        if (classRoot?.key) {
            if (ab.parentId === classRoot.key) pushEdge(classRoot.key, ab.key, `${accent}55`, true);
            else if (lb?.key && ab.parentId === lb.key) pushEdge(lb.key, ab.key, "#ff005566", true);
            else if (ab.parentId && items.has(ab.parentId)) pushEdge(ab.parentId, ab.key, "rgba(255,255,255,0.28)", true);
            else pushEdge(classRoot.key, ab.key, "rgba(255,255,255,0.2)", true);
        }
        const ups = stableSortNodes((byParent.get(ab.key) || []).filter((x) => x.type === "upgrade")).slice(0, 2);
        if (ups.length === 1) {
            add(ups[0], rUpgrade, ang);
            pushEdge(ab.key, ups[0].key, `${accent}aa`);
        } else if (ups.length >= 2) {
            add(ups[0], rUpgrade, ang - fan);
            add(ups[1], rUpgrade, ang + fan);
            pushEdge(ab.key, ups[0].key, `${accent}aa`);
            pushEdge(ab.key, ups[1].key, `${accent}aa`);
        }
        const masList = (byParent.get(ab.key) || []).filter((x) => x.type === "mastery" && x.parentId !== lb?.key);
        const mas = stableSortNodes(masList)[0];
        if (mas?.key) {
            add(mas, rMastery, ang);
            pushEdge(ab.key, mas.key, "#ffaa00cc");
        }
    });

    if (lb?.key) {
        const lbMas = stableSortNodes((byParent.get(lb.key) || []).filter((x) => x.type === "mastery"))[0];
        if (lbMas?.key) {
            add(lbMas, rLb, bisectorDeg + LB_MASTERY_OFFSET_DEG);
            pushEdge(lb.key, lbMas.key, "#ffcc66dd");
        }
    }

    const nodeKeys = new Set(items.keys());
    for (const { k1, k2, dash, col } of collectCrossAbilityEdges(laneAbs, nodeKeys)) {
        pushEdge(k1, k2, col, dash);
    }

    return {
        items,
        edges,
        spine: { bis: bisectorDeg, r0: rClass, r1: rLb, accent },
        orbitGuideFracs: guideMeta.radii,
        dashedGuideIndex: guideMeta.dashedGuideIndex,
    };
}

/** @param {Record<string, unknown>} character */
export function buildWheelModel(character) {
    const ids = (character?.assignedClassIds || []).filter((id) => typeof id === "string" && id.length > 0);
    if (ids.length >= 1) {
        const active =
            typeof character?.activeClassId === "string" && ids.includes(character.activeClassId)
                ? character.activeClassId
                : ids[0];
        const activeIdx = Math.max(0, ids.indexOf(active));
        return { mode: "multiclass", ids, jobCount: ids.length, activeClassId: active, activeIdx };
    }
    return { mode: "legacy", ids: [], jobCount: 1, activeClassId: null, activeIdx: 0 };
}

export function sectorLabel(slotIndex, jobCount, isActive) {
    if (jobCount <= 1) return "JOB";
    if (jobCount === 2) return isActive ? "ACTIVA · ARRIBA" : "SEGUNDO JOB";
    if (isActive) return "ACTIVA";
    return slotIndex === 1 ? "2º JOB" : "3º JOB";
}
