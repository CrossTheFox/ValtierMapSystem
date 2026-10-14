import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
    createWikiEntity,
    findWikiEntitiesByVttLink,
    getWikiEntity,
    updateWikiEntity,
} from "./wikiEntityService";
import { updateCharacterFields } from "./characterService";
import { getLocation, updateLocationFields } from "./locationService";
import { WIKI_ENTITY_TYPES } from "../../src/constants/wikiEntityTypes";
import { linkedLocationIdsOf, locationLinkPatch } from "../../src/constants/wiki/archiveIdentity.js";

/**
 * Attach or detach one VTT pin to a wiki LOCACION (1 wiki : N pins).
 * Canonical FK is `locations/{id}.wikiEntityId`. Inverse list: linkedVttLocationIds.
 *
 * @param {string} campaignId
 * @param {string|null} wikiEntityId — place ficha; null = detach this pin only
 * @param {string} vttLocationId — id of `locations` pin
 * @param {string} uid
 */
export async function linkWikiLocacionToVtt(campaignId, wikiEntityId, vttLocationId, uid) {
    if (!campaignId || !vttLocationId) return;

    const pin = await getLocation(vttLocationId);
    const pinWikiId = typeof pin?.wikiEntityId === "string" && pin.wikiEntityId
        ? pin.wikiEntityId
        : null;

    const alreadyLinked = await findWikiEntitiesByVttLink(campaignId, { locationId: vttLocationId });
    const holdingIds = new Set(alreadyLinked.map((e) => e.id));
    if (pinWikiId) holdingIds.add(pinWikiId);

    for (const otherId of holdingIds) {
        if (otherId === wikiEntityId) continue;
        const other = alreadyLinked.find((e) => e.id === otherId)
            || await getWikiEntity(campaignId, otherId);
        if (!other) continue;
        const remaining = linkedLocationIdsOf(other).filter((id) => id !== vttLocationId);
        await updateWikiEntity(campaignId, other.id, locationLinkPatch(remaining), uid);
    }

    if (!wikiEntityId) {
        await updateLocationFields(vttLocationId, { wikiEntityId: null });
        return;
    }

    const entity = await getWikiEntity(campaignId, wikiEntityId);
    if (!entity) return;

    const ids = linkedLocationIdsOf(entity);
    if (!ids.includes(vttLocationId)) ids.push(vttLocationId);
    const updates = { ...locationLinkPatch(ids) };

    if (!entity.imageUrl && pin?.imageUrl) {
        updates.imageUrl = pin.imageUrl;
    }

    const wikiEmpty = !String(entity.summary || "").trim() && !String(entity.body || "").trim();
    if (wikiEmpty && pin) {
        const desc = String(pin.description || "").trim();
        const hist = typeof pin.history === "string" ? String(pin.history).trim() : "";
        const prose = desc || hist;
        if (prose) {
            updates.summary = prose.length > 280 ? `${prose.slice(0, 279).trimEnd()}…` : prose;
            updates.body = hist || desc;
        }
    }

    await updateWikiEntity(campaignId, wikiEntityId, updates, uid);
    await updateLocationFields(vttLocationId, { wikiEntityId });
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

/**
 * Resolve or create the 1:1 wiki PERSONAJE for a VTT character.
 * Used when opening NAR on a table PC — not when minting tokens.
 */
const pendingNarrativeEnsures = new Map();

export function ensureNarrativeEntityForCharacter(campaignId, character, uid) {
    if (!campaignId || !character?.id) {
        return Promise.reject(
            new Error("ensureNarrativeEntityForCharacter: missing campaignId or character.id")
        );
    }
    const key = `${campaignId}:${character.id}`;
    const pending = pendingNarrativeEnsures.get(key);
    if (pending) return pending;
    const run = resolveNarrativeEntityForCharacter(campaignId, character, uid)
        .finally(() => pendingNarrativeEnsures.delete(key));
    pendingNarrativeEnsures.set(key, run);
    return run;
}

async function resolveNarrativeEntityForCharacter(campaignId, character, uid) {
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
    const personajes = linked.filter((e) => e.entityType === WIKI_ENTITY_TYPES.PERSONAJE);
    const match = personajes.find((e) => e.id === existingId) || personajes[0] || linked[0];
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
