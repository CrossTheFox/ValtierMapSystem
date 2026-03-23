import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

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