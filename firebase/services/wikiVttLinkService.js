import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { findWikiEntitiesByVttLink, getWikiEntity, updateWikiEntity } from "./wikiEntityService";

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
 * El vínculo vive en la wiki (`linkedVttCharacterId`), no en el doc `characters`.
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

    if (wikiEntityId) {
        const updates = { linkedVttCharacterId: vttCharacterId };
        const entity = await getWikiEntity(campaignId, wikiEntityId);
        if (entity && !entity.imageUrl) {
            const charSnap = await getDoc(doc(db, "characters", vttCharacterId));
            const vttImage = charSnap.exists() ? charSnap.data()?.imageUrl : null;
            if (vttImage) updates.imageUrl = vttImage;
        }
        await updateWikiEntity(campaignId, wikiEntityId, updates, uid);
    }
}
