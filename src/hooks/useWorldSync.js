import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import {
    upsertLocationRealtime,
    removeLocationRealtime,
    upsertCharacterRealtime,
    removeCharacterRealtime,
} from "../store/worldSlice";
import { warmCharacterAssets } from "../../firebase/services/assetLoader";
import { characterRosterKind } from "../utils/characterRosterKind";

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

    // Characters: campaign-scoped (works with empty-table / no-map campaigns like PILOTO-EVAL-IA).
    useEffect(() => {
        if (!campaignId) return;

        const onListenError = (label) => (err) => {
            console.warn(`[useWorldSync:${label}]`, err?.code || err?.message || err);
        };

        const charactersQuery = query(collection(db, "characters"), where("campaignId", "==", campaignId));
        const unsubscribeCharacters = onSnapshot(charactersQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const charData = { id: change.doc.id, ...serializeFirestore(change.doc) };
                charData.stats = charData.stats || {};
                charData.bondPowers = Array.isArray(charData.bondPowers) ? charData.bondPowers : [];
                charData.bond = charData.bond ?? null;

                if (change.type === "added" || change.type === "modified") {
                    const kind = characterRosterKind(charData);
                    if (kind === "pc") {
                        charData.type = "pc";
                        charData.isNpc = false;
                    } else {
                        charData.type = "npc";
                    }
                    dispatch(upsertCharacterRealtime(charData));
                    // Keep portrait/token cache warm when roster changes mid-session.
                    warmCharacterAssets([charData], { pixi: true });
                }
                if (change.type === "removed") {
                    dispatch(removeCharacterRealtime({ id: charData.id, locationId: charData.locationId }));
                }
            });
        }, onListenError("characters"));

        return () => {
            unsubscribeCharacters();
        };
    }, [campaignId, dispatch]);

    // Locations: map-scoped (skip when empty-table placeholder has no real map id).
    useEffect(() => {
        if (!campaignId || !mapId) return;

        console.log("Iniciando sync en tiempo real para mapa:", mapId);

        const onListenError = (label) => (err) => {
            console.warn(`[useWorldSync:${label}]`, err?.code || err?.message || err);
        };

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
        }, onListenError("locations"));

        return () => {
            unsubscribeLocations();
        };
    }, [campaignId, mapId, dispatch]);
}