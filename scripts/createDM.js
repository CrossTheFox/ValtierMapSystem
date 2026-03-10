import admin from "firebase-admin";
import fs from "fs";
// from .env import DM_USER_UID
import dotenv from "dotenv";
dotenv.config();

const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// PON AQUÍ TU UID REAL
const DM_UID = process.env.DM_USER_UID;

async function createDM() {
    await db.collection("players").doc(DM_UID).set({
        uid: DM_UID,
        nickname: "EnvyTheDm",
        role: "dm",
        campaignIds: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("✅ DM creado correctamente");
}

createDM();