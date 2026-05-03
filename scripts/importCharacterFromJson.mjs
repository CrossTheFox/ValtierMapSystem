/**
 * Import a character bundle (JSON) into Firestore:
 *   - Writes `abilities` docs (id = ability.id)
 *   - Adds `characters` doc with merged fields + unlockedAbilities
 *
 * Usage:
 *   node scripts/importCharacterFromJson.mjs scripts/character-bundles/judeth-kalain.bundle.json --campaignId=XXX
 *   node scripts/importCharacterFromJson.mjs ... --campaignId=XXX --locationId=YYY   # opcional: asignar a una location del mapa
 *
 * Env / credentials (same pattern as other admin scripts):
 *   Place service account JSON at project root (gitignored), default:
 *   ./valtier-map-system-firebase-admins.json
 *
 * Options:
 *   --dry-run     Log payloads only, no writes
 *   --campaignId= override bundle.import.campaignId (required).
 *   --locationId= opcional; si se omite, el personaje se crea con locationId null (no aparece en ninguna location del world slice hasta que lo asignes).
 *   --playerUid=  opcional; si se pasa, el personaje se crea con ownerPlayerId (aparece en Characters Settings para ese jugador).
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_SERVICE_ACCOUNT = path.resolve(
    process.cwd(),
    "valtier-map-system-firebase-admins.json"
);

function parseArgs(argv) {
    const out = { dryRun: false, campaignId: null, locationId: null, playerUid: null };
    for (const a of argv.slice(2)) {
        if (a === "--dry-run") out.dryRun = true;
        else if (a.startsWith("--campaignId=")) out.campaignId = a.split("=")[1];
        else if (a.startsWith("--locationId=")) out.locationId = a.split("=")[1];
        else if (a.startsWith("--playerUid=")) out.playerUid = a.split("=")[1]?.trim() || null;
    }
    return out;
}

function loadBundle(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
}

function stripAbilityForFirestore(ability) {
    const { id, ...rest } = ability;
    const row = { ...rest };
    if (row.key === undefined) row.key = id;
    return { id, row };
}

async function main() {
    const fileArg = process.argv[2];
    if (!fileArg || fileArg.startsWith("--")) {
        console.error("Usage: node scripts/importCharacterFromJson.mjs <bundle.json> --campaignId=id [--locationId=id] [--dry-run]");
        process.exit(1);
    }

    const bundlePath = path.resolve(process.cwd(), fileArg);
    const bundle = loadBundle(bundlePath);
    const cli = parseArgs(process.argv);

    const campaignId = cli.campaignId || bundle.import?.campaignId;
    const rawLocation =
        cli.locationId !== null && cli.locationId !== undefined && cli.locationId !== ""
            ? cli.locationId
            : bundle.import?.locationId;
    const locationId =
        rawLocation && !String(rawLocation).includes("REPLACE") ? String(rawLocation).trim() : null;
    const dryRun = cli.dryRun || bundle.import?.dryRun === true;

    if (!campaignId || campaignId.includes("REPLACE")) {
        console.error("Missing or placeholder campaignId. Pass --campaignId=... or set bundle.import.campaignId.");
        process.exit(1);
    }

    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SERVICE_ACCOUNT;
    if (!fs.existsSync(saPath)) {
        console.error(`Service account not found: ${saPath}`);
        process.exit(1);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
        });
    }
    const db = admin.firestore();

    const systemId = bundle.import?.systemId && !String(bundle.import.systemId).includes("REPLACE")
        ? bundle.import.systemId
        : null;

    const ownerPlayerId =
        cli.playerUid ||
        (bundle.import?.ownerPlayerId && !String(bundle.import.ownerPlayerId).includes("REPLACE")
            ? bundle.import.ownerPlayerId
            : null);

    const unlocked = Array.isArray(bundle.character?.unlockedAbilities)
        ? bundle.character.unlockedAbilities
        : [];
    const allAbilities =
        Array.isArray(bundle.character?.allAbilities) && bundle.character.allAbilities.length > 0
            ? bundle.character.allAbilities
            : unlocked;

    const charPayload = {
        ...bundle.character,
        campaignId,
        locationId,
        ownerPlayerId,
        allAbilities,
        relations: bundle.character?.relations || {},
    };

    const abilities = Array.isArray(bundle.abilities) ? bundle.abilities : [];

    console.log("— Bundle assumptions (review) —");
    (bundle.assumptions || []).forEach((line, i) => console.log(`${i + 1}. ${line}`));
    console.log("— End assumptions —\n");

    if (dryRun) {
        console.log("[dry-run] Would write abilities:", abilities.map((a) => a.id));
        console.log("[dry-run] Character:", JSON.stringify(charPayload, null, 2));
        process.exit(0);
    }

    const batch = db.batch();

    for (const ability of abilities) {
        const { id, row } = stripAbilityForFirestore(ability);
        const ref = db.collection("abilities").doc(id);
        const data = {
            ...row,
            campaignId,
            ...(systemId ? { systemId } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        batch.set(ref, data, { merge: true });
    }

    const charRef = db.collection("characters").doc();
    batch.set(charRef, {
        ...charPayload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    console.log(`OK: character ${charRef.id} created with ${abilities.length} abilities linked by unlockedAbilities.`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
