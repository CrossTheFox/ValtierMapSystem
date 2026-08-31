/**
 * migrate-character-vitals.mjs
 *
 * Backfill persisted vitals on `characters/{id}` from legacy sessionPools.
 *
 * Usage:
 *   node scripts/migrate-character-vitals.mjs [--campaignId=<id>] [--dry-run]
 *   node scripts/migrate-character-vitals.mjs [--campaignId=<id>] --apply
 *
 * Safety:
 *   - Default is --dry-run (no writes).
 *   - Never overwrites finite existing target fields.
 *   - Does not copy combatOverrides.vigor into character.vigor.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
        const [k, v] = a.replace(/^--/, "").split("=");
        return [k, v ?? true];
    }),
);

const CAMPAIGN_FILTER = args.campaignId || null;
const DRY_RUN = !args.apply;

if (args["dry-run"] === true || args["dry-run"] === "true") {
    // explicit --dry-run flag (default anyway)
}

const serviceAccountCandidates = [
    join(__dirname, "..", "valtier-map-system-firebase-admins.json"),
    join(__dirname, "..", "serviceAccount.json"),
];

const serviceAccountPath = serviceAccountCandidates.find((p) => existsSync(p));

if (!serviceAccountPath) {
    console.error(
        "ERROR: Firebase Admin key not found.\n" +
        "Expected valtier-map-system-firebase-admins.json or serviceAccount.json at project root.",
    );
    process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, "utf-8"))) });
const db = getFirestore();

const DEFAULT_TURN = { act1: true, act2: true, move: true };
const DEFAULT_EFFORT = { current: 0, exhausted: false };

function resolveVit(char) {
    const override = char.combatOverrides?.vit;
    if (Number.isFinite(Number(override)) && Number(override) > 0) {
        return Math.floor(Number(override));
    }
    const legacy = Number(char.vit);
    if (Number.isFinite(legacy) && legacy > 0) return Math.floor(legacy);
    return 4;
}

function finiteInt(value) {
    return Number.isFinite(Number(value));
}

function buildPatch(char, sessionEntry) {
    const vit = resolveVit(char);
    const hpMax = vit * 4;
    const patch = {};
    let wouldChange = false;

    if (!finiteInt(char.hpCur)) {
        const fromPool = sessionEntry?.hp?.current;
        const hpCur = finiteInt(fromPool)
            ? Math.min(Math.max(Math.floor(Number(fromPool)), 0), hpMax)
            : hpMax;
        patch.hpCur = hpCur;
        wouldChange = true;
    }

    if (!finiteInt(char.vigor)) {
        patch.vigor = 0;
        wouldChange = true;
    }

    if (!char.effort || typeof char.effort !== "object") {
        if (sessionEntry?.effort && typeof sessionEntry.effort === "object") {
            const cur = Math.max(0, Math.floor(Number(sessionEntry.effort.current) || 0));
            const exhausted = Boolean(sessionEntry.effort.exhausted) || cur >= 3;
            patch.effort = { current: cur, exhausted };
        } else {
            patch.effort = { ...DEFAULT_EFFORT };
        }
        wouldChange = true;
    }

    if (!char.turn || typeof char.turn !== "object") {
        patch.turn = { ...DEFAULT_TURN };
        wouldChange = true;
    }

    if (!Array.isArray(char.conditions)) {
        patch.conditions = [];
        wouldChange = true;
    }

    if (typeof char.hpBroken !== "boolean" && sessionEntry?.hp && "broken" in sessionEntry.hp) {
        patch.hpBroken = Boolean(sessionEntry.hp.broken);
        wouldChange = true;
    }

    return { patch, wouldChange, vit, hpMax };
}

async function loadSessionPoolsByCampaign(campaignIds) {
    const out = new Map();
    for (const campaignId of campaignIds) {
        const snap = await db.doc(`game/${campaignId}`).get();
        const pools = snap.exists ? (snap.data()?.sessionPools ?? {}) : {};
        out.set(campaignId, pools);
    }
    return out;
}

async function main() {
    console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
    if (CAMPAIGN_FILTER) console.log(`Campaign filter: ${CAMPAIGN_FILTER}`);

    const charSnap = await db.collection("characters").get();
    const characters = charSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => !CAMPAIGN_FILTER || c.campaignId === CAMPAIGN_FILTER);

    const campaignIds = [...new Set(characters.map((c) => c.campaignId).filter(Boolean))];
    const poolsByCampaign = await loadSessionPoolsByCampaign(campaignIds);

    let scanned = 0;
    let candidates = 0;
    let applied = 0;

    for (const char of characters) {
        scanned += 1;
        const pools = char.campaignId ? poolsByCampaign.get(char.campaignId) ?? {} : {};
        const sessionEntry = pools[char.id] ?? null;
        const { patch, wouldChange, vit, hpMax } = buildPatch(char, sessionEntry);

        if (!wouldChange) continue;
        candidates += 1;

        console.log(`\n[${char.id}] ${char.name || "(sin nombre)"}`);
        console.log(`  vit=${vit} hpMax=${hpMax} campaign=${char.campaignId || "—"}`);
        console.log(`  patch: ${JSON.stringify(patch)}`);
        if (sessionEntry) {
            console.log(`  sessionPools: hp=${JSON.stringify(sessionEntry.hp)} effort=${JSON.stringify(sessionEntry.effort)}`);
        }

        if (!DRY_RUN) {
            await db.doc(`characters/${char.id}`).update(patch);
            applied += 1;
        }
    }

    console.log(`\nDone. scanned=${scanned} candidates=${candidates} ${DRY_RUN ? "would_apply" : "applied"}=${DRY_RUN ? candidates : applied}`);
    if (DRY_RUN && candidates > 0) {
        console.log("Re-run with --apply to write changes.");
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
