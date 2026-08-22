/**
 * Ensure every wiki PERSONAJE in a campaign has a linked VTT character sheet.
 * Inverse of ensureNarrativeEntitiesForCharacters.mjs.
 *
 * Idempotent: reuses linkedVttCharacterId / narrativeEntityId when present.
 *
 * Usage:
 *   node scripts/ensureVttCharactersForNarrative.mjs --campaignId=gIjWUPwQfYMeUJDMSn5o --dry-run
 *   node scripts/ensureVttCharactersForNarrative.mjs --campaignId=gIjWUPwQfYMeUJDMSn5o
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const CAMPAIGN_ID = args.campaignId;
const DRY_RUN = Boolean(args.dry || args["dry-run"]);
const DEFAULT_STATS = Object.freeze({
    sneak: 0,
    traverse: 0,
    sense: 0,
    study: 0,
    charm: 0,
    command: 0,
    tinker: 0,
    excel: 0,
    smash: 0,
    endure: 0,
});

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

function buildCharacterPayload(campaignId, entity, entityId) {
    const name = String(entity.title || "Sin nombre").trim() || "Sin nombre";
    const summary = typeof entity.summary === "string" ? entity.summary : "";
    return {
        campaignId,
        locationId: null,
        ownerPlayerId: null,
        type: "npc",
        name,
        age: null,
        bio: summary,
        imageUrl: entity.imageUrl || null,
        vit: 4,
        level: 0,
        ap: 0,
        assignedClassIds: [],
        activeClassId: null,
        combatOverrides: {},
        stats: { ...DEFAULT_STATS },
        bond: {
            name: "",
            archetype: "",
            description: "",
            specialAbility: "",
            secondWind: "",
            ideals: [],
            notes: "",
        },
        bondPowers: [],
        burdens: [],
        relations: {},
        narrativeEntityId: entityId,
        speciesEntityId:
            typeof entity.customFields?.personaje?.speciesEntityId === "string"
                ? entity.customFields.personaje.speciesEntityId
                : entity.speciesEntityId || null,
        organizationMemberships: [],
        unlockedAbilities: [],
        allAbilities: [],
        macroBar: { pages: [] },
        isLocked: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
}

async function main() {
    if (!CAMPAIGN_ID || typeof CAMPAIGN_ID !== "string") {
        console.error("Usage: node scripts/ensureVttCharactersForNarrative.mjs --campaignId=ID [--dry-run]");
        process.exit(1);
    }

    const db = initAdmin();
    console.log(`[ensure-vtt-for-narrative] campaign=${CAMPAIGN_ID} dry=${DRY_RUN}`);

    const campSnap = await db.collection("campaigns").doc(CAMPAIGN_ID).get();
    if (!campSnap.exists) {
        console.error(`Campaign not found: ${CAMPAIGN_ID}`);
        process.exit(1);
    }
    console.log(`[campaign] ${campSnap.data()?.name || CAMPAIGN_ID}`);

    const wikiCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities");
    const wikiSnap = await wikiCol.where("entityType", "==", "personaje").get();

    let scanned = 0;
    let already = 0;
    let linkedExisting = 0;
    let created = 0;
    let fixedLink = 0;

    for (const entDoc of wikiSnap.docs) {
        scanned += 1;
        const entity = { id: entDoc.id, ...entDoc.data() };
        const title = entity.title || "Sin nombre";

        // 1) Prefer linkedVttCharacterId if that character belongs to this campaign
        const linkedId =
            typeof entity.linkedVttCharacterId === "string" && entity.linkedVttCharacterId
                ? entity.linkedVttCharacterId
                : null;

        if (linkedId) {
            const charSnap = await db.collection("characters").doc(linkedId).get();
            if (charSnap.exists) {
                const char = charSnap.data() || {};
                if (char.campaignId === CAMPAIGN_ID) {
                    const needsNar = char.narrativeEntityId !== entity.id;
                    const needsName = !char.name && title;
                    console.log(`  ok ${title} ↔ ${linkedId}${needsNar ? " (fix narrativeEntityId)" : ""}`);
                    if (!DRY_RUN && (needsNar || needsName)) {
                        const patch = { updatedAt: FieldValue.serverTimestamp() };
                        if (needsNar) patch.narrativeEntityId = entity.id;
                        if (needsName) patch.name = title;
                        await charSnap.ref.update(patch);
                        fixedLink += 1;
                    } else {
                        already += 1;
                    }
                    continue;
                }
                console.log(
                    `  stale-link ${title}: linkedVtt=${linkedId} belongs to campaign ${char.campaignId} — will recreate`
                );
            } else {
                console.log(`  stale-link ${title}: linkedVtt=${linkedId} missing — will recreate`);
            }
        }

        // 2) Lookup character by narrativeEntityId in this campaign
        const byNar = await db
            .collection("characters")
            .where("campaignId", "==", CAMPAIGN_ID)
            .where("narrativeEntityId", "==", entity.id)
            .limit(1)
            .get();

        if (!byNar.empty) {
            const charDoc = byNar.docs[0];
            console.log(`  link-existing ${title} → ${charDoc.id}`);
            if (!DRY_RUN) {
                await entDoc.ref.update({
                    linkedVttCharacterId: charDoc.id,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                if (charDoc.data()?.narrativeEntityId !== entity.id) {
                    await charDoc.ref.update({
                        narrativeEntityId: entity.id,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                }
            }
            linkedExisting += 1;
            continue;
        }

        // 3) Create VTT character + bidirectional link
        console.log(`  create ${title}`);
        if (!DRY_RUN) {
            const payload = buildCharacterPayload(CAMPAIGN_ID, entity, entity.id);
            const charRef = await db.collection("characters").add(payload);
            await entDoc.ref.update({
                linkedVttCharacterId: charRef.id,
                updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`    → characters/${charRef.id}`);
        }
        created += 1;
    }

    console.log(
        `[ensure-vtt-for-narrative] scanned=${scanned} already=${already} linkedExisting=${linkedExisting} created=${created} fixedLink=${fixedLink}`
    );
    if (DRY_RUN) console.log("(dry-run — no writes)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
