import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from "firebase/firestore";

export const getLoreByCampaign = async (campaignId) => {
    const loreRef = collection(db, "encyclopedia");
    const q = query(
        loreRef, 
        where("campaignId", "==", campaignId),
        orderBy("category", "asc")
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createLoreEntry = async (campaignId, loreData) => {
    const loreRef = collection(db, "encyclopedia");

    const newEntry = {
        campaignId,
        title: loreData.title,
        category: loreData.category || "General",
        summary: loreData.summary || "",
        content: loreData.content, // Soporta Markdown
        imageUrl: loreData.imageUrl || "",
        audioUrl: loreData.audioUrl || "",
        isLocked: loreData.isLocked || false,
        unlockGoal: loreData.isLocked ? loreData.unlockGoal : "",
        created_at: serverTimestamp(),
        // Agregamos metadata útil para el frontend
        updated_at: serverTimestamp()
    };

    const docRef = await addDoc(loreRef, newEntry);
    return { id: docRef.id, ...newEntry };
};