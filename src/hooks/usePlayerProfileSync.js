import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { patchPlayerProfile } from "../store/playerSlice";

/** Keep roster / role / active character in sync so token control updates live. */
export function usePlayerProfileSync() {
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);

    useEffect(() => {
        if (!uid) return undefined;
        return onSnapshot(doc(db, "players", uid), (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() || {};
            dispatch(patchPlayerProfile({
                nickname: data.nickname,
                role: data.role,
                campaignIds: data.campaignIds || [],
                characterIds: data.characterIds || [],
                activeCharacterId: data.activeCharacterId || null,
            }));
        }, (err) => {
            console.warn("[usePlayerProfileSync]", err?.code || err?.message || err);
        });
    }, [uid, dispatch]);
}
