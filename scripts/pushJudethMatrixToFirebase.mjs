/**
 * Writes all abilities from judeth-kalain-matrix-proposal.json to Firestore
 * and updates a character doc with allAbilities + unlockedAbilities (full list).
 *
 * Usage:
 *   node scripts/pushJudethMatrixToFirebase.mjs --characterId=GWTUlgDn7lpaoe4hQYHb --campaignId=RfY23gcG7No5HcGddo1j
 *
 * Env: GOOGLE_APPLICATION_CREDENTIALS or ./valtier-map-system-firebase-admins.json
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");
const MATRIX_PATH = path.resolve(
    process.cwd(),
    "scripts/character-bundles/judeth-kalain-matrix-proposal.json"
);

function parseArgs(argv) {
    const out = { characterId: null, campaignId: null, dryRun: false };
    for (const a of argv.slice(2)) {
        if (a === "--dry-run") out.dryRun = true;
        else if (a.startsWith("--characterId=")) out.characterId = a.split("=")[1]?.trim();
        else if (a.startsWith("--campaignId=")) out.campaignId = a.split("=")[1]?.trim();
    }
    return out;
}

function stripAbilityRow(ability) {
    const { id, ...rest } = ability;
    const row = { ...rest };
    if (row.key === undefined) row.key = id;
    return { id, row };
}

async function main() {
    const cli = parseArgs(process.argv);
    if (!cli.characterId) {
        console.error("Missing --characterId=");
        process.exit(1);
    }
    if (!cli.campaignId) {
        console.error("Missing --campaignId=");
        process.exit(1);
    }

    const raw = fs.readFileSync(MATRIX_PATH, "utf8");
    const matrix = JSON.parse(raw);
    const abilities = Array.isArray(matrix.abilities) ? matrix.abilities : [];
    const fullList = Array.isArray(matrix.allAbilitiesFullList) ? matrix.allAbilitiesFullList : [];

    if (!abilities.length || !fullList.length) {
        console.error("Matrix JSON missing abilities or allAbilitiesFullList");
        process.exit(1);
    }

    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
    if (!fs.existsSync(saPath)) {
        console.error(`Service account not found: ${saPath}`);
        process.exit(1);
    }

    if (cli.dryRun) {
        console.log("[dry-run] Would write", abilities.length, "ability docs");
        console.log("[dry-run] Character", cli.characterId, "allAbilities length", fullList.length);
        process.exit(0);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
        });
    }
    const db = admin.firestore();

    let batch = db.batch();
    let ops = 0;
    const commitIfNeeded = async () => {
        if (ops >= 450) {
            await batch.commit();
            batch = db.batch();
            ops = 0;
        }
    };

    for (const ability of abilities) {
        const { id, row } = stripAbilityRow(ability);
        const ref = db.collection("abilities").doc(id);
        batch.set(
            ref,
            {
                ...row,
                campaignId: cli.campaignId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        ops++;
        await commitIfNeeded();
    }

    const charRef = db.collection("characters").doc(cli.characterId);
    batch.set(
        charRef,
        {
            allAbilities: fullList,
            unlockedAbilities: fullList,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
    ops++;

    await batch.commit();
    console.log(
        `OK: wrote ${abilities.length} abilities (merge) + character ${cli.characterId} allAbilities/unlockedAbilities (${fullList.length} ids).`
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
