import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { 
    upsertLocationRealtime, 
    removeLocationRealtime, 
    upsertCharacterRealtime,
    removeCharacterRealtime
} from "../store/worldSlice"; // Ajusta la ruta a tu slice

// Helper para serializar (es el mismo que tienes en tu slice)
function serializeFirestore(doc) {
    const data = doc.data();
    const clean = {};
    for (const key in data) {
        const value = data[key];
        if (value?.seconds !== undefined && value?.nanoseconds !== undefined) {
            clean[key] = value.toDate().toISOString();
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

export function useWorldSync() {
    const dispatch = useDispatch();
    const campaignId = useSelector(state => state.world.selectedCampaignId);
    const mapId = useSelector(state => state.world.map?.id);

    useEffect(() => {
        // Solo escuchamos si tenemos una campaña y mapa cargados
        if (!campaignId || !mapId) return;

        console.log("Iniciando sync en tiempo real para mapa:", mapId);

        // 1. Escuchar LOCATIONS
        const locationsQuery = query(collection(db, "locations"), where("mapId", "==", mapId));
        const unsubscribeLocations = onSnapshot(locationsQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data = { id: change.doc.id, ...serializeFirestore(change.doc) };
                
                if (change.type === "added" || change.type === "modified") {
                    dispatch(upsertLocationRealtime(data));
                }
                if (change.type === "removed") {
                    dispatch(removeLocationRealtime(data.id));
                }
            });
        });

        // 2. Escuchar CHARACTERS
        const charactersQuery = query(collection(db, "characters"), where("campaignId", "==", campaignId));
        const unsubscribeCharacters = onSnapshot(charactersQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const charData = { id: change.doc.id, ...serializeFirestore(change.doc) };
                charData.stats = charData.stats || {};
                charData.bondPowers = Array.isArray(charData.bondPowers) ? charData.bondPowers : [];
                charData.bond = charData.bond ?? null;

                if (change.type === "added" || change.type === "modified") {
                    dispatch(upsertCharacterRealtime(charData));
                }
                if (change.type === "removed") {
                    // Pasamos id y locationId para saber de qué location borrarlo
                    dispatch(removeCharacterRealtime({ id: charData.id, locationId: charData.locationId }));
                }
            });
        });

        // Cleanup: Desconectarse cuando el mapa cambie o el componente se desmonte
        return () => {
            unsubscribeLocations();
            unsubscribeCharacters();
        };
    }, [campaignId, mapId, dispatch]);
}