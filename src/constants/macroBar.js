/**
 * Character macro bar: 9 pages × 10 slots.
 * Types: ability / trait / ultimate / object / shortcut / custom.
 * Custom macros (user-authored formulas) are planned — see docs/vtt.md.
 *
 * Firestore forbids nested arrays, so the persisted shape is:
 *   { pages: [ { slots: [slot|null, ...] }, ... ] }
 * In-memory helpers still expose `pages[p][s]` via normalizeMacroBar().
 */

export const MACRO_PAGE_COUNT = 9;
export const MACRO_SLOT_COUNT = 10;

export const MACRO_SLOT_TYPES = Object.freeze({
    ABILITY: "ability",
    TRAIT: "trait",
    ULTIMATE: "ultimate",
    OBJECT: "object",
    SHORTCUT: "shortcut",
    /** Planned: player-authored roll/text macros (not implemented yet). */
    CUSTOM: "custom",
});

const TYPE_SET = new Set(Object.values(MACRO_SLOT_TYPES));

/**
 * In-memory empty bar: pages[pageIndex][slotIndex]
 * @returns {{ pages: Array<Array<null|object>> }}
 */
export function emptyMacroBar() {
    return {
        pages: Array.from({ length: MACRO_PAGE_COUNT }, () =>
            Array.from({ length: MACRO_SLOT_COUNT }, () => null),
        ),
    };
}

/**
 * @param {unknown} slot
 * @returns {null|{ type: string, id: string, label: string, blurb: string }}
 */
export function sanitizeMacroSlot(slot) {
    if (!slot || typeof slot !== "object") return null;
    const type = String(slot.type || "").toLowerCase();
    if (!TYPE_SET.has(type)) return null;
    const id = String(slot.id || slot.abilityKey || slot.shortcutKey || "").trim();
    if (!id && type !== MACRO_SLOT_TYPES.CUSTOM) return null;
    return {
        type,
        id,
        label: String(slot.label || "").slice(0, 80),
        blurb: String(slot.blurb || slot.content || "").slice(0, 280),
    };
}

function readPageSlots(page) {
    if (Array.isArray(page?.slots)) return page.slots;
    // Legacy / in-memory nested array
    if (Array.isArray(page)) return page;
    return [];
}

/**
 * Normalize any stored/in-memory shape → nested arrays for UI.
 * @param {unknown} raw
 * @returns {{ pages: Array<Array<null|object>> }}
 */
export function normalizeMacroBar(raw) {
    const out = emptyMacroBar();
    if (!raw || typeof raw !== "object") return out;
    const pages = Array.isArray(raw.pages) ? raw.pages : [];
    for (let p = 0; p < MACRO_PAGE_COUNT; p++) {
        const src = readPageSlots(pages[p]);
        for (let s = 0; s < MACRO_SLOT_COUNT; s++) {
            out.pages[p][s] = sanitizeMacroSlot(src[s]);
        }
    }
    return out;
}

/**
 * Firestore-safe payload (no nested arrays).
 * @param {unknown} bar
 * @returns {{ pages: Array<{ slots: Array<object|null> }> }}
 */
export function serializeMacroBar(bar) {
    const normalized = normalizeMacroBar(bar);
    return {
        pages: normalized.pages.map((slots) => ({
            slots: slots.map((s) => (s ? { ...s } : null)),
        })),
    };
}

/**
 * @param {{ pages?: unknown }|null|undefined} bar
 * @param {number} page
 * @param {number} slot
 * @param {object|null} entry
 * @returns {{ pages: Array<Array<null|object>> }}
 */
export function setMacroSlot(bar, page, slot, entry) {
    const next = normalizeMacroBar(bar);
    const p = Math.max(0, Math.min(MACRO_PAGE_COUNT - 1, Math.floor(Number(page) || 0)));
    const s = Math.max(0, Math.min(MACRO_SLOT_COUNT - 1, Math.floor(Number(slot) || 0)));
    next.pages[p][s] = sanitizeMacroSlot(entry);
    return next;
}

/**
 * Place entry in page/slot, removing any other copies of the same id (move, don't duplicate).
 */
export function placeMacroEntry(bar, page, slot, entry) {
    const clean = sanitizeMacroSlot(entry);
    const next = normalizeMacroBar(bar);
    const p = Math.max(0, Math.min(MACRO_PAGE_COUNT - 1, Math.floor(Number(page) || 0)));
    const s = Math.max(0, Math.min(MACRO_SLOT_COUNT - 1, Math.floor(Number(slot) || 0)));
    if (clean?.id) {
        for (let pi = 0; pi < MACRO_PAGE_COUNT; pi += 1) {
            for (let si = 0; si < MACRO_SLOT_COUNT; si += 1) {
                if (next.pages[pi][si]?.id === clean.id) next.pages[pi][si] = null;
            }
        }
    }
    next.pages[p][s] = clean;
    return next;
}

/** @returns {{ page: number, slot: number }|null} */
export function findMacroPin(bar, entryId) {
    const id = String(entryId || "").trim();
    if (!id) return null;
    const normalized = normalizeMacroBar(bar);
    for (let p = 0; p < MACRO_PAGE_COUNT; p += 1) {
        for (let s = 0; s < MACRO_SLOT_COUNT; s += 1) {
            if (normalized.pages[p][s]?.id === id) return { page: p, slot: s };
        }
    }
    return null;
}

export function countMacroSlotsFilled(bar) {
    const normalized = normalizeMacroBar(bar);
    let n = 0;
    for (let p = 0; p < MACRO_PAGE_COUNT; p += 1) {
        for (let s = 0; s < MACRO_SLOT_COUNT; s += 1) {
            if (normalized.pages[p][s]) n += 1;
        }
    }
    return n;
}

/** Prefer the bar with more filled slots (avoids empty sheet stubs wiping live HUD). */
export function mergeMacroBarPreferFilled(primary, fallback) {
    const a = normalizeMacroBar(primary);
    const b = normalizeMacroBar(fallback);
    return countMacroSlotsFilled(a) >= countMacroSlotsFilled(b) ? a : b;
}

/**
 * Accent color for slot type chips / borders.
 * Always `#RRGGBB` so `${accent}aa` alpha suffixes stay valid CSS.
 * Trait=cyan · Ability=magenta · LB=danger red · Object=yellow · Shortcut/other=silver.
 * @param {string} type
 */
export function macroTypeAccent(type) {
    switch (type) {
        case MACRO_SLOT_TYPES.TRAIT:
            return "#00f2ea";
        case MACRO_SLOT_TYPES.ABILITY:
            return "#ff66ff";
        case MACRO_SLOT_TYPES.ULTIMATE:
            return "#ff3355";
        case MACRO_SLOT_TYPES.OBJECT:
            return "#f5c542";
        case MACRO_SLOT_TYPES.SHORTCUT:
            return "#c5cad6";
        case MACRO_SLOT_TYPES.CUSTOM:
            return "#d0a8ff";
        default:
            return "#c5cad6";
    }
}

/** Append 2-digit hex alpha to `#RRGGBB`. Safe no-op for non-hex (e.g. rgba borders). */
export function withHexAlpha(color, aa = "33") {
    const c = String(color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return `${c}${aa}`;
    return c;
}

/** Human label for hover meta (LB → Limit Break). */
export function macroTypeLabel(type) {
    switch (type) {
        case MACRO_SLOT_TYPES.TRAIT:
            return "TRAIT";
        case MACRO_SLOT_TYPES.ABILITY:
            return "ABILITY";
        case MACRO_SLOT_TYPES.ULTIMATE:
            return "LIMIT BREAK · LB";
        case MACRO_SLOT_TYPES.OBJECT:
            return "OBJECT";
        case MACRO_SLOT_TYPES.SHORTCUT:
            return "SHORTCUT";
        case MACRO_SLOT_TYPES.CUSTOM:
            return "CUSTOM";
        default:
            return String(type || "MACRO").toUpperCase();
    }
}

/**
 * Short label shown inside a slot rectangle.
 * @param {{ label?: string, type?: string }|null} slot
 */
export function macroSlotShortLabel(slot) {
    if (!slot) return "";
    if (slot.type === MACRO_SLOT_TYPES.ULTIMATE) return "LB";
    const raw = String(slot.label || slot.id || "?").trim();
    return raw.slice(0, 8).toUpperCase() || "?";
}
