import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// 1. Cargar credenciales de Firebase
const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const SYSTEM_ID = "RfY23gcG7No5HcGddo1j"; // Tu ID de sistema actual

async function importLocationHistory() {
    const rawData = fs.readFileSync("./scripts/histories.txt", "utf8");
    const locationsArray = JSON.parse(rawData);

    const batch = db.batch();

    locationsArray.forEach(location => {
        const docRef = db.collection("locations").doc(location.locationKey);

        batch.update(docRef, {
            history: location.history,
        });
    });

    await batch.commit();
    console.log("✅ Historia de locaciones importada correctamente.");
    process.exit();
}

importLocationHistory().catch(err => {
    console.error("Error importando historia de locaciones:", err);
    process.exit(1);
});