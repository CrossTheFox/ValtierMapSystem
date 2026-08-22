/**
 * Ensure every VTT character in a campaign has a linked empty wiki PERSONAJE ficha.
 * Idempotent: reuses narrativeEntityId / linkedVttCharacterId when present.
 *
 * Usage:
 *   npm run ensure:narrative-entities:dry
 *   npm run ensure:narrative-entities
 *   node scripts/ensureNarrativeEntitiesForCharacters.mjs --campaignId=OTHER --dry-run
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SEED_CAMPAIGN_ID } from "./data/valtiaWikiSeed.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const CAMPAIGN_ID = args.campaignId || SEED_CAMPAIGN_ID;
const DRY_RUN = Boolean(args.dry || args["dry-run"]);

function initAdmin() {
    const candidates = [
        join(__dirname, "..", "valtier-map-system-firebase-admins.json"),
        join(__dirname, "..", "serviceAccount.json"),
    ];
    const keyPath = candidates.find((p) => existsSync(p));
    if (keyPath) {
        const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
        initializeApp({ credential: cert(serviceAccount) });
    } else {
        initializeApp();
    }
    return getFirestore();
}

async function main() {
    const db = initAdmin();
    console.log(`[ensure-narrative-entities] campaign=${CAMPAIGN_ID} dry=${DRY_RUN}`);

    const charsSnap = await db.collection("characters").where("campaignId", "==", CAMPAIGN_ID).get();
    const wikiCol = db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities");

    let scanned = 0;
    let already = 0;
    let linkedExisting = 0;
    let created = 0;

    for (const charDoc of charsSnap.docs) {
        scanned += 1;
        const char = { id: charDoc.id, ...charDoc.data() };
        const name = char.name || "Sin nombre";

        // 1) Prefer narrativeEntityId
        if (typeof char.narrativeEntityId === "string" && char.narrativeEntityId) {
            const entRef = wikiCol.doc(char.narrativeEntityId);
            const entSnap = await entRef.get();
            if (entSnap.exists) {
                const data = entSnap.data() || {};
                if (data.linkedVttCharacterId !== char.id) {
                    console.log(`  fix-link ${name}: wiki ${entSnap.id} ← character ${char.id}`);
                    if (!DRY_RUN) {
                        await entRef.update({
                            linkedVttCharacterId: char.id,
                            updatedAt: FieldValue.serverTimestamp(),
                        });
                    }
                } else {
                    console.log(`  ok ${name}: ${entSnap.id}`);
                }
                already += 1;
                continue;
            }
            console.log(`  stale narrativeEntityId on ${name} (${char.narrativeEntityId}) — will resolve`);
        }

        // 2) Lookup by linkedVttCharacterId
        const linkedSnap = await wikiCol.where("linkedVttCharacterId", "==", char.id).get();
        const match = linkedSnap.docs.find((d) => d.data()?.entityType === "personaje") || linkedSnap.docs[0];
        if (match) {
            console.log(`  link-existing ${name} → ${match.id}`);
            if (!DRY_RUN) {
                await charDoc.ref.update({ narrativeEntityId: match.id });
                if (match.data()?.linkedVttCharacterId !== char.id) {
                    await match.ref.update({
                        linkedVttCharacterId: char.id,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                }
            }
            linkedExisting += 1;
            continue;
        }

        // 3) Create empty PERSONAJE
        console.log(`  create ${name}`);
        if (!DRY_RUN) {
            const newRef = wikiCol.doc();
            await newRef.set({
                campaignId: CAMPAIGN_ID,
                entityType: "personaje",
                title: name,
                summary: "",
                body: "",
                visibility: "players",
                linkedVttCharacterId: char.id,
                imageUrl: char.imageUrl || null,
                customFields: { personaje: {} },
                tags: [],
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: null,
            });
            await charDoc.ref.update({ narrativeEntityId: newRef.id });
        }
        created += 1;
    }

    console.log(
        `[ensure-narrative-entities] scanned=${scanned} already=${already} linkedExisting=${linkedExisting} created=${created}`
    );
    if (DRY_RUN) console.log("(dry-run — no writes)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
