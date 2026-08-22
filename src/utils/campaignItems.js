/**
 * Unique campaign items (RE4 briefcase). Path: campaigns/{id}/items/{itemId}
 */

import { UI_COLORS } from "../constants/uiColors.js";
import { COMBAT_STAT_KEYS } from "../constants/combatStats.js";
import { cloneMask, compactMaskFromCells, isPlaced, normalizeBriefcase } from "./briefcaseGrid.js";

export const ITEM_TYPES = Object.freeze({
    WEAPON: "weapon",
    AMMO: "ammo",
    CONSUMABLE: "consumable",
    KEY: "key",
    RELIC: "relic",
    JUNK: "junk",
});

export const ITEM_TYPE_META = Object.freeze({
    [ITEM_TYPES.WEAPON]: { label: "ARMA", color: UI_COLORS.accent },
    [ITEM_TYPES.AMMO]: { label: "MUN", color: UI_COLORS.anomaly },
    [ITEM_TYPES.CONSUMABLE]: { label: "CONS", color: UI_COLORS.boon },
    [ITEM_TYPES.KEY]: { label: "LLAVE", color: UI_COLORS.loot },
    [ITEM_TYPES.RELIC]: { label: "RELQ", color: UI_COLORS.accentStrong },
    [ITEM_TYPES.JUNK]: { label: "CHAT", color: UI_COLORS.textSecondary },
});

export const ITEM_RARITY = Object.freeze({
    COMMON: "common",
    UNCOMMON: "uncommon",
    RARE: "rare",
    LEGENDARY: "legendary",
});

export const ITEM_RARITY_META = Object.freeze({
    [ITEM_RARITY.COMMON]: { label: "COMÚN", color: UI_COLORS.textSecondary },
    [ITEM_RARITY.UNCOMMON]: { label: "POCO COMÚN", color: UI_COLORS.boon },
    [ITEM_RARITY.RARE]: { label: "RARO", color: UI_COLORS.anomaly },
    [ITEM_RARITY.LEGENDARY]: { label: "LEGENDARIO", color: UI_COLORS.loot },
});

export const ITEM_OWNER = Object.freeze({
    VAULT: "vault",
    CHARACTER: "character",
});

/** Kinds the DM can tick on an equipable item (a weapon may allow all). */
export const ITEM_EQUIP_KINDS = Object.freeze({
    HEAD: "head",
    CHEST: "chest",
    BACK: "back",
    HANDS: "hands",
    LEGS: "legs",
});

export const ITEM_EQUIP_KIND_META = Object.freeze({
    [ITEM_EQUIP_KINDS.HEAD]: { label: "CABEZA", color: UI_COLORS.anomaly },
    [ITEM_EQUIP_KINDS.CHEST]: { label: "PECHO", color: UI_COLORS.accent },
    [ITEM_EQUIP_KINDS.BACK]: { label: "ESPALDA", color: UI_COLORS.loot },
    [ITEM_EQUIP_KINDS.HANDS]: { label: "MANOS", color: UI_COLORS.boon },
    [ITEM_EQUIP_KINDS.LEGS]: { label: "PIERNAS", color: UI_COLORS.danger },
});

/** Physical nodes on the character rig. Hands kind maps to L + R. */
export const ITEM_EQUIP_NODES = Object.freeze({
    HEAD: "head",
    CHEST: "chest",
    BACK: "back",
    HAND_L: "handL",
    HAND_R: "handR",
    LEGS: "legs",
});

/** Humanoid doll: head top, chest center, back upper-right, hands out, legs bottom. */
export const ITEM_EQUIP_NODE_META = Object.freeze({
    [ITEM_EQUIP_NODES.HEAD]: {
        label: "CABEZA",
        kind: ITEM_EQUIP_KINDS.HEAD,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.HEAD].color,
        x: "50%",
        y: "11%",
    },
    [ITEM_EQUIP_NODES.BACK]: {
        label: "ESPALDA",
        kind: ITEM_EQUIP_KINDS.BACK,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.BACK].color,
        x: "84%",
        y: "26%",
    },
    [ITEM_EQUIP_NODES.CHEST]: {
        label: "PECHO",
        kind: ITEM_EQUIP_KINDS.CHEST,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.CHEST].color,
        x: "50%",
        y: "42%",
    },
    [ITEM_EQUIP_NODES.HAND_L]: {
        label: "MANO L",
        kind: ITEM_EQUIP_KINDS.HANDS,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.HANDS].color,
        x: "16%",
        y: "58%",
    },
    [ITEM_EQUIP_NODES.HAND_R]: {
        label: "MANO R",
        kind: ITEM_EQUIP_KINDS.HANDS,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.HANDS].color,
        x: "84%",
        y: "58%",
    },
    [ITEM_EQUIP_NODES.LEGS]: {
        label: "PIERNAS",
        kind: ITEM_EQUIP_KINDS.LEGS,
        color: ITEM_EQUIP_KIND_META[ITEM_EQUIP_KINDS.LEGS].color,
        x: "50%",
        y: "88%",
    },
});

const EQUIP_KIND_SET = new Set(Object.values(ITEM_EQUIP_KINDS));
const EQUIP_NODE_SET = new Set(Object.values(ITEM_EQUIP_NODES));

export function sanitizeEquipSlots(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const v of raw) {
        if (EQUIP_KIND_SET.has(v) && !out.includes(v)) out.push(v);
    }
    return out;
}

export function sanitizeEquipNode(raw) {
    return EQUIP_NODE_SET.has(raw) ? raw : null;
}

export function nodeToEquipKind(nodeId) {
    return ITEM_EQUIP_NODE_META[nodeId]?.kind || null;
}

export function isEquipped(item) {
    return Boolean(sanitizeEquipNode(item?.equippedSlot));
}

export function canEquipOnNode(item, nodeId) {
    if (!item?.equipable) return false;
    const kind = nodeToEquipKind(nodeId);
    if (!kind) return false;
    return sanitizeEquipSlots(item.equipSlots).includes(kind);
}

export function equippedByNode(items) {
    const map = {};
    for (const it of items || []) {
        const slot = sanitizeEquipNode(it?.equippedSlot);
        if (slot) map[slot] = it;
    }
    return map;
}

export const ITEM_EFFECT_TYPES = Object.freeze({
    STAT_MOD: "stat_mod",
    ACTION_BOON: "action_boon",
    GRANT_TRAIT: "grant_trait",
    GRANT_ABILITY: "grant_ability",
});

export const ITEM_EFFECT_LABELS = Object.freeze({
    [ITEM_EFFECT_TYPES.STAT_MOD]: "Mod de stat",
    [ITEM_EFFECT_TYPES.ACTION_BOON]: "Bono de Action",
    [ITEM_EFFECT_TYPES.GRANT_TRAIT]: "Otorga Trait",
    [ITEM_EFFECT_TYPES.GRANT_ABILITY]: "Otorga Ability",
});

const TYPE_SET = new Set(Object.values(ITEM_TYPES));
const RARITY_SET = new Set(Object.values(ITEM_RARITY));
const EFFECT_SET = new Set(Object.values(ITEM_EFFECT_TYPES));
const STAT_SET = new Set(COMBAT_STAT_KEYS);

function newId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `it-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function bitsToMask(store) {
    const cols = Math.max(1, Math.floor(Number(store?.cols ?? store?.w) || 0));
    const rows = Math.max(1, Math.floor(Number(store?.rows ?? store?.h) || 0));
    const bits = Array.isArray(store?.bits) ? store.bits : [];
    const out = [];
    for (let y = 0; y < rows; y++) {
        const row = [];
        for (let x = 0; x < cols; x++) row.push(bits[y * cols + x] ? 1 : 0);
        out.push(row);
    }
    return out;
}

/**
 * Firestore rejects nested arrays (`[[1,0],[1,1]]`). Persist occupied cells
 * as an array of maps `{x,y}` plus bbox size.
 */
export function maskToStore(mask) {
    const m = sanitizeMask(mask);
    const cells = [];
    for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < (m[y]?.length || 0); x++) {
            if (m[y][x]) cells.push({ x, y });
        }
    }
    if (!cells.length) cells.push({ x: 0, y: 0 });
    return { w: m[0]?.length || 1, h: m.length, cells };
}

function sanitizeMask(raw) {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        if (Array.isArray(raw.cells) && raw.cells.length) {
            const packed = compactMaskFromCells(raw.cells);
            if (packed?.mask?.length) return packed.mask;
        }
        if (Array.isArray(raw.bits)) raw = bitsToMask(raw);
    }
    if (!Array.isArray(raw) || !raw.length) return [[1]];
    const rows = raw
        .filter((row) => Array.isArray(row) && row.length)
        .map((row) => row.map((v) => (v ? 1 : 0)));
    if (!rows.length) return [[1]];
    const w = Math.max(...rows.map((r) => r.length));
    return rows.map((r) => {
        const next = r.slice(0, w);
        while (next.length < w) next.push(0);
        return next;
    });
}

/**
 * @param {unknown} raw
 * @returns {null|{ type: string, targetId: string, amount?: number }}
 */
export function normalizeItemEffect(raw) {
    if (!raw || typeof raw !== "object") return null;
    const type = String(raw.type || "").toLowerCase();
    if (!EFFECT_SET.has(type)) return null;
    const targetId = typeof raw.targetId === "string" ? raw.targetId.trim() : "";
    if (type === ITEM_EFFECT_TYPES.STAT_MOD) {
        const amt = Math.trunc(Number(raw.amount));
        const amount = Number.isFinite(amt) ? Math.max(-4, Math.min(4, amt || 1)) : 1;
        return { type, targetId: STAT_SET.has(targetId) ? targetId : "", amount };
    }
    if (type === ITEM_EFFECT_TYPES.ACTION_BOON) {
        const amt = Number(raw.amount);
        return { type, targetId, amount: amt === 2 ? 2 : 1 };
    }
    return { type, targetId };
}

export function emptyItem(partial = {}) {
    const ownerType = partial.ownerType === ITEM_OWNER.CHARACTER
        ? ITEM_OWNER.CHARACTER
        : ITEM_OWNER.VAULT;
    return normalizeItem({
        id: partial.id || newId(),
        name: partial.name || "",
        type: partial.type || ITEM_TYPES.JUNK,
        rarity: partial.rarity || ITEM_RARITY.COMMON,
        description: partial.description || "",
        qty: partial.qty,
        mask: partial.mask || [[1]],
        rot: partial.rot || 0,
        ownerType,
        ownerCharacterId: ownerType === ITEM_OWNER.CHARACTER
            ? (partial.ownerCharacterId || null)
            : null,
        gx: partial.gx,
        gy: partial.gy,
        effect: partial.effect || null,
        imageUrl: partial.imageUrl || null,
        equipable: Boolean(partial.equipable),
        equipSlots: partial.equipSlots,
        equippedSlot: partial.equippedSlot || null,
        campaignId: partial.campaignId || null,
        createdBy: partial.createdBy || null,
    });
}

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function normalizeItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    if (!id) return null;
    const type = TYPE_SET.has(raw.type) ? raw.type : ITEM_TYPES.JUNK;
    const rarity = RARITY_SET.has(raw.rarity) ? raw.rarity : ITEM_RARITY.COMMON;
    const ownerType = raw.ownerType === ITEM_OWNER.CHARACTER
        ? ITEM_OWNER.CHARACTER
        : ITEM_OWNER.VAULT;
    const ownerCharacterId =
        ownerType === ITEM_OWNER.CHARACTER
        && typeof raw.ownerCharacterId === "string"
        && raw.ownerCharacterId
            ? raw.ownerCharacterId
            : null;
    const rot = ((Number(raw.rot) || 0) % 4 + 4) % 4;
    const gxRaw = Number(raw.gx);
    const gyRaw = Number(raw.gy);
    const placed = Number.isInteger(gxRaw) && Number.isInteger(gyRaw);
    const qtyRaw = Number(raw.qty);
    const equipable = Boolean(raw.equipable);
    const equipSlots = equipable ? sanitizeEquipSlots(raw.equipSlots) : [];
    const equippedSlot = sanitizeEquipNode(raw.equippedSlot);
    const imageUrl = typeof raw.imageUrl === "string" && raw.imageUrl.trim()
        ? raw.imageUrl.trim()
        : null;
    return {
        id,
        name: typeof raw.name === "string" ? raw.name : "",
        type,
        rarity,
        description: typeof raw.description === "string" ? raw.description : "",
        qty: Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : null,
        mask: cloneMask(sanitizeMask(raw.mask)),
        rot,
        ownerType,
        ownerCharacterId,
        gx: placed ? gxRaw : null,
        gy: placed ? gyRaw : null,
        effect: normalizeItemEffect(raw.effect),
        imageUrl,
        equipable,
        equipSlots,
        equippedSlot: equipable ? equippedSlot : null,
        campaignId: typeof raw.campaignId === "string" ? raw.campaignId : null,
        createdBy: typeof raw.createdBy === "string" ? raw.createdBy : null,
        createdAt: raw.createdAt ?? null,
        updatedAt: raw.updatedAt ?? null,
    };
}

export function itemTypeMeta(type) {
    return ITEM_TYPE_META[type] || ITEM_TYPE_META[ITEM_TYPES.JUNK];
}

export function itemRarityMeta(rarity) {
    return ITEM_RARITY_META[rarity] || ITEM_RARITY_META[ITEM_RARITY.COMMON];
}

/** Distinct outline so two items of the same type don't melt together. */
export function itemOutlineColor(id) {
    const s = String(id || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const palette = ["#ffffff", "#f5c542", "#c4b5fd", "#7dd3fc", "#fb7185", "#86efac"];
    return palette[h % palette.length];
}

export { isPlaced, normalizeBriefcase };
