/**
 * Lista habilidades type === "ability" de un personaje (no traits/upgrades/masteries/LB).
 * Uso: node scripts/listCharacterAbilitiesOnly.mjs [characterId]
 */
import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CHARACTER_ID = process.argv[2] || "QolP584GexvFMOpun8t6";

const sa = path.join(ROOT, "valtier-map-system-firebase-admins.json");
if (!fs.existsSync(sa)) {
    console.error("Missing", sa);
    process.exit(1);
}
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(sa, "utf8"))) });
}
const db = admin.firestore();

async function keysToDocs(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i += 10) {
        const chunk = keys.slice(i, i + 10);
        const snap = await db.collection("abilities").where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
        snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() }));
    }
    return out;
}

const snap = await db.collection("characters").doc(CHARACTER_ID).get();
if (!snap.exists) {
    console.error("Personaje no existe:", CHARACTER_ID);
    process.exit(1);
}
const ch = snap.data();
const keys =
    Array.isArray(ch.allAbilities) && ch.allAbilities.length > 0
        ? ch.allAbilities
        : Array.isArray(ch.unlockedAbilities)
          ? ch.unlockedAbilities
          : [];

const docs = await keysToDocs(keys);
const only = docs.filter((d) => d.type === "ability").sort((a, b) => (a.label || "").localeCompare(b.label || ""));

console.log(JSON.stringify({ characterId: CHARACTER_ID, characterName: ch.name, count: only.length }, null, 2));
for (const a of only) {
    console.log(`- [${a.key}] ${a.label || "(sin label)"}`);
}
