import { serverTimestamp } from "firebase/firestore";
import { DEFAULT_TURN } from "../../src/utils/characterVitals.js";

export function createCharacter({
    campaignId,
    locationId,
    ownerPlayerId = null,
    type = "npc", // "npc" | "player"
    name,
    age,
    bio,
    imageUrl,
    vit = 4,
    assignedClassIds = [],
    activeClassId = null,
    combatOverrides = {},
}) {
    const classIds = Array.isArray(assignedClassIds) ? assignedClassIds : [];
    const hpMax = Math.max(1, Math.floor(Number(vit) || 4)) * 4;
    return {
        campaignId,
        locationId,
        ownerPlayerId,
        type,
        name,
        age,
        bio,
        imageUrl,
        vit,
        hpCur: hpMax,
        vigor: 0,
        effort: { current: 0, exhausted: false },
        turn: { ...DEFAULT_TURN },
        conditions: [],
        hpBroken: false,
        assignedClassIds: classIds,
        activeClassId: activeClassId || classIds[0] || null,
        combatOverrides:
            combatOverrides && typeof combatOverrides === "object" ? combatOverrides : {},
        relations: {},
        // Narrative wiki integration
        narrativeEntityId: null, // -> wikiEntities personaje (1:1)
        speciesEntityId: null, // -> wikiEntities especie
        organizationMemberships: [], // [{ organizationEntityId, status, role }]
        createdAt: serverTimestamp()
    };
}