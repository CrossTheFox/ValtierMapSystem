/**
 * migrateEncyclopediaToWiki.mjs
 *
 * One-shot migration: copies every `encyclopedia` entry for a campaign into
 * `campaigns/{campaignId}/wikiEntities` as entityType "cronica".
 *
 * Usage:
 *   node scripts/migrateEncyclopediaToWiki.mjs --campaignId=<id> [--dry-run]
 *
 * Flags:
 *   --campaignId=<id>   Required. The campaign to migrate.
 *   --dry-run           Print what would happen without writing to Firestore.
 *
 * Safety:
 *   - Never deletes encyclopedia docs (rollback-safe).
 *   - Skips entries already migrated (migratedToWikiEntityId is set).
 *   - Marks migrated encyclopedia docs with `migratedToWikiEntityId`.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    })
);

const CAMPAIGN_ID = args.campaignId;
const DRY_RUN = Boolean(args["dry-run"]);

if (!CAMPAIGN_ID) {
    console.error("ERROR: --campaignId is required.");
    process.exit(1);
}

// ── Firebase admin init ───────────────────────────────────────────────────────

const serviceAccountPath = join(__dirname, "..", "serviceAccount.json");
if (!existsSync(serviceAccountPath)) {
    console.error(
        "ERROR: serviceAccount.json not found at project root.\n" +
        "Download it from Firebase Console → Project Settings → Service Accounts."
    );
    process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, "utf-8"))) });
const db = getFirestore();

// ── Category mapping → cronica category ──────────────────────────────────────

function mapCategory(raw = "") {
    const c = raw.toLowerCase();
    if (c.includes("histor")) return "historia";
    if (c.includes("mito")) return "mito";
    if (c.includes("leyend")) return "leyenda";
    if (c.includes("doc") || c.includes("text") || c.includes("escrit")) return "documento";
    return "general";
}

// ── Slugify (mirrors src/utils/wikiSlug.js logic) ────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
    console.log(`\n[migrate] Campaign: ${CAMPAIGN_ID} | Dry-run: ${DRY_RUN}\n`);

    // 1. Load all encyclopedia entries for this campaign
    const encSnap = await db
        .collection("encyclopedia")
        .where("campaignId", "==", CAMPAIGN_ID)
        .get();

    if (encSnap.empty) {
        console.log("[migrate] No encyclopedia entries found. Nothing to do.");
        return;
    }

    console.log(`[migrate] Found ${encSnap.size} encyclopedia entries.\n`);

    let skipped = 0;
    let migrated = 0;
    let errors = 0;

    for (const encDoc of encSnap.docs) {
        const enc = encDoc.data();

        if (enc.migratedToWikiEntityId) {
            console.log(`  SKIP  "${enc.title}" — already migrated → ${enc.migratedToWikiEntityId}`);
            skipped++;
            continue;
        }

        const isLocked = Boolean(enc.isLocked);
        const visibility = isLocked ? "dm_only" : "players";

        const wikiPayload = {
            campaignId: CAMPAIGN_ID,
            entityType: "cronica",
            title: enc.title || "(sin título)",
            summary: enc.summary || "",
            body: enc.content || "",
            tags: [],
            visibility,
            slug: slugify(enc.title || ""),
            linkedVttLocationId: null,
            linkedVttCharacterId: null,
            imageUrl: enc.imageUrl || null,
            customFields: {
                cronica: {
                    category: mapCategory(enc.category),
                    isLocked,
                    unlockGoal: enc.unlockGoal || "",
                    legacyEncyclopediaId: encDoc.id,
                },
            },
            createdAt: enc.created_at instanceof Timestamp
                ? enc.created_at
                : Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: null,
            updatedBy: null,
        };

        console.log(`  ${DRY_RUN ? "DRY  " : "WRITE"} "${wikiPayload.title}" [${wikiPayload.visibility}]`);

        if (!DRY_RUN) {
            try {
                const wikiRef = await db
                    .collection("campaigns")
                    .doc(CAMPAIGN_ID)
                    .collection("wikiEntities")
                    .add(wikiPayload);

                // Mark original doc as migrated (non-destructive)
                await encDoc.ref.update({ migratedToWikiEntityId: wikiRef.id });
                console.log(`         → wikiEntity ID: ${wikiRef.id}`);
                migrated++;
            } catch (err) {
                console.error(`  ERROR  "${enc.title}": ${err.message}`);
                errors++;
            }
        } else {
            migrated++;
        }
    }

    console.log(`\n[migrate] Done.`);
    console.log(`  Migrated : ${migrated}`);
    console.log(`  Skipped  : ${skipped}`);
    console.log(`  Errors   : ${errors}`);
    if (DRY_RUN) console.log("\n  (Dry run — no writes performed.)");
}

run().catch((err) => {
    console.error("[migrate] Fatal error:", err);
    process.exit(1);
});
