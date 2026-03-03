import { db } from "../firebase/firebaseConfig";
import { collection, addDoc, getDocs } from "firebase/firestore";

export async function testFirestore() {
    try {
        // Crear documento
        await addDoc(collection(db, "test_collection"), {
            name: "Test Player",
            createdAt: new Date()
        });

        // Leer documentos
        const snapshot = await getDocs(collection(db, "test_collection"));

        console.log("🔥 Firestore funcionando");
        console.log("Cantidad documentos:", snapshot.size);

    } catch (error) {
        console.error("❌ Error:", error);
    }
}
