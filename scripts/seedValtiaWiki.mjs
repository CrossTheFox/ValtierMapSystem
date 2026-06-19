/**
 * seedValtiaWiki.mjs
 *
 * Idempotent seed of Valtia-01 narrative wiki entities + relations into Firestore.
 *
 * Prerequisites:
 *   - Firebase Admin service account JSON at project root:
 *       valtier-map-system-firebase-admins.json  (preferred)
 *       or serviceAccount.json
 *   - Or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * Usage:
 *   npm run seed-valtia-wiki:dry          # preview, no writes
 *   npm run seed-valtia-wiki              # upload to Firestore
 *   npm run seed-valtia-wiki -- --campaignId=OTHER_ID
 *   npm run seed-valtia-wiki -- --only=locacion,personaje
 *   npm run seed-valtia-wiki -- --skip-relations
 *   npm run seed-valtia-wiki -- --strict-relations   # abort on invalid relation in manifest
 *   npm run seed-valtia-wiki -- --no-purge           # skip deleting stale docs (legacy mode)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
    ENTITIES,
    RELATIONS,
    CREATION_PHASES,
    SEED_CAMPAIGN_ID,
} from "./data/valtiaWikiSeed.mjs";
import {
    resolveRelationEndpoints,
    isRelationValid,
    isKnownRelationType,
    WIKI_RELATION_TYPE_LABELS,
} from "../src/constants/wikiRelationTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const STRENGTH_MIN = -10;
const STRENGTH_MAX = 10;

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const CAMPAIGN_ID = args.campaignId || SEED_CAMPAIGN_ID;
const DRY_RUN = Boolean(args["dry-run"]);
const SKIP_RELATIONS = Boolean(args["skip-relations"]);
const STRICT_RELATIONS = Boolean(args["strict-relations"]);
const PURGE_STALE = args["no-purge"] ? false : true;
const ONLY_TYPES = args.only
    ? String(args.only).split(",").map((s) => s.trim()).filter(Boolean)
    : null;

const SLUG_TO_TYPE = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.entityType]));

function clampStrength(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.max(STRENGTH_MIN, Math.min(STRENGTH_MAX, Math.round(v)));
}

function slugify(text = "") {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 80);
}

const NS_BY_TYPE = {
    locacion: "locacion",
    especie: "especie",
    ideologia: "ideologia",
    organizacion: "organizacion",
    personaje: "personaje",
    reliquia: "reliquia",
    evento_historico: "timeline",
    cronica: "cronica",
};

const REF_FIELDS = {
    locacion: [
        "parentLocationEntityId",
        "dominantLanguageEntityId",
        "dominantIdeologyEntityId",
        "dominantSpeciesEntityId",
    ],
    especie: ["homeworldEntityId"],
    ideologia: ["holyLanguageEntityId", "primaryDeityFigureEntityId"],
    organizacion: ["headquartersEntityId"],
    personaje: ["speciesEntityId", "birthPlaceEntityId", "deathPlaceEntityId"],
    reliquia: ["creatorEntityId", "currentHolderEntityId", "originLocationEntityId"],
};

function buildCustomFields(entity, slugToId) {
    const { entityType, meta = {}, refs = {}, members, organizations } = entity;
    const ns = NS_BY_TYPE[entityType];
    if (!ns) return {};

    const customFields = {};

    if (entityType === "evento_historico") {
        customFields.timeline = {
            calendar: "dz",
            date: meta.date || "",
            branch: "center",
            isCore: Boolean(meta.isCore),
            anchorId: null,
            eventKind: meta.eventKind || "otro",
            certainty: meta.certainty || "canon",
            narrativeArc: meta.narrativeArc || "",
        };
        return customFields;
    }

    if (entityType === "cronica") {
        customFields.cronica = {
            category: meta.category || "general",
            isLocked: Boolean(meta.isLocked),
            unlockGoal: meta.unlockGoal || "",
            legacyEncyclopediaId: null,
        };
        return customFields;
    }

    if (!ns || ns === "timeline") return customFields;

    const block = { ...meta };

    const refList = REF_FIELDS[entityType] || [];
    for (const field of refList) {
        const slug = refs[field];
        if (slug) block[field] = slugToId[slug] || null;
    }

    if (entityType === "especie" && Array.isArray(refs.languageEntityIds)) {
        block.languageEntityIds = refs.languageEntityIds
            .map((s) => slugToId[s])
            .filter(Boolean);
    }

    if (entityType === "organizacion" && Array.isArray(members)) {
        block.members = members.map((m) => ({
            kind: m.kind === "vtt" ? "vtt" : "wiki",
            id: m.slug ? slugToId[m.slug] : m.id,
            status: m.status === "sospechado" ? "sospechado" : "confirmado",
            role: m.role || "",
        })).filter((m) => m.id);
    }

    if (entityType === "personaje" && Array.isArray(organizations)) {
        block.organizations = organizations.map((o) => ({
            organizationEntityId: slugToId[o.slug],
            status: o.status === "sospechado" ? "sospechado" : "confirmado",
            role: o.role || "",
        })).filter((o) => o.organizationEntityId);
    }

    customFields[ns] = block;
    return customFields;
}

function entityPayload(entity, slugToId) {
    return {
        campaignId: CAMPAIGN_ID,
        entityType: entity.entityType,
        title: entity.title,
        summary: entity.summary || "",
        body: entity.body || "",
        tags: entity.tags || [],
        visibility: entity.visibility || "players",
        slug: entity.slug || slugify(entity.title),
        linkedVttLocationId: null,
        linkedVttCharacterId: null,
        imageUrl: null,
        customFields: buildCustomFields(entity, slugToId),
        updatedAt: Timestamp.now(),
        updatedBy: "seed-valtia-wiki",
    };
}

function idToSlugMap(slugToId) {
    return Object.fromEntries(Object.entries(slugToId).map(([slug, id]) => [id, slug]));
}

function resolveSeedRelation(rel, slugToId) {
    const fromType = SLUG_TO_TYPE[rel.from];
    const toType = SLUG_TO_TYPE[rel.to];
    const fromId = slugToId[rel.from];
    const toId = slugToId[rel.to];

    if (!fromType || !toType) {
        return { error: `unknown slug type: ${rel.from} → ${rel.to}` };
    }
    if (!fromId || !toId) {
        return { error: `missing id for slug: ${rel.from} → ${rel.to}` };
    }

    const fromEntity = { id: fromId, entityType: fromType };
    const toEntity = { id: toId, entityType: toType };

    if (!isRelationValid(rel.relationType, fromType, toType)) {
        return {
            error: `invalid relation ${rel.from}(${fromType}) -[${rel.relationType}]-> ${rel.to}(${toType})`,
        };
    }

    const { fromEntityId, toEntityId } = resolveRelationEndpoints(
        fromEntity,
        toEntity,
        rel.relationType
    );

    const idToSlug = idToSlugMap(slugToId);
    const canonFromSlug = idToSlug[fromEntityId];
    const canonToSlug = idToSlug[toEntityId];

    return {
        fromEntityId,
        toEntityId,
        canonFromSlug,
        canonToSlug,
        relationType: rel.relationType,
    };
}

function relKey(fromSlug, toSlug, type) {
    return `${fromSlug}|${toSlug}|${type}`;
}

const BATCH_DELETE_SIZE = 400;

async function deleteDocRefsInBatches(db, docRefs) {
    let deleted = 0;
    for (let i = 0; i < docRefs.length; i += BATCH_DELETE_SIZE) {
        const batch = db.batch();
        const chunk = docRefs.slice(i, i + BATCH_DELETE_SIZE);
        for (const ref of chunk) batch.delete(ref);
        if (!DRY_RUN) await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

function buildManifestSlugs(entities = ENTITIES) {
    return new Set(entities.map((e) => e.slug || slugify(e.title)));
}

function buildIdToEntityMap(docs) {
    const map = new Map();
    for (const doc of docs) {
        map.set(doc.id, { id: doc.id, ref: doc.ref, data: doc.data() });
    }
    return map;
}

function buildManifestRelationKeys(slugToId) {
    const keys = new Set();
    for (const rel of RELATIONS) {
        const resolved = resolveSeedRelation(rel, slugToId);
        if (resolved.error) continue;
        keys.add(relKey(resolved.canonFromSlug, resolved.canonToSlug, rel.relationType));
    }
    return keys;
}

/**
 * Elimina relaciones obsoletas: tipo desconocido, matriz inválida o ausentes del manifiesto.
 */
function collectStaleRelationRefs(relDocs, slugToId, idToEntity, manifestRelKeys) {
    const idToSlug = idToSlugMap(slugToId);
    const stale = [];

    for (const doc of relDocs) {
        const r = doc.data();
        const fromSlug = idToSlug[r.fromEntityId] || r.fromEntityId;
        const toSlug = idToSlug[r.toEntityId] || r.toEntityId;
        const key = relKey(fromSlug, toSlug, r.relationType);

        const fromEntity = idToEntity.get(r.fromEntityId);
        const toEntity = idToEntity.get(r.toEntityId);
        const fromType = fromEntity?.data?.entityType;
        const toType = toEntity?.data?.entityType;

        const unknownType = !isKnownRelationType(r.relationType);
        const invalidMatrix = fromType && toType
            && !isRelationValid(r.relationType, fromType, toType);
        const missingEndpoint = !fromEntity || !toEntity;
        const notInManifest = !manifestRelKeys.has(key);

        if (unknownType || invalidMatrix || missingEndpoint || notInManifest) {
            stale.push({
                ref: doc.ref,
                key,
                reason: unknownType
                    ? "unknown_type"
                    : invalidMatrix
                        ? "invalid_matrix"
                        : missingEndpoint
                            ? "missing_endpoint"
                            : "not_in_manifest",
            });
        }
    }

    return stale;
}

/**
 * Elimina entidades cuyo slug no está en el manifiesto (o sin slug).
 */
function collectStaleEntityRefs(entityDocs, manifestSlugs, onlyTypes = null) {
    const stale = [];

    for (const doc of entityDocs) {
        const data = doc.data();
        const slug = data.slug;
        const inScope = !onlyTypes || onlyTypes.includes(data.entityType);

        if (!inScope) continue;

        if (!slug || !manifestSlugs.has(slug)) {
            stale.push({
                ref: doc.ref,
                slug: slug || doc.id,
                reason: slug ? "not_in_manifest" : "missing_slug",
            });
        }
    }

    return stale;
}

async function purgeStaleWikiData(db, entitiesCol, relationsCol) {
    if (!PURGE_STALE) {
        console.log("[purge] Skipped (--no-purge).\n");
        return { relDeleted: 0, entDeleted: 0 };
    }

    if (ONLY_TYPES) {
        console.log("[purge] Skipped when --only is set (partial seed).\n");
        return { relDeleted: 0, entDeleted: 0 };
    }

    const entitySnap = await entitiesCol.get();
    const relSnap = await relationsCol.get();

    const slugToDoc = new Map();
    const slugToId = {};
    for (const doc of entitySnap.docs) {
        const slug = doc.data().slug;
        if (slug) {
            slugToDoc.set(slug, { id: doc.id, ref: doc.ref, data: doc.data() });
            slugToId[slug] = doc.id;
        }
    }

    const idToEntity = buildIdToEntityMap(entitySnap.docs);
    const manifestSlugs = buildManifestSlugs();
    const manifestRelKeys = buildManifestRelationKeys(slugToId);

    const staleRels = collectStaleRelationRefs(
        relSnap.docs,
        slugToId,
        idToEntity,
        manifestRelKeys
    );
    const staleEntities = collectStaleEntityRefs(entitySnap.docs, manifestSlugs);

    console.log(`[purge] Stale entityRelations: ${staleRels.length} / ${relSnap.size}`);
    for (const item of staleRels.slice(0, 20)) {
        console.log(`  ${DRY_RUN ? "DRY DEL REL" : "DEL REL"} ${item.key} (${item.reason})`);
    }
    if (staleRels.length > 20) {
        console.log(`  ... and ${staleRels.length - 20} more`);
    }

    console.log(`[purge] Stale wikiEntities: ${staleEntities.length} / ${entitySnap.size}`);
    for (const item of staleEntities.slice(0, 20)) {
        console.log(`  ${DRY_RUN ? "DRY DEL ENT" : "DEL ENT"} ${item.slug} (${item.reason})`);
    }
    if (staleEntities.length > 20) {
        console.log(`  ... and ${staleEntities.length - 20} more`);
    }

    const relDeleted = await deleteDocRefsInBatches(db, staleRels.map((r) => r.ref));
    const entDeleted = await deleteDocRefsInBatches(db, staleEntities.map((e) => e.ref));

    console.log(`[purge] ${DRY_RUN ? "Would delete" : "Deleted"} ${relDeleted} relations, ${entDeleted} entities.\n`);
    return { relDeleted, entDeleted };
}

async function run() {
    const defaultSa = join(__dirname, "..", "valtier-map-system-firebase-admins.json");
    const legacySa = join(__dirname, "..", "serviceAccount.json");
    const serviceAccountPath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        (existsSync(defaultSa) ? defaultSa : legacySa);

    if (!existsSync(serviceAccountPath)) {
        console.error(
            "ERROR: Firebase service account not found.\n" +
            "  Place valtier-map-system-firebase-admins.json at project root, or\n" +
            "  set GOOGLE_APPLICATION_CREDENTIALS to your Admin SDK key path.\n" +
            "  Download from: Firebase Console → Project settings → Service accounts → Generate new private key"
        );
        process.exit(1);
    }

    initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, "utf-8"))) });
    const db = getFirestore();

    const entitiesCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities");
    const relationsCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("entityRelations");

    console.log(`\n[seed] Campaign: ${CAMPAIGN_ID} | Dry-run: ${DRY_RUN} | Purge: ${PURGE_STALE}`);
    console.log(`[seed] Entities in manifest: ${ENTITIES.length} | Relations: ${RELATIONS.length}\n`);

    const slugCounts = ENTITIES.reduce((acc, e) => {
        acc[e.slug] = (acc[e.slug] || 0) + 1;
        return acc;
    }, {});
    const dupSlugs = Object.entries(slugCounts).filter(([, n]) => n > 1);
    if (dupSlugs.length) {
        console.error("[seed] Duplicate slugs in manifest:", dupSlugs.map(([s]) => s).join(", "));
        process.exit(1);
    }

    let existingSnap = await entitiesCol.get();
    console.log(`[audit] Existing wikiEntities: ${existingSnap.size}`);

    let relSnap = await relationsCol.get();
    console.log(`[audit] Existing entityRelations: ${relSnap.size}`);

    const { relDeleted, entDeleted } = await purgeStaleWikiData(db, entitiesCol, relationsCol);

    if (!DRY_RUN && PURGE_STALE && !ONLY_TYPES && (relDeleted > 0 || entDeleted > 0)) {
        existingSnap = await entitiesCol.get();
        relSnap = await relationsCol.get();
        console.log(`[audit] After purge — entities: ${existingSnap.size} | relations: ${relSnap.size}\n`);
    } else {
        console.log("");
    }

    const slugToDoc = new Map();
    for (const doc of existingSnap.docs) {
        const slug = doc.data().slug;
        if (slug) slugToDoc.set(slug, { id: doc.id, ref: doc.ref, data: doc.data() });
    }

    const slugToId = {};
    for (const [slug, { id }] of slugToDoc) slugToId[slug] = id;

    const filtered = ONLY_TYPES
        ? ENTITIES.filter((e) => ONLY_TYPES.includes(e.entityType))
        : ENTITIES;

    const ordered = CREATION_PHASES.flatMap((type) =>
        filtered.filter((e) => e.entityType === type)
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const entity of ordered) {
        const slug = entity.slug || slugify(entity.title);
        const payload = entityPayload(entity, slugToId);
        payload.slug = slug;

        const existing = slugToDoc.get(slug);
        const action = existing ? "UPDATE" : "CREATE";

        console.log(`  ${DRY_RUN ? "DRY " : ""}${action} [${entity.entityType}] ${entity.title} (${slug})`);

        if (DRY_RUN) {
            slugToId[slug] = existing?.id || `dry-${slug}`;
            if (existing) updated++;
            else created++;
            continue;
        }

        try {
            if (existing) {
                await existing.ref.update(payload);
                slugToId[slug] = existing.id;
                updated++;
            } else {
                const ref = await entitiesCol.add({
                    ...payload,
                    createdAt: Timestamp.now(),
                    createdBy: "seed-valtia-wiki",
                });
                slugToId[slug] = ref.id;
                slugToDoc.set(slug, { id: ref.id, ref, data: payload });
                created++;
            }
        } catch (err) {
            console.error(`  ERROR ${slug}: ${err.message}`);
            errors++;
        }
    }

    console.log("\n[seed] Second pass: resolving entity refs in customFields...");
    for (const entity of ordered) {
        const slug = entity.slug || slugify(entity.title);
        const id = slugToId[slug];
        if (!id || DRY_RUN) continue;

        const customFields = buildCustomFields(entity, slugToId);
        try {
            await entitiesCol.doc(id).update({ customFields, updatedAt: Timestamp.now() });
        } catch (err) {
            console.error(`  REF ERROR ${slug}: ${err.message}`);
            errors++;
        }
    }

    let relCreated = 0;
    let relUpdated = 0;
    let relSkipped = 0;
    let relInvalid = 0;

    if (!SKIP_RELATIONS && !ONLY_TYPES) {
        console.log("\n[seed] Seeding relations (with matrix validation)...");

        const existingRels = relSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const idToSlug = idToSlugMap(slugToId);
        const existingByKey = new Map();
        for (const r of existingRels) {
            const fromSlug = idToSlug[r.fromEntityId] || r.fromEntityId;
            const toSlug = idToSlug[r.toEntityId] || r.toEntityId;
            existingByKey.set(relKey(fromSlug, toSlug, r.relationType), r);
        }

        for (const rel of RELATIONS) {
            const resolved = resolveSeedRelation(rel, slugToId);
            if (resolved.error) {
                console.warn(`  INVALID ${rel.from} -[${rel.relationType}]-> ${rel.to}: ${resolved.error}`);
                relInvalid++;
                if (STRICT_RELATIONS) {
                    console.error("[seed] Aborting (--strict-relations).");
                    process.exit(1);
                }
                continue;
            }

            const strength = clampStrength(rel.strength ?? 0);
            const key = relKey(resolved.canonFromSlug, resolved.canonToSlug, rel.relationType);
            const existing = existingByKey.get(key);
            const label = WIKI_RELATION_TYPE_LABELS[rel.relationType] || rel.relationType;

            if (DRY_RUN) {
                const norm =
                    resolved.canonFromSlug !== rel.from || resolved.canonToSlug !== rel.to
                        ? ` (canon: ${resolved.canonFromSlug}→${resolved.canonToSlug})`
                        : "";
                console.log(`  DRY REL ${rel.from} -[${rel.relationType}]-> ${rel.to}${norm}`);
                if (existing) relUpdated++;
                else relCreated++;
                continue;
            }

            const payload = {
                campaignId: CAMPAIGN_ID,
                fromEntityId: resolved.fromEntityId,
                toEntityId: resolved.toEntityId,
                relationType: rel.relationType,
                label: rel.label || "",
                strength,
            };

            try {
                if (existing) {
                    await relationsCol.doc(existing.id).update(payload);
                    relUpdated++;
                } else {
                    await relationsCol.add({
                        ...payload,
                        createdAt: Timestamp.now(),
                        createdBy: "seed-valtia-wiki",
                    });
                    relCreated++;
                }
            } catch (err) {
                console.error(`  REL ERROR ${rel.from}→${rel.to} (${label}): ${err.message}`);
                errors++;
            }
        }
    }

    console.log("\n[seed] Done.");
    console.log(`  Purged relations : ${relDeleted}`);
    console.log(`  Purged entities  : ${entDeleted}`);
    console.log(`  Entities created : ${created}`);
    console.log(`  Entities updated : ${updated}`);
    console.log(`  Entities skipped : ${skipped}`);
    console.log(`  Relations created: ${relCreated}`);
    console.log(`  Relations updated: ${relUpdated}`);
    console.log(`  Relations skipped: ${relSkipped}`);
    console.log(`  Relations invalid: ${relInvalid}`);
    console.log(`  Errors           : ${errors}`);
    if (DRY_RUN) console.log("\n  (Dry run — no writes performed.)");
    if (!DRY_RUN && errors === 0 && relInvalid === 0) {
        console.log(`\n  Firestore: campaigns/${CAMPAIGN_ID}/wikiEntities`);
        console.log(`           campaigns/${CAMPAIGN_ID}/entityRelations`);
        console.log("  Open the app — wiki sync (onSnapshot) will load data automatically.");
    }
}

run().catch((err) => {
    console.error("[seed] Fatal:", err);
    process.exit(1);
});
