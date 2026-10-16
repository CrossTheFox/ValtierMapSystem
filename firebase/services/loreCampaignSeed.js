import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { createLoreFicha } from "./loreFichaService";
import { updateCharacterFields } from "./characterService";
import { getMapsByCampaign } from "./mapService";
import { getLocationsByMap } from "./locationService";
import { slugify, uniqueSlug } from "../../src/utils/wikiSlug.js";

const VALTIA_ZERO_ONE = "RfY23gcG7No5HcGddo1j";

/**
 * Creates Lore cards for a mesa that was just annexed.
 * Characters get `ficha_id`. Places and organizations are skipped if a ficha
 * already carries the same `mesa_source`. Does not touch Valtia Zero One.
 * @param {string} loreId
 * @param {string} campaignId
 * @param {(progress: { done: number, total: number, label: string }) => void} [onProgress]
 */
export async function seedCampaignIntoLore(loreId, campaignId, onProgress = () => {}) {
    if (!loreId || !campaignId) return { created: 0 };
    if (campaignId === VALTIA_ZERO_ONE) {
        throw new Error("Valtia Zero One no se escribe en esta pasada.");
    }

    const existing = await getDocs(collection(db, "lores", loreId, "fichas"));
    const slugs = [];
    const sources = new Set();
    existing.forEach((snap) => {
        const data = snap.data() || {};
        if (data.slug) slugs.push(data.slug);
        if (data.mesa_source) sources.add(data.mesa_source);
    });

    const jobs = [];
    const characters = await getDocs(
        query(collection(db, "characters"), where("campaignId", "==", campaignId)),
    );
    characters.forEach((snap) => {
        const data = snap.data() || {};
        const key = `character:${snap.id}`;
        if (data.ficha_id || sources.has(key)) return;
        jobs.push({
            kind: "personaje",
            key,
            title: data.name || "Personaje",
            summary: data.bio || "",
            characterId: snap.id,
        });
    });

    const maps = await getMapsByCampaign(campaignId);
    for (const map of maps) {
        const locations = await getLocationsByMap(map.id);
        for (const loc of locations) {
            const key = `location:${loc.id}`;
            if (sources.has(key)) continue;
            jobs.push({
                kind: "locacion",
                key,
                title: loc.name || "Lugar",
                summary: loc.description || "",
            });
        }
    }

    const wiki = await getDocs(collection(db, "campaigns", campaignId, "wikiEntities"));
    wiki.forEach((snap) => {
        const data = snap.data() || {};
        if (data.entityType !== "organizacion") return;
        const key = `organizacion:${snap.id}`;
        if (sources.has(key)) return;
        jobs.push({
            kind: "organizacion",
            key,
            title: data.title || "Organización",
            summary: data.summary || "",
        });
    });

    const total = jobs.length;
    onProgress({
        done: 0,
        total,
        label: total ? "Creando fichas…" : "Esta mesa ya tenía sus fichas.",
    });

    let col = 0;
    let row = 0;
    let created = 0;
    for (const job of jobs) {
        const tail = job.key.split(":")[1].slice(0, 6);
        const slug = uniqueSlug(`${slugify(job.title) || job.kind}-${tail}`, slugs);
        slugs.push(slug);
        const layoutX = 80 + col * 200;
        const layoutY = 80 + row * 150;
        col += 1;
        if (col >= 5) {
            col = 0;
            row += 1;
        }
        const fichaId = await createLoreFicha(loreId, {
            entity_type: job.kind,
            title: job.title,
            summary: job.summary,
            slug,
            mesa_source: job.key,
            layout_lab_x: layoutX,
            layout_lab_y: layoutY,
        });
        if (job.characterId) {
            await updateCharacterFields(job.characterId, { ficha_id: fichaId });
        }
        created += 1;
        onProgress({ done: created, total, label: job.title });
    }
    return { created };
}
