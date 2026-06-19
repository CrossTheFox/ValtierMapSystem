import { serverTimestamp } from "firebase/firestore";

export function createCharacter({
    campaignId,
    locationId,
    ownerPlayerId = null,
    type = "npc", // "npc" | "player"
    name,
    age,
    bio,
    imageUrl
}) {
    return {
        campaignId,
        locationId,
        ownerPlayerId,
        type,
        name,
        age,
        bio,
        imageUrl,
        relations: {},
        // Narrative wiki integration (optional)
        speciesEntityId: null, // -> wikiEntities especie
        organizationMemberships: [], // [{ organizationEntityId, status, role }]
        createdAt: serverTimestamp()
    };
}