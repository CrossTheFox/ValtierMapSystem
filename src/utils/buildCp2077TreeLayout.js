import {
    BANK_GRANTS,
    CHAPTER_CAP,
    LEVEL_META,
    NARRATIVE_BY_LEVEL,
    SKILL_TREE_LAYOUT as L,
} from "../constants/skillTreeProgression";

function abKey(a) {
    return a?.key || a?.id || "";
}

function isUnlocked(unlockedSet, key) {
    return Boolean(key && unlockedSet.has(key));
}

function abilityChapter(a) {
    const n = Number(a?.chapter ?? a?.unlockChapter ?? 1);
    return Number.isFinite(n) && n >= 1 ? Math.min(3, Math.floor(n)) : 1;
}

function traitUnlockLvl(t) {
    const n = Number(t?.unlockLvl ?? t?.unlockLevel ?? t?.level ?? 0);
    return Number.isFinite(n) ? Math.max(0, Math.min(12, Math.floor(n))) : 0;
}

function rankLabel(state) {
    if (state === "unlocked") return "OBT";
    if (state === "unowned" || state === "available") return "NO OBT";
    return "LOCK";
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
    const siblingOwned = siblingKeys.some((k) => k !== key && isUnlocked(unlockedSet, k));
    if (siblingOwned) return "xor-out";
    return "available";
}

function resolveMasteryState(key, unlockedSet, abilityState) {
    if (abilityState !== "unlocked") {
        return abilityState === "locked" ? "locked" : "unowned";
    }
    if (isUnlocked(unlockedSet, key)) return "unlocked";
    return "available";
}

/**
 * Build absolute-positioned nodes + SVG pipe segments for one job lane.
 *
 * @param {{
 *   abilities: Array<Record<string, unknown>>,
 *   unlockedKeys: string[],
 *   level: number,
 *   chapter: number,
 *   jobLabel: string,
 *   jobRole?: string,
 *   isPrimary?: boolean,
 *   jobCount?: number,
 * }} opts
 */
export function buildCp2077TreeLayout(opts) {
    const {
        abilities = [],
        unlockedKeys = [],
        level = 0,
        chapter = 1,
        jobLabel = "JOB",
        jobRole = "JOB",
        isPrimary = true,
        jobCount = 1,
    } = opts;

    const unlockedSet = new Set(unlockedKeys.filter(Boolean));
    const byParent = new Map();
    for (const a of abilities) {
        const pid = a?.parentId;
        if (!pid) continue;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid).push(a);
    }

    const classRoot = abilities.find((a) => a.type === "class_root") || null;
    const traits = abilities.filter((a) => a.type === "trait");
    const pool = abilities.filter((a) => a.type === "ability").slice(0, 8);
    const limitBreak = abilities.find((a) => a.type === "ultimate") || null;

    const cap = CHAPTER_CAP[chapter] ?? 4;
    const boardW = L.PAD_L + 13 * L.COL_W + 40;
    const xOf = (lvl) => L.PAD_L + lvl * L.COL_W + 40;

    /** @type {Array<Record<string, unknown>>} */
    const nodes = [];
    /** @type {Array<{ x1:number,y1:number,x2:number,y2:number,on:boolean,narr?:boolean }>} */
    const pipes = [];
    const spinePts = [];

    let minY = L.SPINE_Y;
    let maxY = L.SPINE_Y;

    const track = (y) => {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    };

    for (let lvl = 0; lvl <= 12; lvl++) {
        const x = xOf(lvl);
        const meta = LEVEL_META[lvl];
        const reached = lvl <= level;

        nodes.push({
            id: `head-${lvl}`,
            kind: "col-head",
            lvl,
            x,
            y: 18,
            label: lvl === 0 ? "L0" : `L${lvl}`,
            reached,
            current: lvl === level,
            gated: lvl > cap,
            combat: meta.combat,
            narrative: meta.narrative,
        });

        let baseState = reached ? "unlocked" : lvl === level + 1 && lvl <= cap ? "available" : "locked";
        if (lvl === 0) baseState = "unlocked";

        nodes.push({
            id: `base-${lvl}`,
            kind: lvl === 0 ? "class-root" : "lvl-base",
            lvl,
            x,
            y: L.SPINE_Y,
            label: lvl === 0 ? (classRoot?.label || jobLabel) : `L${lvl}`,
            rank: lvl === 0 ? "CLASS" : "BASE",
            state: baseState,
            current: lvl === level,
            blurb:
                lvl === 0
                    ? `${jobRole}. Pool del job en esta columna. Ability → T1/T2 → M →`
                    : `${meta.combat} · ${meta.narrative}`,
        });
        spinePts.push({ lvl, x, y: L.SPINE_Y, on: reached || lvl === 0 });
        track(L.SPINE_Y);

        let cursor = L.SPINE_Y;

        for (const g of BANK_GRANTS[lvl] || []) {
            cursor -= L.GAP_CHIP;
            const unlocked = level >= lvl;
            nodes.push({
                id: `grant-${lvl}-${g.kind}`,
                kind: "grant",
                grantKind: g.kind,
                lvl,
                x,
                y: cursor,
                label: g.label,
                state: unlocked ? "unlocked" : "locked",
                blurb: "Grant de nivel (banco).",
            });
            pipes.push({ x1: x, y1: L.SPINE_Y, x2: x, y2: cursor, on: unlocked });
            track(cursor);
        }

        const traitList = traits.filter((t) => {
            const ul = traitUnlockLvl(t);
            if (lvl === 0) return ul === 0;
            return ul === lvl;
        });

        for (const t of traitList) {
            cursor -= L.GAP_TRAIT;
            const key = abKey(t);
            const ul = traitUnlockLvl(t);
            const finalState = isUnlocked(unlockedSet, key) || ul <= level ? "unlocked" : "locked";

            nodes.push({
                id: key || `trait-${lvl}-${t.label}`,
                kind: "trait",
                key,
                lvl,
                x,
                y: cursor,
                label: t.label || key,
                rank: "TRAIT",
                state: finalState,
                blurb: t.content || "Job trait.",
            });
            pipes.push({ x1: x, y1: L.SPINE_Y, x2: x, y2: cursor, on: finalState === "unlocked" });
            track(cursor);
        }

        if (lvl === 1 && limitBreak) {
            cursor -= L.GAP_MAIN;
            const key = abKey(limitBreak);
            const state = isUnlocked(unlockedSet, key)
                ? "unlocked"
                : level >= 1
                  ? "available"
                  : "locked";
            nodes.push({
                id: key || "lb",
                kind: "lb",
                key,
                lvl,
                x,
                y: cursor,
                label: limitBreak.label || "LIMIT BREAK",
                rank: "LB",
                state,
                blurb: limitBreak.content || "Limit Break (Lv1).",
            });
            pipes.push({
                x1: x,
                y1: L.SPINE_Y,
                x2: x,
                y2: cursor,
                on: state === "unlocked" || state === "available",
            });
            track(cursor);
        }

        if ((lvl === 4 || lvl === 8) && isPrimary) {
            const needJobs = lvl === 4 ? 2 : 3;
            const expanded = jobCount >= needJobs;
            const state = expanded ? "unlocked" : level >= lvl ? "available" : "locked";
            cursor -= L.GAP_MAIN;
            nodes.push({
                id: `gate-${lvl}`,
                kind: "gate",
                lvl,
                x,
                y: cursor,
                label: lvl === 4 ? "JOB 2" : "JOB 3",
                rank: "GATE",
                state,
                blurb: "Nuevo job (+2 AP) o profundizar (+1 MP).",
            });
            pipes.push({
                x1: x,
                y1: L.SPINE_Y,
                x2: x,
                y2: cursor,
                on: state === "unlocked" || state === "available",
            });
            track(cursor);
        }

        if (lvl === 0) {
            let prevY = cursor;
            pool.forEach((a, i) => {
                cursor -= i === 0 ? L.GAP_MAIN : L.GAP_ABILITY;
                const key = abKey(a);
                const aState = resolveAbilityState(key, unlockedSet, chapter, a);
                pipes.push({
                    x1: x,
                    y1: prevY,
                    x2: x,
                    y2: cursor,
                    on: aState === "unlocked",
                });

                nodes.push({
                    id: key || `ab-${i}`,
                    kind: "ability",
                    key,
                    lvl: 0,
                    x,
                    y: cursor,
                    label: a.label || key,
                    rank: rankLabel(aState),
                    state: aState,
                    chapter: abilityChapter(a),
                    blurb: a.content || "",
                });
                track(cursor);

                const kids = byParent.get(key) || [];
                const talents = kids.filter((k) => k.type === "upgrade").slice(0, 2);
                const mastery = kids.find((k) => k.type === "mastery") || null;
                const talentKeys = talents.map(abKey);
                const tx = x + L.TALENT_DX;
                const t1y = cursor - L.TALENT_DY;
                const t2y = cursor + L.TALENT_DY;
                const mx = x + L.MASTERY_DX;
                const my = cursor;
                const branchLive = aState === "unlocked";

                talents.forEach((t, ti) => {
                    const ty = ti === 0 ? t1y : t2y;
                    const tKey = abKey(t);
                    const tState = resolveTalentState(tKey, unlockedSet, talentKeys, aState);
                    nodes.push({
                        id: tKey || `${key}-t${ti}`,
                        kind: "talent",
                        key: tKey,
                        parentKey: key,
                        x: tx,
                        y: ty,
                        label: t.label || `T${ti + 1}`,
                        glyph: `T${ti + 1}`,
                        state: tState,
                        blurb: t.content || `Talent ${ti + 1} (XOR)`,
                    });
                    track(ty);
                    pipes.push({
                        x1: x,
                        y1: cursor,
                        x2: tx,
                        y2: ty,
                        on: branchLive && (tState === "unlocked" || tState === "available"),
                    });
                    if (mastery) {
                        const mState = resolveMasteryState(abKey(mastery), unlockedSet, aState);
                        pipes.push({
                            x1: tx,
                            y1: ty,
                            x2: mx,
                            y2: my,
                            on:
                                branchLive &&
                                (tState === "unlocked" || tState === "available") &&
                                (mState === "unlocked" || mState === "available"),
                        });
                    }
                });

                if (mastery) {
                    const mKey = abKey(mastery);
                    const mState = resolveMasteryState(mKey, unlockedSet, aState);
                    nodes.push({
                        id: mKey || `${key}-ma`,
                        kind: "mastery",
                        key: mKey,
                        parentKey: key,
                        x: mx,
                        y: my,
                        label: mastery.label || "M",
                        glyph: "M",
                        state: mState,
                        blurb: mastery.content || "Mastery",
                    });
                    track(my);
                } else if (talents.length) {
                    // Placeholder mastery ring so branch shape stays readable
                    nodes.push({
                        id: `${key}-ma-ghost`,
                        kind: "mastery",
                        key: null,
                        parentKey: key,
                        x: mx,
                        y: my,
                        label: "—",
                        glyph: "M",
                        state: branchLive ? "locked" : aState === "locked" ? "locked" : "unowned",
                        blurb: "Sin mastery en datos.",
                    });
                    track(my);
                }

                prevY = cursor;
            });
        }

        const narrItems = NARRATIVE_BY_LEVEL[lvl] || [];
        narrItems.forEach((label, i) => {
            const ny = L.SPINE_Y + L.NARR_START + i * L.NARR_GAP;
            const unlocked = lvl === 0 || level >= lvl;
            nodes.push({
                id: `narr-${lvl}-${i}`,
                kind: "narrative",
                lvl,
                x,
                y: ny,
                label,
                state: unlocked ? "unlocked" : "locked",
                blurb: meta.narrative,
            });
            pipes.push({ x1: x, y1: L.SPINE_Y, x2: x, y2: ny, on: unlocked, narr: true });
            track(ny);
        });
    }

    for (let i = 0; i < spinePts.length - 1; i++) {
        const a = spinePts[i];
        const b = spinePts[i + 1];
        pipes.push({
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            on: a.lvl < level || (a.lvl <= level && b.lvl <= level),
        });
    }

    const padTop = 40;
    const padBottom = 36;
    const contentTop = Math.min(minY, 18) - padTop;
    const contentBottom = maxY + padBottom;
    const offsetY = contentTop < 0 ? -contentTop : 0;
    const boardH = Math.max(L.SPINE_Y + 200, contentBottom + offsetY + 8);

    const shiftNodes = nodes.map((n) => ({ ...n, y: (n.y || 0) + offsetY }));
    const shiftPipes = pipes.map((p) => ({
        ...p,
        y1: p.y1 + offsetY,
        y2: p.y2 + offsetY,
    }));
    const spineY = L.SPINE_Y + offsetY;

    let unlockedCount = 0;
    for (const n of shiftNodes) {
        if (
            (n.kind === "ability" ||
                n.kind === "talent" ||
                n.kind === "mastery" ||
                n.kind === "trait" ||
                n.kind === "lb" ||
                n.kind === "narrative") &&
            n.state === "unlocked"
        ) {
            unlockedCount += 1;
        }
    }

    return {
        boardW,
        boardH,
        spineY,
        nodes: shiftNodes,
        pipes: shiftPipes,
        unlockedCount,
        classRoot,
        jobLabel: classRoot?.label || jobLabel,
        cap,
    };
}

export { rankLabel };
