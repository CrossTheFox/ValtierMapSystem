/**
 * Fills every character in a campaign with placeholder bond / bondPowers / sheet text.
 * Does NOT write effort or strain (those are session-local in the web app).
 *
 * Usage: set CAMPAIGN_ID, ensure valtier-map-system-firebase-admins.json exists, then:
 *   node scripts/fillDummyCharacterSheet.js
 */
import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

/** @type {string} */
const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j";

const DUMMY_BOND = {
    name: "The Seeker (DUMMY)",
    archetype: "STALWART",
    description:
        "Placeholder bond: you chase forbidden knowledge. Replace with real bond text from your table.",
    specialAbility:
        "When exhausted, you get +1d on Study and Sense (placeholder — see ICON rulebook).",
    secondWind: "Regain all effort when you discover something hidden, forbidden, or secret. (DUMMY)",
    ideals: [
        "I addressed challenges with investigation or recklessness (DUMMY)",
        "I questioned my understanding of the world (DUMMY)",
    ],
    notes: "Auto-filled by fillDummyCharacterSheet.js — edit in Firebase or Campaign Settings.",
};

const DUMMY_BOND_POWERS = [
    {
        name: "Heartsight",
        frequency: "1/session",
        description:
            "DUMMY: View a distant location for a short time. Replace with your real power text.",
    },
    {
        name: "Library Organ",
        frequency: "1/session",
        description: "DUMMY: +1d to Study and Sense for one scene.",
    },
    {
        name: "Argus",
        description: "DUMMY: Knack for sensing hidden things (tiered in book).",
    },
];

async function main() {
    const snap = await db
        .collection("characters")
        .where("campaignId", "==", CAMPAIGN_ID)
        .get();

    if (snap.empty) {
        console.log("No characters for campaign:", CAMPAIGN_ID);
        process.exit(0);
    }

    const docs = snap.docs;
    let n = 0;
    const CHUNK = 400;

    for (let i = 0; i < docs.length; i += CHUNK) {
        const batch = db.batch();
        const slice = docs.slice(i, i + CHUNK);
        slice.forEach((doc) => {
            batch.update(doc.ref, {
                bond: DUMMY_BOND,
                bondPowers: DUMMY_BOND_POWERS,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            n++;
        });
        await batch.commit();
    }

    console.log(`Updated ${n} character(s) with dummy bond data (campaign ${CAMPAIGN_ID}).`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
