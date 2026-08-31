/**
 * Backfill A+ kit fields for every Firestore `abilities/{key}` node except `class_root`.
 * Covers: ability, trait, upgrade, mastery, ultimate (LB).
 *
 * Usage:
 *   node scripts/backfillAbilitiesAplus.mjs                 # dry-run (default)
 *   node scripts/backfillAbilitiesAplus.mjs --apply
 *   node scripts/backfillAbilitiesAplus.mjs --force --apply
 *   node scripts/backfillAbilitiesAplus.mjs --only=judeth-ability-anchor --apply
 *   node scripts/backfillAbilitiesAplus.mjs --export-report=backups/aplus-backfill-report.json
 *
 * Re-run on already-migrated nodes: applies content hygiene (blurb/description,
 * tag cleanup) even when `attack` already exists — no `--force` required.
 *
 * Credentials:
 *   ./valtier-map-system-firebase-admins.json
 *   or GOOGLE_APPLICATION_CREDENTIALS
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildAbilityAplusPatch } from "../src/utils/abilityContentParser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SA = path.join(ROOT, "valtier-map-system-firebase-admins.json");
const OVERRIDES_PATH = path.join(__dirname, "data", "aplus-backfill-overrides.json");

function loadOverrides() {
    if (!fs.existsSync(OVERRIDES_PATH)) return {};
    return JSON.parse(fs.readFileSync(OVERRIDES_PATH, "utf8"));
}

function deepMergePatch(base, override) {
    if (!override || typeof override !== "object") return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(override)) {
        if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
            out[k] = deepMergePatch(base[k], v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function parseArgs(argv) {
    const out = {
        apply: false,
        force: false,
        only: null,
        exportReport: null,
        snapshotIn: null,
    };
    for (const arg of argv.slice(2)) {
        if (arg === "--apply") out.apply = true;
        else if (arg === "--force") out.force = true;
        else if (arg.startsWith("--only=")) out.only = arg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean);
        else if (arg.startsWith("--export-report=")) out.exportReport = arg.slice("--export-report=".length);
        else if (arg.startsWith("--snapshot-in=")) out.snapshotIn = arg.slice("--snapshot-in=".length);
        else if (arg === "--dry-run") out.apply = false;
    }
    return out;
}

function initAdmin() {
    if (admin.apps.length) return admin.firestore();
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
    if (!fs.existsSync(credPath)) {
        throw new Error(`Service account not found: ${credPath}`);
    }
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))),
    });
    return admin.firestore();
}

async function loadAbilities(db, snapshotIn) {
    if (snapshotIn) {
        const abs = path.resolve(ROOT, snapshotIn);
        const raw = JSON.parse(fs.readFileSync(abs, "utf8"));
        return Array.isArray(raw) ? raw : [];
    }
    const snap = await db.collection("abilities").get();
    return snap.docs.map((d) => ({ id: d.id, key: d.id, ...d.data() }));
}

function summarizePatch(patch, docType) {
    const bits = [
        `kind=${patch.abilityKind}`,
        `hasAttack=${patch.hasAttack}`,
    ];
    if (patch.traitMode) bits.push(`traitMode=${patch.traitMode}`);
    if (patch.resolveCost != null) bits.push(`resolve=${patch.resolveCost}`);
    if (patch.attack?.damageOnHit?.formula) bits.push(`light=${patch.attack.damageOnHit.formula}`);
    if (patch.attack?.damageOnHeavy?.formula) bits.push(`heavy=${patch.attack.damageOnHeavy.formula}`);
    if (patch.attack?.damageOnCrit?.formula) bits.push(`crit=${patch.attack.damageOnCrit.formula}`);
    if (patch.attack?.damageOnMiss?.formula) bits.push(`miss=${patch.attack.damageOnMiss.formula}`);
    if (patch.effects?.length) bits.push(`fx=${patch.effects.length}`);
    if (docType && docType !== "ability") bits.unshift(`type=${docType}`);
    return bits.join(" · ");
}

async function main() {
    const cli = parseArgs(process.argv);
    const db = cli.snapshotIn ? null : initAdmin();
    const docs = await loadAbilities(db, cli.snapshotIn);
    const onlySet = cli.only ? new Set(cli.only) : null;

    const report = {
        generatedAt: new Date().toISOString(),
        mode: cli.apply ? "apply" : "dry-run",
        force: cli.force,
        totals: { scanned: 0, patched: 0, skipped: 0, needsReview: 0 },
        items: [],
    };

    console.log(cli.apply ? "APPLY — writing Firestore patches" : "DRY-RUN — no writes");
    if (cli.force) console.log("FORCE — overwrite existing structured attack objects");

    const overrides = loadOverrides();
    console.log(`Overrides loaded: ${Object.keys(overrides).length} entries`);

    const batchSize = 400;
    let batch = db ? db.batch() : null;
    let batchCount = 0;

    for (const doc of docs) {
        const id = String(doc.id || doc.key || "");
        if (!id) continue;
        if (onlySet && !onlySet.has(id)) continue;

        report.totals.scanned += 1;
        const result = buildAbilityAplusPatch(doc, { force: cli.force });
        if (!result.skip && overrides[id]) {
            result.patch = deepMergePatch(result.patch, overrides[id]);
        }

        if (result.skip) {
            report.totals.skipped += 1;
            report.items.push({
                id,
                label: doc.label || doc.title || id,
                type: doc.type,
                status: "skipped",
                reason: result.reason,
                reviewReasons: result.classification?.reviewReasons || [],
            });
            continue;
        }

        report.totals.patched += 1;
        if (result.needsReview) report.totals.needsReview += 1;

        const item = {
            id,
            label: doc.label || doc.title || id,
            type: doc.type,
            status: cli.apply ? "patched" : "would-patch",
            summary: summarizePatch(result.patch, result.docType),
            needsReview: result.needsReview,
            reviewReasons: result.reviewReasons,
            patch: result.patch,
        };
        report.items.push(item);

        console.log(
            `${cli.apply ? "PATCH" : "WOULD"} ${id} (${doc.label || doc.type}) — ${item.summary}${
                result.needsReview ? ` ⚠ ${result.reviewReasons.join(", ")}` : ""
            }`,
        );

        if (cli.apply && db) {
            const ref = db.collection("abilities").doc(id);
            batch.set(
                ref,
                {
                    key: id,
                    ...result.patch,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true },
            );
            batchCount += 1;
            if (batchCount >= batchSize) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }
    }

    if (cli.apply && db && batchCount > 0) {
        await batch.commit();
    }

    const reportPath = cli.exportReport
        ? path.resolve(ROOT, cli.exportReport)
        : path.resolve(ROOT, `backups/aplus-backfill-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("\nSummary:");
    console.log(JSON.stringify(report.totals, null, 2));
    console.log(`Report → ${reportPath}`);

    if (report.totals.needsReview > 0) {
        console.log("\nNeeds manual review:");
        for (const item of report.items.filter((i) => i.needsReview)) {
            console.log(`  - ${item.id}: ${item.reviewReasons.join(", ")}`);
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
