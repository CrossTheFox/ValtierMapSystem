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
const CAMPAIGN_ID = "RfY23gcG7No5HcGddo1j"; // Tu UUID real

const statsDefinition = [
    { key: "sneak", label: "Sigilo", description: "Moverse con sigilo y silencio." },
    { key: "traverse", label: "Travesía", description: "Escalar, nadar, saltar, volar." },
    { key: "sense", label: "Sentido", description: "Escanear y evaluar un área." },
    { key: "study", label: "Estudio", description: "Analizar detalles e investigar." },
    { key: "charm", label: "Encanto", description: "Influir con carisma o diplomacia." },
    { key: "command", label: "Mando", description: "Liderar o intimidar." },
    { key: "tinker", label: "Ingenio", description: "Tecnología o alquimia." },
    { key: "excel", label: "Excelencia", description: "Precisión y equilibrio extremo." },
    { key: "smash", label: "Impacto", description: "Fuerza física o mágica bruta." },
    { key: "endure", label: "Resistencia", description: "Soportar dolor o entornos hostiles." }
];

// Función para generar stats aleatorios del 0 al 5
const generateRandomStats = () => {
    const stats = {};
    statsDefinition.forEach(s => {
        stats[s.key] = Math.floor(Math.random() * 6); // 0 a 5
    });
    return stats;
};

async function updateExistingCampaign() {
    try {
        console.log(`📡 Accediendo a la campaña: ${CAMPAIGN_ID}...`);

        // 1. Asegurar que el sistema de stats existe para esta campaña
        const systemRef = db.collection("stat_systems").doc(`system_${CAMPAIGN_ID}`);
        await systemRef.set({
            campaignId: CAMPAIGN_ID,
            systemName: "Valtier Core System",
            stats: statsDefinition,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log("✅ Sistema de estadísticas sincronizado.");

        // 2. Obtener todos los personajes de esta campaña
        const charSnapshot = await db.collection("characters")
            .where("campaignId", "==", CAMPAIGN_ID)
            .get();

        if (charSnapshot.empty) {
            console.log("⚠️ No se encontraron personajes para esta campaña.");
            return;
        }

        console.log(`🎲 Randomizando stats para ${charSnapshot.size} personajes...`);

        const batch = db.batch();

        charSnapshot.forEach(doc => {
            const charRef = db.collection("characters").doc(doc.id);
            batch.update(charRef, {
                stats: generateRandomStats(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log("✨ ¡Stats actualizados correctamente en todos los personajes!");

    } catch (error) {
        console.error("❌ Error en el script:", error);
    } finally {
        process.exit();
    }
}

updateExistingCampaign();