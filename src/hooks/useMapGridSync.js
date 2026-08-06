import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { applyMapGridConfig } from "../store/worldSlice";
import { normalizeMapGridConfig } from "../constants/gridConfig";

/** Keep shared per-map grid rules in sync for all clients on the active map. */
export function useMapGridSync() {
    const dispatch = useDispatch();
    const mapId = useSelector((s) => s.world.activeMapId ?? s.world.map?.id);

    useEffect(() => {
        if (!mapId) return undefined;
        const unsub = onSnapshot(doc(db, "maps", mapId), (snap) => {
            if (!snap.exists()) return;
            const gridConfig = normalizeMapGridConfig(snap.data()?.gridConfig);
            dispatch(applyMapGridConfig(gridConfig));
        }, (err) => {
            console.warn("[useMapGridSync]", err?.code || err?.message || err);
        });
        return unsub;
    }, [mapId, dispatch]);
}
