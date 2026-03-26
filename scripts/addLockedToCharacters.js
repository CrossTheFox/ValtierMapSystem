import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const serviceAccount = JSON.parse(
    fs.readFileSync("./valtier-map-system-firebase-admins.json", "utf8")
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function addLockedToCharacters() {
    console.log("🗄️ Accediendo a la colección 'characters'...");
    
    try {
        const snapshot = await db.collection("characters").get();
        
        if (snapshot.empty) {
            console.log("⚠️ No hay personajes para actualizar.");
            return;
        }

        const batch = db.batch();
        
        snapshot.forEach(doc => {
            const docRef = db.collection("characters").doc(doc.id);
            // Agregamos los campos isLocked y unlockGoal
            batch.update(docRef, {
                isLocked: false,
                unlockGoal: ""
            });
        });

        await batch.commit();
        console.log(`✅ ¡Éxito! Se actualizaron ${snapshot.size} personajes con los nuevos estados.`);
    } catch (error) {
        console.error("❌ Error en la migración:", error);
    } finally {
        process.exit();
    }
}

addLockedToCharacters();