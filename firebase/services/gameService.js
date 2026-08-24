import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, deleteField, updateDoc } from "firebase/firestore";
import { updateCharacterFields } from "./characterService";

const gameRef = (campaignId) => doc(db, "game", campaignId);

/**
 * Ensure the game document exists for the campaign.
 */
export async function getOrCreateGameSession(campaignId) {
    const docRef = gameRef(campaignId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
        const initial = {
            partyPositions: {},
            tokenPositions: {},
            activeMapId: null,
            rulers: {},
            drawings: {},
            pings: {},
            sessionPools: {},
            initiative: {
                open: false,
                started: false,
                entries: [],
                activeIndex: 0,
                round: 1,
            },
        };
        await setDoc(docRef, initial);
        return initial;
    }
    return snap.data();
}

export async function updatePartyPosition(campaignId, mapId, position) {
    const docRef = gameRef(campaignId);
    await setDoc(
        docRef,
        { partyPositions: { [mapId]: position } },
        { merge: true },
    );
}

/**
 * @param {object|null} position — `{ x, y, sizeOverride?, conditions?, visible? }` or null to remove
 */
export async function updateTokenPosition(campaignId, mapId, tokenId, position) {
    const docRef = gameRef(campaignId);
    if (position == null) {
        await updateDoc(docRef, {
            [`tokenPositions.${mapId}.${tokenId}`]: deleteField(),
        });
        return;
    }
    await setDoc(
        docRef,
        { tokenPositions: { [mapId]: { [tokenId]: position } } },
        { merge: true },
    );
}

export async function setActiveMapForPlayers(campaignId, mapId) {
    const docRef = gameRef(campaignId);
    await setDoc(docRef, { activeMapId: mapId }, { merge: true });
}

export async function spawnTokenOnMap(campaignId, mapId, tokenId, position) {
    return updateTokenPosition(campaignId, mapId, tokenId, position);
}

/**
 * Place/move a token and optionally sync narrative `locationId`.
 * Caller resolves nearest location (see `findNearestLocation`).
 */
export async function placeTokenOnBoard(campaignId, mapId, tokenId, position, locationId = null) {
    await updateTokenPosition(campaignId, mapId, tokenId, position);
    if (locationId) {
        await updateCharacterFields(tokenId, { locationId });
    }
}

/**
 * Batch place/move tokens (multi-drag). One merge write for positions + parallel location syncs.
 * @param {Array<{ tokenId: string, position: object, locationId?: string|null }>} updates
 */
export async function placeTokensOnBoard(campaignId, mapId, updates) {
    if (!campaignId || !mapId || !Array.isArray(updates) || updates.length === 0) return;
    if (updates.length === 1) {
        const u = updates[0];
        return placeTokenOnBoard(campaignId, mapId, u.tokenId, u.position, u.locationId ?? null);
    }
    const mapPatch = {};
    for (const u of updates) {
        if (!u?.tokenId || !u.position) continue;
        mapPatch[u.tokenId] = u.position;
    }
    if (Object.keys(mapPatch).length === 0) return;
    const docRef = gameRef(campaignId);
    await setDoc(docRef, { tokenPositions: { [mapId]: mapPatch } }, { merge: true });
    await Promise.all(
        updates
            .filter((u) => u?.tokenId && u.locationId)
            .map((u) => updateCharacterFields(u.tokenId, { locationId: u.locationId })),
    );
}

export async function removeTokenFromMap(campaignId, mapId, tokenId) {
    return updateTokenPosition(campaignId, mapId, tokenId, null);
}

function mergeTokenPos(existingPos, patch) {
    const base = existingPos && typeof existingPos === "object" ? { ...existingPos } : { x: 0, y: 0 };
    return {
        ...base,
        x: base.x ?? 0,
        y: base.y ?? 0,
        ...patch,
    };
}

export async function updateTokenSizeOverride(campaignId, mapId, tokenId, sizeOverride, existingPos) {
    return updateTokenPosition(
        campaignId,
        mapId,
        tokenId,
        mergeTokenPos(existingPos, { sizeOverride: sizeOverride || null }),
    );
}

/**
 * @deprecated G12 (Phase 03 Slice 7): `character.conditions[]` is now the
 * single source of truth for condition state (dossier COND drawer +
 * `MapContextMenu` both read/write it; `TokenLayer` badges read it too).
 * This helper is unused by character-linked tokens as of that migration but
 * is left in place in case a future map-only marker (no linked character)
 * needs a token-scoped conditions store.
 * @param {string[]} conditions
 */
export async function updateTokenConditions(campaignId, mapId, tokenId, conditions, existingPos) {
    return updateTokenPosition(
        campaignId,
        mapId,
        tokenId,
        mergeTokenPos(existingPos, { conditions: Array.isArray(conditions) ? conditions : [] }),
    );
}

/** @param {boolean} visible */
export async function updateTokenVisibility(campaignId, mapId, tokenId, visible, existingPos) {
    return updateTokenPosition(
        campaignId,
        mapId,
        tokenId,
        mergeTokenPos(existingPos, { visible: visible !== false }),
    );
}

export function subscribeToGameSession(campaignId, callback) {
    const docRef = gameRef(campaignId);
    return onSnapshot(
        docRef,
        (snap) => {
            if (snap.exists()) callback(snap.data());
        },
        (err) => {
            console.warn("[subscribeToGameSession]", err?.code || err?.message || err);
        },
    );
}

function newId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRulerPayload(ruler) {
    const points = Array.isArray(ruler?.points) && ruler.points.length >= 2
        ? ruler.points
        : (ruler?.a && ruler?.b ? [ruler.a, ruler.b] : []);
    const a = points[0] || ruler?.a || null;
    const b = points[points.length - 1] || ruler?.b || null;
    return {
        mapId: ruler.mapId,
        points,
        a,
        b,
        straight: ruler.straight ?? 0,
        diagonal: ruler.diagonal ?? 0,
        totalCells: ruler.totalCells ?? 0,
        meters: ruler.meters ?? 0,
        distanceLabel: ruler.distanceLabel ?? "",
        createdBy: ruler.createdBy ?? null,
        createdByName: ruler.createdByName ?? null,
        createdAt: ruler.createdAt ?? Date.now(),
    };
}

/**
 * Persist a finished ruler so the whole table can see it.
 * Supports polylines via `points[]` (legacy `a`/`b` mirrored).
 * @param {object} ruler — omit `id`; server/client assigns one
 */
export async function addMapRuler(campaignId, ruler) {
    const id = ruler?.id || newId("ruler");
    const docRef = gameRef(campaignId);
    const payload = { id, ...normalizeRulerPayload(ruler) };
    await setDoc(docRef, { rulers: { [id]: payload } }, { merge: true });
    return payload;
}

/** Update an existing ruler (move / remeasure). */
export async function updateMapRuler(campaignId, rulerId, patch) {
    if (!campaignId || !rulerId || !patch) return;
    const docRef = gameRef(campaignId);
    const normalized = normalizeRulerPayload({ ...patch, mapId: patch.mapId });
    const payload = { id: rulerId, ...normalized };
    // Preserve created* if caller omitted them
    if (patch.createdBy !== undefined) payload.createdBy = patch.createdBy;
    if (patch.createdByName !== undefined) payload.createdByName = patch.createdByName;
    if (patch.createdAt !== undefined) payload.createdAt = patch.createdAt;
    await setDoc(docRef, { rulers: { [rulerId]: payload } }, { merge: true });
    return payload;
}

export async function removeMapRuler(campaignId, rulerId) {
    if (!campaignId || !rulerId) return;
    const docRef = gameRef(campaignId);
    await updateDoc(docRef, {
        [`rulers.${rulerId}`]: deleteField(),
    });
}

function normalizeDrawingPayload(drawing) {
    let paths = null;
    if (Array.isArray(drawing.paths)) {
        // Firestore forbids nested arrays — store [{ points: [...] }, ...]
        paths = drawing.paths.map((path) => {
            if (Array.isArray(path)) return { points: path };
            if (path && Array.isArray(path.points)) return { points: path.points };
            return { points: [] };
        });
    }
    return {
        mapId: drawing.mapId,
        shape: drawing.shape || "rect",
        a: drawing.a ?? null,
        b: drawing.b ?? null,
        parts: Array.isArray(drawing.parts) ? drawing.parts : null,
        paths,
        points: Array.isArray(drawing.points) ? drawing.points : null,
        closed: drawing.closed === true,
        circleMode: drawing.circleMode === "square" ? "square" : "round",
        radiusCells: Number.isFinite(drawing.radiusCells) ? drawing.radiusCells : null,
        color: typeof drawing.color === "string" ? drawing.color : (drawing.color ?? null),
        createdBy: drawing.createdBy ?? null,
        createdByName: drawing.createdByName ?? null,
        createdAt: drawing.createdAt ?? Date.now(),
    };
}

/** Persist a map drawing (circle / rect / freehand / compound parts). */
export async function addMapDrawing(campaignId, drawing) {
    const id = drawing?.id || newId("draw");
    const docRef = gameRef(campaignId);
    const payload = { id, ...normalizeDrawingPayload(drawing) };
    await setDoc(docRef, { drawings: { [id]: payload } }, { merge: true });
    return payload;
}

export async function updateMapDrawing(campaignId, drawingId, patch) {
    if (!campaignId || !drawingId || !patch) return;
    const docRef = gameRef(campaignId);
    const payload = { id: drawingId, ...normalizeDrawingPayload(patch) };
    if (patch.createdBy !== undefined) payload.createdBy = patch.createdBy;
    if (patch.createdByName !== undefined) payload.createdByName = patch.createdByName;
    if (patch.createdAt !== undefined) payload.createdAt = patch.createdAt;
    await setDoc(docRef, { drawings: { [drawingId]: payload } }, { merge: true });
    return payload;
}

export async function removeMapDrawing(campaignId, drawingId) {
    if (!campaignId || !drawingId) return;
    const docRef = gameRef(campaignId);
    await updateDoc(docRef, {
        [`drawings.${drawingId}`]: deleteField(),
    });
}

/** Broadcast a map ping (auto-expires client-side; writer also prunes). */
export async function publishMapPing(campaignId, ping, { ttlMs = 5000 } = {}) {
    const id = ping?.id || newId("ping");
    const createdAt = ping.createdAt ?? Date.now();
    const expiresAt = ping.expiresAt ?? createdAt + ttlMs;
    const docRef = gameRef(campaignId);
    const payload = {
        id,
        mapId: ping.mapId,
        x: ping.x,
        y: ping.y,
        col: ping.col,
        row: ping.row,
        createdBy: ping.createdBy ?? null,
        createdByName: ping.createdByName ?? null,
        createdAt,
        expiresAt,
    };
    await setDoc(docRef, { pings: { [id]: payload } }, { merge: true });

    // Best-effort cleanup after TTL so the doc doesn't grow forever.
    setTimeout(() => {
        updateDoc(docRef, { [`pings.${id}`]: deleteField() }).catch(() => {});
    }, ttlMs + 250);

    return payload;
}

export async function removeMapPing(campaignId, pingId) {
    if (!campaignId || !pingId) return;
    await updateDoc(gameRef(campaignId), {
        [`pings.${pingId}`]: deleteField(),
    });
}

/**
 * Shared session combat pools (HP / Effort / tracks) for the table.
 * Stored at game/{campaignId}.sessionPools.{characterId}
 */
export async function updateCharacterSessionPools(campaignId, characterId, pools) {
    if (!campaignId || !characterId || !pools) return;
    await setDoc(
        gameRef(campaignId),
        {
            sessionPools: {
                [characterId]: {
                    ...pools,
                    updatedAt: Date.now(),
                },
            },
        },
        { merge: true },
    );
}

/** Shared initiative tracker (DM writes; all clients read). */
export function normalizeInitiative(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const entries = Array.isArray(src.entries)
        ? src.entries
            .filter((e) => e && e.id)
            .map((e, i) => ({
                uid: e.uid || `legacy-${e.id}-${i}`,
                id: String(e.id),
                name: e.name || String(e.id),
                init: Number.isFinite(Number(e.init)) ? Math.floor(Number(e.init)) : 0,
            }))
        : [];
    const n = entries.length;
    let activeIndex = Math.floor(Number(src.activeIndex) || 0);
    if (n <= 0) activeIndex = 0;
    else activeIndex = ((activeIndex % n) + n) % n;
    const round = Math.max(1, Math.floor(Number(src.round) || 1));
    return {
        open: src.open === true,
        started: src.started === true,
        entries,
        activeIndex,
        round,
    };
}

export async function updateInitiative(campaignId, initiative) {
    if (!campaignId) return;
    const payload = normalizeInitiative(initiative);
    await setDoc(gameRef(campaignId), { initiative: payload }, { merge: true });
    return payload;
}
