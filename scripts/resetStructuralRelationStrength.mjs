/**
 * Reset strength to 0 on structural wiki relations (affinity vs structural taxonomy).
 *
 * Usage:
 *   npm run reset:structural-strength:dry
 *   npm run reset:structural-strength
 *   node scripts/resetStructuralRelationStrength.mjs --campaignId=OTHER --dry-run
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SEED_CAMPAIGN_ID } from "./data/valtiaWikiSeed.mjs";
import {
    getRelationKind,
    WIKI_RELATION_KIND,
} from "../src/constants/wikiRelationTypes.js";

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
    console.log(`[reset-structural-strength] campaign=${CAMPAIGN_ID} dry=${DRY_RUN}`);

    const entitiesSnap = await db.collection("campaigns").doc(CAMPAIGN_ID).collection("wikiEntities").get();
    const typeById = new Map();
    for (const doc of entitiesSnap.docs) {
        typeById.set(doc.id, doc.data()?.entityType || null);
    }

    const relSnap = await db.collection("campaigns").doc(CAMPAIGN_ID).collection("entityRelations").get();
    let scanned = 0;
    let structural = 0;
    let toReset = 0;
    let updated = 0;

    for (const doc of relSnap.docs) {
        scanned += 1;
        const data = doc.data() || {};
        const fromEntityType = typeById.get(data.fromEntityId) || null;
        const toEntityType = typeById.get(data.toEntityId) || null;
        const kind = getRelationKind({
            relationType: data.relationType,
            fromEntityType,
            toEntityType,
        });
        if (kind !== WIKI_RELATION_KIND.STRUCTURAL) continue;
        structural += 1;
        const current = Number(data.strength ?? 0);
        if (current === 0) continue;
        toReset += 1;
        console.log(
            `  reset ${doc.id}: ${data.relationType} ${data.fromEntityId}→${data.toEntityId} strength ${current}→0`
        );
        if (!DRY_RUN) {
            await doc.ref.update({ strength: 0 });
            updated += 1;
        }
    }

    console.log(
        `[reset-structural-strength] scanned=${scanned} structural=${structural} toReset=${toReset} updated=${updated}`
    );
    if (DRY_RUN) console.log("(dry-run — no writes)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
