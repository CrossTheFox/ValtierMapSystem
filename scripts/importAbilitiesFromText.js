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
const CHARACTER_ID = "QolP584GexvFMOpun8t6"; // ID de Oni

async function importAbilitiesFromTxt() {
    console.log("🗄️ Accediendo a la colección 'abilities'...");
    
    try {
        // 2. Leer y parsear el archivo .txt
        const rawData = fs.readFileSync("./scripts/habilidades_oni.txt", "utf8");
        const abilitiesArray = JSON.parse(rawData);

        if (!abilitiesArray.length) {
            console.log("⚠️ El archivo de habilidades está vacío.");
            return;
        }

        const batch = db.batch();
        
        // Guardamos las keys para luego pasárselas al personaje
        const abilityKeys = [];

        abilitiesArray.forEach(ability => {
            abilityKeys.push(ability.key);
            
            const docRef = db.collection("abilities").doc(ability.key);
            
            batch.set(docRef, {
                ...ability,
                systemId: SYSTEM_ID,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        // 3. Vincular habilidades al personaje
        console.log(`🔗 Vinculando ${abilityKeys.length} habilidades al personaje ${CHARACTER_ID}...`);
        const characterRef = db.collection("characters").doc(CHARACTER_ID);
        
        // Usamos arrayUnion para no sobreescribir habilidades que ya tuviera desbloqueadas
        batch.update(characterRef, {
            // unlockedAbilities: admin.firestore.FieldValue.arrayUnion(...abilityKeys)
            allAbilities: admin.firestore.FieldValue.arrayUnion(...abilityKeys),
        });

        await batch.commit();
        console.log(`✅ ¡Éxito! Se importaron/reemplazaron ${abilitiesArray.length} habilidades en Firestore.`);
        console.log(`✅ Se actualizaron las habilidades desbloqueadas del personaje Oni.`);
        
    } catch (error) {
        console.error("❌ Error en la importación:", error);
    } finally {
        process.exit();
    }
}

importAbilitiesFromTxt();