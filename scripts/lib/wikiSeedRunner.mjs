/**
 * Shared idempotent wiki seed runner for Firestore campaigns.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
    resolveRelationEndpoints,
    isRelationValid,
    isKnownRelationType,
    WIKI_RELATION_TYPE_LABELS,
} from "../../src/constants/wikiRelationTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

const STRENGTH_MIN = -10;
const STRENGTH_MAX = 10;

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

export function parseSeedArgs(argv = process.argv.slice(2)) {
    return Object.fromEntries(
        argv.map((a) => {
            const [k, v] = a.replace(/^--/, "").split("=");
            return [k, v ?? true];
        })
    );
}

export function resolveServiceAccountPath(candidates = []) {
    const paths = [
        process.env.GOOGLE_APPLICATION_CREDENTIALS,
        ...candidates,
        join(PROJECT_ROOT, "serviceAccount.json"),
    ].filter(Boolean);

    return paths.find((p) => existsSync(p)) ?? null;
}

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

function buildCustomFields(entity, slugToId) {
    const { entityType, meta = {}, refs = {}, members, organizations } = entity;
    const ns = NS_BY_TYPE[entityType];
    if (!ns) return {};

    const customFields = {};

    if (entityType === "evento_historico") {
        customFields.timeline = {
            calendar: meta.calendar || "dz",
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

function idToSlugMap(slugToId) {
    return Object.fromEntries(Object.entries(slugToId).map(([slug, id]) => [id, slug]));
}

function relKey(fromSlug, toSlug, type) {
    return `${fromSlug}|${toSlug}|${type}`;
}

const BATCH_DELETE_SIZE = 400;

async function deleteDocRefsInBatches(db, docRefs, dryRun) {
    let deleted = 0;
    for (let i = 0; i < docRefs.length; i += BATCH_DELETE_SIZE) {
        const batch = db.batch();
        const chunk = docRefs.slice(i, i + BATCH_DELETE_SIZE);
        for (const ref of chunk) batch.delete(ref);
        if (!dryRun) await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

function buildIdToEntityMap(docs) {
    const map = new Map();
    for (const doc of docs) {
        map.set(doc.id, { id: doc.id, ref: doc.ref, data: doc.data() });
    }
    return map;
}

/**
 * @param {{
 *   manifest: { ENTITIES: object[], RELATIONS: object[], CREATION_PHASES: string[], SEED_CAMPAIGN_ID?: string },
 *   seedActor: string,
 *   args?: Record<string, unknown>,
 *   serviceAccountCandidates?: string[],
 * }} options
 */
export async function runWikiSeed({
    manifest,
    seedActor,
    args: rawArgs,
    serviceAccountCandidates = [],
}) {
    const { ENTITIES, RELATIONS, CREATION_PHASES, SEED_CAMPAIGN_ID } = manifest;
    const args = rawArgs ?? parseSeedArgs();

    const CAMPAIGN_ID = args.campaignId || SEED_CAMPAIGN_ID;
    const DRY_RUN = Boolean(args["dry-run"]);
    const SKIP_RELATIONS = Boolean(args["skip-relations"]);
    const STRICT_RELATIONS = Boolean(args["strict-relations"]);
    const PURGE_STALE = args["no-purge"] ? false : true;
    const ONLY_TYPES = args.only
        ? String(args.only).split(",").map((s) => s.trim()).filter(Boolean)
        : null;

    const SLUG_TO_TYPE = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.entityType]));

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
            updatedBy: seedActor,
        };
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
        return {
            fromEntityId,
            toEntityId,
            canonFromSlug: idToSlug[fromEntityId],
            canonToSlug: idToSlug[toEntityId],
            relationType: rel.relationType,
        };
    }

    function buildManifestSlugs(entities = ENTITIES) {
        return new Set(entities.map((e) => e.slug || slugify(e.title)));
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
                stale.push({ ref: doc.ref, key });
            }
        }

        return stale;
    }

    function collectStaleEntityRefs(entityDocs, manifestSlugs) {
        const stale = [];
        for (const doc of entityDocs) {
            const data = doc.data();
            const slug = data.slug;
            const inScope = !ONLY_TYPES || ONLY_TYPES.includes(data.entityType);
            if (!inScope) continue;
            if (!slug || !manifestSlugs.has(slug)) {
                stale.push({ ref: doc.ref, slug: slug || doc.id });
            }
        }
        return stale;
    }

    async function purgeStaleWikiData(db, entitiesCol, relationsCol) {
        if (!PURGE_STALE || ONLY_TYPES) {
            console.log("[purge] Skipped.\n");
            return { relDeleted: 0, entDeleted: 0 };
        }

        const entitySnap = await entitiesCol.get();
        const relSnap = await relationsCol.get();

        const slugToId = {};
        for (const doc of entitySnap.docs) {
            const slug = doc.data().slug;
            if (slug) slugToId[slug] = doc.id;
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
        console.log(`[purge] Stale wikiEntities: ${staleEntities.length} / ${entitySnap.size}`);

        const relDeleted = await deleteDocRefsInBatches(db, staleRels.map((r) => r.ref), DRY_RUN);
        const entDeleted = await deleteDocRefsInBatches(db, staleEntities.map((e) => e.ref), DRY_RUN);

        console.log(`[purge] ${DRY_RUN ? "Would delete" : "Deleted"} ${relDeleted} relations, ${entDeleted} entities.\n`);
        return { relDeleted, entDeleted };
    }

    if (!CAMPAIGN_ID) {
        console.error("[seed] ERROR: campaignId required (--campaignId=...)");
        process.exit(1);
    }

    const serviceAccountPath = resolveServiceAccountPath(serviceAccountCandidates);
    if (!serviceAccountPath) {
        console.error(
            "ERROR: Firebase service account not found.\n" +
            "  Place a *-firebase-admins.json at project root, or\n" +
            "  set GOOGLE_APPLICATION_CREDENTIALS to your Admin SDK key path.\n" +
            "  Download from: Firebase Console → Project settings → Service accounts → Generate new private key"
        );
        process.exit(1);
    }

    if (!getApps().length) {
        initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, "utf-8"))) });
    }
    const db = getFirestore();

    const entitiesCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities");
    const relationsCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("entityRelations");

    console.log(`\n[seed] ${seedActor} | Campaign: ${CAMPAIGN_ID} | Dry-run: ${DRY_RUN} | Purge: ${PURGE_STALE}`);
    console.log(`[seed] Service account: ${serviceAccountPath}`);
    console.log(`[seed] Entities: ${ENTITIES.length} | Relations: ${RELATIONS.length}\n`);

    const slugCounts = ENTITIES.reduce((acc, e) => {
        acc[e.slug] = (acc[e.slug] || 0) + 1;
        return acc;
    }, {});
    const dupSlugs = Object.entries(slugCounts).filter(([, n]) => n > 1);
    if (dupSlugs.length) {
        console.error("[seed] Duplicate slugs:", dupSlugs.map(([s]) => s).join(", "));
        process.exit(1);
    }

    let existingSnap = await entitiesCol.get();
    let relSnap = await relationsCol.get();
    console.log(`[audit] Existing wikiEntities: ${existingSnap.size} | entityRelations: ${relSnap.size}`);

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
    let errors = 0;

    for (const entity of ordered) {
        const slug = entity.slug || slugify(entity.title);
        const payload = entityPayload(entity, slugToId);
        payload.slug = slug;

        const existing = slugToDoc.get(slug);
        console.log(`  ${DRY_RUN ? "DRY " : ""}${existing ? "UPDATE" : "CREATE"} [${entity.entityType}] ${entity.title} (${slug})`);

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
                    createdBy: seedActor,
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
    let relInvalid = 0;

    if (!SKIP_RELATIONS && !ONLY_TYPES) {
        console.log("\n[seed] Seeding relations...");

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

            if (DRY_RUN) {
                console.log(`  DRY REL ${rel.from} -[${rel.relationType}]-> ${rel.to}`);
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
                        createdBy: seedActor,
                    });
                    relCreated++;
                }
            } catch (err) {
                const label = WIKI_RELATION_TYPE_LABELS[rel.relationType] || rel.relationType;
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
    console.log(`  Relations created: ${relCreated}`);
    console.log(`  Relations updated: ${relUpdated}`);
    console.log(`  Relations invalid: ${relInvalid}`);
    console.log(`  Errors           : ${errors}`);
    if (DRY_RUN) console.log("\n  (Dry run — no writes performed.)");
    if (!DRY_RUN && errors === 0 && relInvalid === 0) {
        console.log(`\n  Firestore: campaigns/${CAMPAIGN_ID}/wikiEntities`);
        console.log(`           campaigns/${CAMPAIGN_ID}/entityRelations`);
    }

    return { created, updated, relCreated, relUpdated, relInvalid, errors };
}
