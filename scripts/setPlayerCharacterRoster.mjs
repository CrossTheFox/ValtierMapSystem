/**
 * Align a player's roster in Firestore with character ownership.
 *
 * - Sets `ownerPlayerId` on each character ID in --characterIds= to the player uid.
 * - Updates `players/{uid}` with `characterIds` and optional `activeCharacterId`.
 * - With --pruneOwners: clears `ownerPlayerId` on other characters that still pointed at this uid
 *   (fixes stale assignments like Oni/Zorgun showing for the wrong player).
 *
 * Usage:
 *   node scripts/setPlayerCharacterRoster.mjs --playerUid=0Lp2Y9AMduhus8jhKVEMgMwhkP02 --characterIds=GWTUlgDn7lpaoe4hQYHb --pruneOwners
 *
 * Env: GOOGLE_APPLICATION_CREDENTIALS or ./valtier-map-system-firebase-admins.json
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const DEFAULT_SA = path.resolve(process.cwd(), "valtier-map-system-firebase-admins.json");

function parseArgs(argv) {
    const out = { playerUid: null, characterIds: [], pruneOwners: false, dryRun: false };
    for (const a of argv.slice(2)) {
        if (a === "--pruneOwners") out.pruneOwners = true;
        else if (a === "--dry-run") out.dryRun = true;
        else if (a.startsWith("--playerUid=")) out.playerUid = a.split("=")[1]?.trim();
        else if (a.startsWith("--characterIds=")) {
            const raw = a.split("=")[1] || "";
            out.characterIds = raw
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }
    return out;
}

async function main() {
    const { playerUid, characterIds, pruneOwners, dryRun } = parseArgs(process.argv);
    if (!playerUid) {
        console.error("Missing --playerUid=");
        process.exit(1);
    }
    if (!characterIds.length) {
        console.error("Missing --characterIds=id1,id2 (comma-separated)");
        process.exit(1);
    }

    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_SA;
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

    const keep = new Set(characterIds);
    const activeCharacterId = characterIds[0];

    if (dryRun) {
        console.log("[dry-run] playerUid", playerUid);
        console.log("[dry-run] characterIds", characterIds);
        console.log("[dry-run] pruneOwners", pruneOwners);
        process.exit(0);
    }

    const batch = db.batch();

    for (const cid of characterIds) {
        batch.set(
            db.collection("characters").doc(cid),
            { ownerPlayerId: playerUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
    }

    batch.set(
        db.collection("players").doc(playerUid),
        {
            characterIds,
            activeCharacterId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    if (pruneOwners) {
        const prev = await db.collection("characters").where("ownerPlayerId", "==", playerUid).get();
        prev.docs.forEach((d) => {
            if (!keep.has(d.id)) {
                batch.set(
                    d.ref,
                    { ownerPlayerId: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
                    { merge: true }
                );
            }
        });
    }

    await batch.commit();
    console.log(
        `OK: player ${playerUid} roster = [${characterIds.join(", ")}]; owners set.` +
            (pruneOwners ? " Pruned other ownerPlayerId matches." : "")
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
