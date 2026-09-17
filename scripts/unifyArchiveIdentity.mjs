/**
 * One-shot Archive identity unification.
 *
 * Moves narrative identity onto wikiEntities and instance chrome onto
 * characters / locations. Does NOT mint VTT NPC sheets from wiki.
 *
 *   node scripts/unifyArchiveIdentity.mjs --dry-run
 *   node scripts/unifyArchiveIdentity.mjs --apply
 *   node scripts/unifyArchiveIdentity.mjs --campaignId=ID --apply
 *
 * Safe writes:
 *   - bidirectional FKs (character ↔ PERSONAJE, pin.wikiEntityId ↔ LOCACION)
 *   - linkedVttLocationIds[] from legacy scalar (1:N)
 *   - seed empty wiki summary/body from character.bio / pin description|history
 *   - seed empty wiki species from character.speciesEntityId
 *   - coerce org.members of linked PCs to kind=vtt
 *   - fuzzy-match unmatched VTT rows onto existing wiki
 *   - create wiki PERSONAJE/LOCACION only when a VTT row has no match (traspaso)
 *
 * Never: overwrite non-empty wiki prose; delete VTT tokens; run ensure:vtt-for-narrative.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { linkedLocationIdsOf, locationLinkPatch } from "../src/constants/wiki/archiveIdentity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const DRY_RUN = Boolean(args.dry || args["dry-run"]) || !args.apply;
const APPLY = Boolean(args.apply) && !DRY_RUN;
const ONLY_CAMPAIGN = typeof args.campaignId === "string" ? args.campaignId : null;
const MIN_SCORE = Number(args.minScore || 0.85);
const CREATE_MISSING = args["no-create"] ? false : true;

function initAdmin() {
    const candidates = [
        join(__dirname, "..", "valtier-map-system-firebase-admins.json"),
        join(__dirname, "..", "serviceAccount.json"),
    ];
    const keyPath = candidates.find((p) => existsSync(p));
    if (!getApps().length) {
        if (keyPath) {
            initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
        } else {
            initializeApp();
        }
    }
    return getFirestore();
}

function normalizeName(value = "") {
    return String(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^(el|la|los|las)\s+/i, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, " ");
}

function slugify(text = "") {
    return normalizeName(text).replace(/\s+/g, "-") || "ficha";
}

function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }
    return dp[m][n];
}

function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const dist = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

function scoreMatch(vttName, wikiEntity) {
    const vttNorm = normalizeName(vttName);
    const titleNorm = normalizeName(wikiEntity.title || "");
    const slugNorm = normalizeName((wikiEntity.slug || "").replace(/-/g, " "));
    if (!vttNorm || !titleNorm) return 0;
    if (vttNorm === titleNorm) return 1;
    if (vttNorm.includes(slugNorm) && slugNorm.length >= 3) return 0.95;
    if (titleNorm.includes(vttNorm) || vttNorm.includes(titleNorm)) return 0.9;
    return Math.max(
        similarity(vttNorm, titleNorm),
        slugNorm ? similarity(vttNorm, slugNorm) : 0
    );
}

function isJunkName(name) {
    const n = String(name || "").trim();
    if (!n) return true;
    return /^NEW_ENTRY_UNNAMED$/i.test(n) || n === "Sin nombre";
}

function wikiEmptyProse(entity) {
    return !String(entity?.summary || "").trim() && !String(entity?.body || "").trim();
}

function pinProse(loc) {
    const desc = String(loc?.description || "").trim();
    const hist = typeof loc?.history === "string" ? loc.history.trim() : "";
    return { desc, hist, any: Boolean(desc || hist) };
}

function truncSummary(text) {
    const t = String(text || "").trim();
    if (t.length <= 280) return t;
    return `${t.slice(0, 279).trimEnd()}…`;
}

function memberKey(m) {
    return `${m.kind}:${m.id}`;
}

async function loadCampaignLocations(db, campaignId) {
    const mapsSnap = await db.collection("maps").where("campaignId", "==", campaignId).get();
    const mapIds = mapsSnap.docs.map((d) => d.id);
    if (!mapIds.length) return [];
    const chunks = [];
    for (let i = 0; i < mapIds.length; i += 10) chunks.push(mapIds.slice(i, i + 10));
    const out = [];
    for (const chunk of chunks) {
        const locSnap = await db.collection("locations").where("mapId", "in", chunk).get();
        out.push(...locSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    return out;
}

function bestWikiMatch(vttName, wikiItems, usedWikiIds, minScore) {
    const scored = wikiItems
        .filter((w) => !usedWikiIds.has(w.id))
        .map((w) => ({ wiki: w, score: scoreMatch(vttName, w) }))
        .filter((x) => x.score >= minScore)
        .sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const best = scored[0];
    const second = scored[1];
    if (second && best.score - second.score < 0.08 && best.score < 0.99) return null;
    return best;
}

async function unifyCampaign(db, campaignId) {
    const report = {
        campaignId,
        characters: { scanned: 0, fk: 0, seedBio: 0, seedSpecies: 0, match: 0, createWiki: 0, conflicts: [] },
        locations: { scanned: 0, fk: 0, seedProse: 0, arrays: 0, match: 0, createWiki: 0, conflicts: [] },
        orgs: { coerced: 0, merged: 0 },
        writes: 0,
    };
    const writes = [];

    const wikiCol = db.collection("campaigns").doc(campaignId).collection("wikiEntities");
    const [wikiSnap, charactersSnap, locations] = await Promise.all([
        wikiCol.get(),
        db.collection("characters").where("campaignId", "==", campaignId).get(),
        loadCampaignLocations(db, campaignId),
    ]);

    const wiki = wikiSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const wikiById = Object.fromEntries(wiki.map((w) => [w.id, w]));
    let personajes = wiki.filter((e) => e.entityType === "personaje");
    let locaciones = wiki.filter((e) => e.entityType === "locacion");
    const orgs = wiki.filter((e) => e.entityType === "organizacion");
    const characters = charactersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const usedPersonaje = new Set();
    const usedLocacion = new Set();

    const queueWiki = (id, patch, reason) => {
        writes.push({ col: "wiki", id, patch, reason });
        const cur = wikiById[id] || { id };
        wikiById[id] = { ...cur, ...patch };
    };
    const queueChar = (id, patch, reason) => {
        writes.push({ col: "characters", id, patch, reason });
    };
    const queueLoc = (id, patch, reason) => {
        writes.push({ col: "locations", id, patch, reason });
    };

    // ── PERSONAJE FKs + prose/species ──────────────────────────────────────
    for (const char of characters) {
        report.characters.scanned += 1;
        if (isJunkName(char.name)) continue;

        let wikiEnt = null;
        if (char.narrativeEntityId && wikiById[char.narrativeEntityId]?.entityType === "personaje") {
            wikiEnt = wikiById[char.narrativeEntityId];
        }
        if (!wikiEnt) {
            wikiEnt = personajes.find((p) => p.linkedVttCharacterId === char.id) || null;
        }
        if (!wikiEnt) {
            const hit = bestWikiMatch(char.name, personajes, usedPersonaje, MIN_SCORE);
            if (hit) {
                wikiEnt = hit.wiki;
                report.characters.match += 1;
            }
        }

        if (!wikiEnt && CREATE_MISSING) {
            const vttBio = String(char.bio || "").trim();
            const newId = wikiCol.doc().id;
            const payload = {
                campaignId,
                entityType: "personaje",
                title: char.name,
                slug: slugify(char.name),
                summary: vttBio ? truncSummary(vttBio) : "",
                body: vttBio,
                tags: [],
                visibility: "dm_only",
                linkedVttCharacterId: char.id,
                imageUrl: char.imageUrl || null,
                customFields: {
                    personaje: {
                        speciesEntityId: char.speciesEntityId || null,
                        organizations: Array.isArray(char.organizationMemberships)
                            ? char.organizationMemberships
                            : [],
                    },
                },
                createdBy: "unify-archive-identity",
                updatedBy: "unify-archive-identity",
            };
            writes.push({ col: "wikiCreate", id: newId, patch: payload, reason: `create PERSONAJE for ${char.name}` });
            wikiEnt = { id: newId, ...payload };
            wikiById[newId] = wikiEnt;
            personajes.push(wikiEnt);
            report.characters.createWiki += 1;
        }

        if (!wikiEnt) continue;
        usedPersonaje.add(wikiEnt.id);

        if (wikiEnt.linkedVttCharacterId !== char.id) {
            queueWiki(wikiEnt.id, { linkedVttCharacterId: char.id }, `FK wiki←char ${char.name}`);
            report.characters.fk += 1;
        }
        if (char.narrativeEntityId !== wikiEnt.id) {
            queueChar(char.id, { narrativeEntityId: wikiEnt.id }, `FK char←wiki ${char.name}`);
            report.characters.fk += 1;
        }

        if (wikiEmptyProse(wikiEnt)) {
            const vttBio = String(char.bio || "").trim();
            if (vttBio) {
                queueWiki(wikiEnt.id, { summary: truncSummary(vttBio), body: vttBio }, `seed bio ${char.name}`);
                report.characters.seedBio += 1;
            }
        }

        const wikiSpecies = wikiEnt.customFields?.personaje?.speciesEntityId || null;
        const vttSpecies = char.speciesEntityId || null;
        if (!wikiSpecies && vttSpecies) {
            const cf = wikiEnt.customFields || {};
            const ns = cf.personaje || {};
            queueWiki(wikiEnt.id, {
                customFields: { ...cf, personaje: { ...ns, speciesEntityId: vttSpecies } },
            }, `seed species ${char.name}`);
            report.characters.seedSpecies += 1;
        } else if (wikiSpecies && vttSpecies && wikiSpecies !== vttSpecies) {
            report.characters.conflicts.push({
                name: char.name,
                wikiId: wikiEnt.id,
                wikiSpecies,
                vttSpecies,
            });
        }

        if (!wikiEnt.imageUrl && char.imageUrl) {
            queueWiki(wikiEnt.id, { imageUrl: char.imageUrl }, `seed image ${char.name}`);
        }
    }

    // Duplicate wiki PERSONAJE sharing the same VTT id
    const byVttChar = new Map();
    for (const p of personajes) {
        if (!p.linkedVttCharacterId) continue;
        const list = byVttChar.get(p.linkedVttCharacterId) || [];
        list.push(p);
        byVttChar.set(p.linkedVttCharacterId, list);
    }
    for (const [vttId, list] of byVttChar) {
        if (list.length < 2) continue;
        const char = characters.find((c) => c.id === vttId);
        const keepId = char?.narrativeEntityId && list.some((p) => p.id === char.narrativeEntityId)
            ? char.narrativeEntityId
            : list[0].id;
        for (const extra of list.filter((p) => p.id !== keepId)) {
            queueWiki(extra.id, { linkedVttCharacterId: null }, `unlink duplicate PERSONAJE ${extra.title}`);
            report.characters.conflicts.push({
                name: extra.title,
                wikiId: extra.id,
                note: `duplicate link to character ${vttId}; kept ${keepId}`,
            });
        }
    }

    // ── LOCACION FKs + 1:N + prose ─────────────────────────────────────────
    const pinById = Object.fromEntries(locations.map((l) => [l.id, l]));
    report.locations.scanned = locations.length;

    for (const place of locaciones) {
        const ids = linkedLocationIdsOf(place);
        const patch = locationLinkPatch(ids);
        const arrayChanged =
            JSON.stringify(place.linkedVttLocationIds || []) !== JSON.stringify(patch.linkedVttLocationIds)
            || (place.linkedVttLocationId || null) !== patch.linkedVttLocationId;
        if (arrayChanged) {
            queueWiki(place.id, patch, `normalize pin list ${place.title}`);
            report.locations.arrays += 1;
        }
        Object.assign(place, patch);

        for (const pinId of patch.linkedVttLocationIds) {
            const pin = pinById[pinId];
            if (!pin) continue;
            usedLocacion.add(place.id);
            if (pin.wikiEntityId !== place.id) {
                queueLoc(pinId, { wikiEntityId: place.id }, `FK pin←wiki ${pin.name || pinId}`);
                pin.wikiEntityId = place.id;
                report.locations.fk += 1;
            }
            if (wikiEmptyProse(place)) {
                const { desc, hist, any } = pinProse(pin);
                if (any) {
                    queueWiki(place.id, {
                        summary: truncSummary(desc || hist),
                        body: hist || desc,
                    }, `seed loc prose ${place.title}`);
                    report.locations.seedProse += 1;
                }
            }
            if (!place.imageUrl && pin.imageUrl) {
                queueWiki(place.id, { imageUrl: pin.imageUrl }, `seed loc image ${place.title}`);
            }
        }
    }

    for (const pin of locations) {
        if (isJunkName(pin.name)) continue;
        if (pin.wikiEntityId && wikiById[pin.wikiEntityId]?.entityType === "locacion") {
            const place = wikiById[pin.wikiEntityId];
            const ids = linkedLocationIdsOf(place);
            if (!ids.includes(pin.id)) {
                const patch = locationLinkPatch([...ids, pin.id]);
                queueWiki(place.id, patch, `add pin to wiki ${place.title}`);
                Object.assign(place, patch);
                report.locations.fk += 1;
            }
            usedLocacion.add(place.id);
            continue;
        }

        const already = locaciones.find((w) => linkedLocationIdsOf(w).includes(pin.id));
        if (already) {
            if (pin.wikiEntityId !== already.id) {
                queueLoc(pin.id, { wikiEntityId: already.id }, `FK pin from inverse ${pin.name}`);
                report.locations.fk += 1;
            }
            usedLocacion.add(already.id);
            continue;
        }

        const hit = bestWikiMatch(pin.name, locaciones, new Set(), MIN_SCORE);
        let place = hit?.wiki || null;
        if (place) {
            report.locations.match += 1;
        } else if (CREATE_MISSING) {
            const { desc, hist } = pinProse(pin);
            const newId = wikiCol.doc().id;
            const payload = {
                campaignId,
                entityType: "locacion",
                title: pin.name,
                slug: slugify(pin.name),
                summary: truncSummary(desc || hist),
                body: hist || desc || "",
                tags: [],
                visibility: "dm_only",
                ...locationLinkPatch([pin.id]),
                imageUrl: pin.imageUrl || null,
                customFields: { locacion: {} },
                createdBy: "unify-archive-identity",
                updatedBy: "unify-archive-identity",
            };
            writes.push({ col: "wikiCreate", id: newId, patch: payload, reason: `create LOCACION for ${pin.name}` });
            place = { id: newId, ...payload };
            wikiById[newId] = place;
            locaciones.push(place);
            report.locations.createWiki += 1;
        }
        if (!place) continue;
        usedLocacion.add(place.id);
        const ids = linkedLocationIdsOf(place);
        if (!ids.includes(pin.id)) {
            queueWiki(place.id, locationLinkPatch([...ids, pin.id]), `link pin ${pin.name}`);
        }
        if (pin.wikiEntityId !== place.id) {
            queueLoc(pin.id, { wikiEntityId: place.id }, `FK pin ${pin.name}`);
            report.locations.fk += 1;
        }
        if (wikiEmptyProse(place)) {
            const { desc, hist, any } = pinProse(pin);
            if (any) {
                queueWiki(place.id, { summary: truncSummary(desc || hist), body: hist || desc }, `seed loc ${pin.name}`);
                report.locations.seedProse += 1;
            }
        }
    }

    // ── ORGS: coerce linked PERSONAJE to kind=vtt + merge VTT memberships ──
    const charById = Object.fromEntries(characters.map((c) => [c.id, c]));
    for (const org of orgs) {
        const cf = org.customFields || {};
        const ns = cf.organizacion || {};
        let members = Array.isArray(ns.members) ? ns.members.map((m) => ({ ...m })) : [];
        let changed = false;

        const coerced = [];
        const seen = new Set();
        for (const m of members) {
            let kind = m.kind === "wiki" ? "wiki" : "vtt";
            let id = m.id;
            if (kind === "wiki" && wikiById[id]?.linkedVttCharacterId) {
                id = wikiById[id].linkedVttCharacterId;
                kind = "vtt";
                report.orgs.coerced += 1;
                changed = true;
            }
            const key = `${kind}:${id}`;
            if (!id || seen.has(key)) {
                if (seen.has(key)) changed = true;
                continue;
            }
            seen.add(key);
            coerced.push({ kind, id, status: m.status || "confirmado", role: m.role || "" });
        }

        for (const char of characters) {
            const memberships = Array.isArray(char.organizationMemberships) ? char.organizationMemberships : [];
            for (const mem of memberships) {
                if (mem.organizationEntityId !== org.id) continue;
                const key = `vtt:${char.id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                coerced.push({
                    kind: "vtt",
                    id: char.id,
                    status: mem.status || "confirmado",
                    role: mem.role || "",
                });
                changed = true;
                report.orgs.merged += 1;
            }
        }

        for (const p of personajes) {
            const memberships = Array.isArray(p.customFields?.personaje?.organizations)
                ? p.customFields.personaje.organizations
                : [];
            for (const mem of memberships) {
                if (mem.organizationEntityId !== org.id) continue;
                const vttId = p.linkedVttCharacterId;
                const kind = vttId ? "vtt" : "wiki";
                const id = vttId || p.id;
                const key = `${kind}:${id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                coerced.push({
                    kind,
                    id,
                    status: mem.status || "confirmado",
                    role: mem.role || "",
                });
                changed = true;
                report.orgs.merged += 1;
            }
        }

        if (changed) {
            queueWiki(org.id, {
                customFields: { ...cf, organizacion: { ...ns, members: coerced } },
            }, `coerce org members ${org.title}`);
        }
    }

    // Deduplicate writes per doc (last patch wins, merge)
    const merged = new Map();
    for (const w of writes) {
        const key = `${w.col}:${w.id}`;
        const prev = merged.get(key);
        if (!prev) {
            merged.set(key, { ...w, patch: { ...w.patch } });
            continue;
        }
        if (w.col === "wiki" && w.patch.customFields && prev.patch.customFields) {
            prev.patch = {
                ...prev.patch,
                ...w.patch,
                customFields: {
                    ...(prev.patch.customFields || {}),
                    ...(w.patch.customFields || {}),
                    personaje: {
                        ...(prev.patch.customFields?.personaje || {}),
                        ...(w.patch.customFields?.personaje || {}),
                    },
                    organizacion: {
                        ...(prev.patch.customFields?.organizacion || {}),
                        ...(w.patch.customFields?.organizacion || {}),
                    },
                    locacion: {
                        ...(prev.patch.customFields?.locacion || {}),
                        ...(w.patch.customFields?.locacion || {}),
                    },
                },
            };
        } else {
            prev.patch = { ...prev.patch, ...w.patch };
        }
        prev.reason = `${prev.reason}; ${w.reason}`;
    }

    const ops = [...merged.values()];
    report.writes = ops.length;

    if (APPLY) {
        const stamp = FieldValue.serverTimestamp();
        for (const op of ops) {
            if (op.col === "wikiCreate") {
                await wikiCol.doc(op.id).set({
                    ...op.patch,
                    createdAt: stamp,
                    updatedAt: stamp,
                });
            } else if (op.col === "wiki") {
                await wikiCol.doc(op.id).update({
                    ...op.patch,
                    updatedAt: stamp,
                    updatedBy: "unify-archive-identity",
                });
            } else if (op.col === "characters") {
                await db.collection("characters").doc(op.id).update({
                    ...op.patch,
                    updatedAt: stamp,
                });
            } else if (op.col === "locations") {
                await db.collection("locations").doc(op.id).update(op.patch);
            }
        }
    }

    return { report, ops };
}

async function main() {
    const db = initAdmin();
    console.log(`[unify-archive] mode=${APPLY ? "APPLY" : "DRY-RUN"} createMissing=${CREATE_MISSING} minScore=${MIN_SCORE}`);

    let campaignIds = [];
    if (ONLY_CAMPAIGN) {
        campaignIds = [ONLY_CAMPAIGN];
    } else {
        const snap = await db.collection("campaigns").get();
        campaignIds = snap.docs.map((d) => d.id);
    }

    const summaries = [];
    for (const id of campaignIds) {
        const camp = await db.collection("campaigns").doc(id).get();
        const name = camp.exists ? camp.data()?.name || id : id;
        console.log(`\n=== ${name} (${id}) ===`);
        const { report, ops } = await unifyCampaign(db, id);
        summaries.push({ name, ...report });
        console.log(JSON.stringify(report, null, 2));
        if (!APPLY && ops.length) {
            console.log(`ops (${ops.length}):`);
            for (const op of ops.slice(0, 40)) {
                console.log(`  [${op.col}] ${op.id} — ${op.reason}`);
            }
            if (ops.length > 40) console.log(`  … +${ops.length - 40} more`);
        }
    }

    console.log("\n[unify-archive] done");
    if (!APPLY) console.log("Re-run with --apply to write.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
