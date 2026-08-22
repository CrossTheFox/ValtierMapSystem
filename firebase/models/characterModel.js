import { serverTimestamp } from "firebase/firestore";

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