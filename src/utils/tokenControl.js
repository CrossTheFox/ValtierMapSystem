import { ROLES } from "../constants/roles";

export function isDmRole(role) {
    return role === ROLES.DM || role === "gm";
}

/**
 * Whether a player profile may drag / deploy / resize a token for `char`.
 * DM: all. Player: owner, roster (`characterIds`), or explicit `controlledByPlayerIds`.
 */
export function canControlToken(char, profile) {
    if (!profile?.uid || !char?.id) return false;
    if (isDmRole(profile.role)) return true;
    const uid = profile.uid;
    if (char.ownerPlayerId === uid) return true;
    if (profile.activeCharacterId === char.id) return true;
    if (Array.isArray(profile.characterIds) && profile.characterIds.includes(char.id)) {
        return true;
    }
    if (Array.isArray(char.controlledByPlayerIds) && char.controlledByPlayerIds.includes(uid)) {
        return true;
    }
    return false;
}

/**
 * Resolve pin world coords (supports `position.{x,y}` and legacy top-level `x`/`y`).
 * @param {{ position?: { x?: number, y?: number }, x?: number, y?: number }} loc
 * @returns {{ x: number, y: number }|null}
 */
export function locationWorldCoords(loc) {
    if (!loc) return null;
    const x = typeof loc.position?.x === "number" ? loc.position.x
        : typeof loc.x === "number" ? loc.x : null;
    const y = typeof loc.position?.y === "number" ? loc.position.y
        : typeof loc.y === "number" ? loc.y : null;
    if (x == null || y == null) return null;
    return { x, y };
}

/**
 * Nearest location pin to world coords (for narrative locationId sync).
 * @param {Record<string, object>|Array} locations
 * @returns {{ id: string, x: number, y: number }|null}
 */
export function findNearestLocation(locations, worldX, worldY) {
    const list = Array.isArray(locations)
        ? locations
        : Object.values(locations || {});
    let best = null;
    let bestDist = Infinity;
    for (const loc of list) {
        if (!loc?.id) continue;
        const coords = locationWorldCoords(loc);
        if (!coords) continue;
        const dx = coords.x - worldX;
        const dy = coords.y - worldY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
            bestDist = d;
            best = { id: loc.id, x: coords.x, y: coords.y };
        }
    }
    return best;
}
