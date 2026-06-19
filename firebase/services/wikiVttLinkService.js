import { findWikiEntitiesByVttLink, updateWikiEntity } from "./wikiEntityService";

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
        await updateWikiEntity(campaignId, wikiEntityId, { linkedVttLocationId: vttLocationId }, uid);
    }
}
