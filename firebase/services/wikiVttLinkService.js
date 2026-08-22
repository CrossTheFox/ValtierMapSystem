import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
    createWikiEntity,
    findWikiEntitiesByVttLink,
    getWikiEntity,
    updateWikiEntity,
} from "./wikiEntityService";
import { updateCharacterFields } from "./characterService";
import { WIKI_ENTITY_TYPES } from "../../src/constants/wikiEntityTypes";

/**
 * Enlaza una ficha wiki `locacion` con un pin del mapa VTT (1:1 por pin).
 * El vínculo vive en la wiki (`linkedVttLocationId`), no en el doc `locations`.
 *
 * @param {string} campaignId
 * @param {string|null} wikiEntityId — ficha narrativa; null = quitar vínculo del pin
 * @param {string} vttLocationId — id del doc `locations`
 * @param {string} uid
 */
export async function linkWikiLocacionToVtt(campaignId, wikiEntityId, vttLocationId, uid) {
    if (!campaignId || !vttLocationId) return;

    const alreadyLinked = await findWikiEntitiesByVttLink(campaignId, { locationId: vttLocationId });
    for (const ent of alreadyLinked) {
        if (ent.id !== wikiEntityId) {
            await updateWikiEntity(campaignId, ent.id, { linkedVttLocationId: null }, uid);
        }
    }

    if (wikiEntityId) {
        const updates = { linkedVttLocationId: vttLocationId };
        const entity = await getWikiEntity(campaignId, wikiEntityId);
        if (entity && !entity.imageUrl) {
            const locSnap = await getDoc(doc(db, "locations", vttLocationId));
            const vttImage = locSnap.exists() ? locSnap.data()?.imageUrl : null;
            if (vttImage) updates.imageUrl = vttImage;
        }
        await updateWikiEntity(campaignId, wikiEntityId, updates, uid);
    }
}

/**
 * Enlaza una ficha wiki `personaje` con un personaje VTT (1:1 por personaje).
 * Bidirectional: wiki.linkedVttCharacterId + characters.narrativeEntityId.
 *
 * @param {string} campaignId
 * @param {string|null} wikiEntityId — ficha narrativa; null = quitar vínculo del personaje
 * @param {string} vttCharacterId — id del doc `characters`
 * @param {string} uid
 */
export async function linkWikiPersonajeToVtt(campaignId, wikiEntityId, vttCharacterId, uid) {
    if (!campaignId || !vttCharacterId) return;

    const alreadyLinked = await findWikiEntitiesByVttLink(campaignId, { characterId: vttCharacterId });
    for (const ent of alreadyLinked) {
        if (ent.id !== wikiEntityId) {
            await updateWikiEntity(campaignId, ent.id, { linkedVttCharacterId: null }, uid);
        }
    }

    // Clear previous FK on character if unlinking
    if (!wikiEntityId) {
        await updateCharacterFields(vttCharacterId, { narrativeEntityId: null });
        return;
    }

    const updates = { linkedVttCharacterId: vttCharacterId };
    const entity = await getWikiEntity(campaignId, wikiEntityId);
    if (entity && !entity.imageUrl) {
        const charSnap = await getDoc(doc(db, "characters", vttCharacterId));
        const vttImage = charSnap.exists() ? charSnap.data()?.imageUrl : null;
        if (vttImage) updates.imageUrl = vttImage;
    }
    await updateWikiEntity(campaignId, wikiEntityId, updates, uid);
    await updateCharacterFields(vttCharacterId, { narrativeEntityId: wikiEntityId });
}

/**
 * Resolve or create the 1:1 wiki PERSONAJE for a VTT character.
 * Prefers character.narrativeEntityId, then linkedVttCharacterId lookup, else creates.
 *
 * @param {string} campaignId
 * @param {{ id: string, name?: string, imageUrl?: string, narrativeEntityId?: string|null }} character
 * @param {string} uid
 * @returns {Promise<object>} wiki entity (serialized)
 */
/**
 * One-shot: seed wiki summary/body from legacy VTT `character.bio` when the
 * narrative ficha is empty. Wiki remains the canonical source afterward.
 */
async function migrateVttBioIfNeeded(campaignId, character, entity, uid) {
    if (!entity?.id) return entity;
    const wikiEmpty = !String(entity.summary || "").trim() && !String(entity.body || "").trim();
    const vttBio = String(character?.bio || "").trim();
    if (!wikiEmpty || !vttBio) return entity;

    const summary = vttBio.length > 280 ? `${vttBio.slice(0, 279).trimEnd()}…` : vttBio;
    const body = vttBio;
    await updateWikiEntity(campaignId, entity.id, { summary, body }, uid);
    return { ...entity, summary, body };
}

export async function ensureNarrativeEntityForCharacter(campaignId, character, uid) {
    if (!campaignId || !character?.id) {
        throw new Error("ensureNarrativeEntityForCharacter: missing campaignId or character.id");
    }

    const existingId = typeof character.narrativeEntityId === "string" && character.narrativeEntityId
        ? character.narrativeEntityId
        : null;

    if (existingId) {
        const byId = await getWikiEntity(campaignId, existingId);
        if (byId) {
            if (byId.linkedVttCharacterId !== character.id) {
                await updateWikiEntity(campaignId, byId.id, { linkedVttCharacterId: character.id }, uid);
            }
            const linked = { ...byId, linkedVttCharacterId: character.id };
            return migrateVttBioIfNeeded(campaignId, character, linked, uid);
        }
    }

    const linked = await findWikiEntitiesByVttLink(campaignId, { characterId: character.id });
    const match = linked.find((e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE) || linked[0];
    if (match) {
        if (character.narrativeEntityId !== match.id) {
            await updateCharacterFields(character.id, { narrativeEntityId: match.id });
        }
        return migrateVttBioIfNeeded(campaignId, character, match, uid);
    }

    const vttBio = String(character.bio || "").trim();
    const summary = vttBio
        ? (vttBio.length > 280 ? `${vttBio.slice(0, 279).trimEnd()}…` : vttBio)
        : "";
    const created = await createWikiEntity(campaignId, {
        entityType: WIKI_ENTITY_TYPES.PERSONAJE,
        title: character.name || "Sin nombre",
        summary,
        body: vttBio,
        visibility: "players",
        linkedVttCharacterId: character.id,
        imageUrl: character.imageUrl || null,
        customFields: { personaje: {} },
    }, uid);

    await updateCharacterFields(character.id, { narrativeEntityId: created.id });
    return created;
}
