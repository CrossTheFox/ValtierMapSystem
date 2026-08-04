/**
 * Seed ICON core tags into Firestore `tags/{key}` (campaignId: null).
 *
 * Uso: node scripts/seedIconTags.mjs
 *      node scripts/seedIconTags.mjs --dry-run
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ICON_TAGS_SEED } from "../src/constants/iconTagsSeed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const dryRun = process.argv.includes("--dry-run");

const serviceAccountPath = path.join(ROOT, "valtier-map-system-firebase-admins.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Missing service account:", serviceAccountPath);
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))),
    });
}

const db = admin.firestore();

async function main() {
    console.log(`Seeding ${ICON_TAGS_SEED.length} ICON tags${dryRun ? " (dry-run)" : ""}…`);
    let batch = db.batch();
    let ops = 0;
    const commit = async (force = false) => {
        if (!force && ops < 400) return;
        if (ops === 0) return;
        if (!dryRun) await batch.commit();
        batch = db.batch();
        ops = 0;
    };

    for (const tag of ICON_TAGS_SEED) {
        const ref = db.collection("tags").doc(tag.key);
        const payload = {
            key: tag.key,
            label: tag.label,
            rulesSystem: tag.rulesSystem,
            campaignId: null,
            category: tag.category,
            summary: tag.summary || "",
            description: tag.description || tag.summary || "",
            aliases: tag.aliases || [],
            effects: tag.effects || [],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        console.log(`  ${tag.key} (${tag.category})`);
        if (!dryRun) {
            batch.set(ref, payload, { merge: true });
            ops += 1;
            await commit();
        }
    }
    await commit(true);
    console.log(dryRun ? "Dry-run complete." : "Done.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
