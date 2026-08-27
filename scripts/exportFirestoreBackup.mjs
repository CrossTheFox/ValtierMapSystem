/**
 * Export Firestore collections to local JSON (gitignored under backups/).
 *
 * Usage:
 *   node scripts/exportFirestoreBackup.mjs
 *   node scripts/exportFirestoreBackup.mjs --outDir=backups/custom-name
 *
 * Credentials (same as other admin scripts):
 *   ./valtier-map-system-firebase-admins.json
 *   or GOOGLE_APPLICATION_CREDENTIALS
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DEFAULT_SA = path.join(ROOT, "valtier-map-system-firebase-admins.json");

const CAMPAIGN_SUBCOLLECTIONS = [
    "wikiEntities",
    "entityDmNotes",
    "entityRelations",
    "missions",
    "items",
    "sessions",
    "messages",
];

const TOP_LEVEL_COLLECTIONS = [
    "characters",
    "game",
    "campaigns",
    "maps",
    "locations",
    "encyclopedia",
    "abilities",
    "tags",
    "clases",
    "players",
];

function parseArgs(argv) {
    const out = { outDir: null };
    for (const a of argv.slice(2)) {
        if (a.startsWith("--outDir=")) out.outDir = a.slice("--outDir=".length);
    }
    return out;
}

function serializeValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return value;

    if (value instanceof admin.firestore.Timestamp) {
        return { __type: "Timestamp", iso: value.toDate().toISOString() };
    }
    if (value instanceof admin.firestore.GeoPoint) {
        return { __type: "GeoPoint", latitude: value.latitude, longitude: value.longitude };
    }
    if (value instanceof admin.firestore.DocumentReference) {
        return { __type: "DocumentReference", path: value.path };
    }
    if (Array.isArray(value)) return value.map(serializeValue);
    if (value.constructor === Object) {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
        return out;
    }
    return value;
}

function serializeDoc(doc) {
    return { id: doc.id, ...serializeValue(doc.data()) };
}

async function exportCollection(db, collectionPath) {
    const snap = await db.collection(collectionPath).get();
    return snap.docs.map(serializeDoc);
}

async function exportSubcollection(db, parentPath, subName) {
    const snap = await db.collection(`${parentPath}/${subName}`).get();
    return snap.docs.map(serializeDoc);
}

async function exportClasesWithAbilities(db) {
    const classes = await exportCollection(db, "clases");
    const out = [];
    for (const cls of classes) {
        const abilities = await exportSubcollection(db, `clases/${cls.id}`, "abilities");
        out.push({ ...cls, abilities });
    }
    return out;
}

async function exportCampaigns(db) {
    const campaigns = await exportCollection(db, "campaigns");
    const out = [];
    for (const camp of campaigns) {
        const nested = {};
        for (const sub of CAMPAIGN_SUBCOLLECTIONS) {
            nested[sub] = await exportSubcollection(db, `campaigns/${camp.id}`, sub);
        }
        const threadsSnap = await db.collection(`campaigns/${camp.id}/aiThreads`).get();
        const aiThreads = [];
        for (const threadDoc of threadsSnap.docs) {
            const messages = await exportSubcollection(
                db,
                `campaigns/${camp.id}/aiThreads/${threadDoc.id}`,
                "messages"
            );
            aiThreads.push({ id: threadDoc.id, ...serializeValue(threadDoc.data()), messages });
        }
        nested.aiThreads = aiThreads;
        out.push({ ...camp, subcollections: nested });
    }
    return out;
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function main() {
    const cli = parseArgs(process.argv);
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
    if (!fs.existsSync(saPath)) {
        console.error(`Missing service account: ${saPath}`);
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
    });
    const db = admin.firestore();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const outDir = path.resolve(ROOT, cli.outDir || `backups/firestore-${stamp}`);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`Exporting Firestore → ${outDir}`);

    const counts = {};

    if (TOP_LEVEL_COLLECTIONS.includes("campaigns")) {
        const campaigns = await exportCampaigns(db);
        writeJson(path.join(outDir, "campaigns.json"), campaigns);
        counts.campaigns = campaigns.length;
        for (const sub of CAMPAIGN_SUBCOLLECTIONS) {
            counts[`campaigns.${sub}`] = campaigns.reduce(
                (n, c) => n + (c.subcollections?.[sub]?.length || 0),
                0
            );
        }
        counts["campaigns.aiThreads"] = campaigns.reduce(
            (n, c) => n + (c.subcollections?.aiThreads?.length || 0),
            0
        );
        counts["campaigns.aiThreads.messages"] = campaigns.reduce(
            (n, c) =>
                n +
                (c.subcollections?.aiThreads?.reduce((m, t) => m + (t.messages?.length || 0), 0) || 0),
            0
        );
    }

    for (const name of TOP_LEVEL_COLLECTIONS) {
        if (name === "campaigns") continue;
        let docs;
        if (name === "clases") {
            docs = await exportClasesWithAbilities(db);
            counts.clases = docs.length;
            counts["clases.abilities"] = docs.reduce((n, c) => n + (c.abilities?.length || 0), 0);
        } else {
            docs = await exportCollection(db, name);
            counts[name] = docs.length;
        }
        writeJson(path.join(outDir, `${name}.json`), docs);
        console.log(`  ${name}: ${counts[name] ?? docs.length} docs`);
    }

    const manifest = {
        exportedAt: new Date().toISOString(),
        projectId: admin.app().options.credential ? undefined : admin.app().options.projectId,
        outDir: path.relative(ROOT, outDir),
        counts,
    };
    try {
        const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
        manifest.projectId = sa.project_id;
    } catch {
        /* ignore */
    }
    writeJson(path.join(outDir, "manifest.json"), manifest);

    console.log("\nDone.");
    console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
