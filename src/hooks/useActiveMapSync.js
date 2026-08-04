import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { switchMap } from "../store/worldSlice";
import { ROLES } from "../constants/roles";

/** Sync non-GM clients to the DM's active map from Firestore game doc. */
export function useActiveMapSync() {
    const dispatch = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const role = useSelector((s) => s.player.profile?.role);
    const activeMapId = useSelector((s) => s.world.activeMapId);
    const gameActiveMapId = useSelector((s) => s.game.activeMapId);

    useEffect(() => {
        if (!campaignId || role === ROLES.DM || role === "gm") return;
        if (!gameActiveMapId || gameActiveMapId === activeMapId) return;
        dispatch(switchMap({ mapId: gameActiveMapId, campaignId }));
    }, [campaignId, role, gameActiveMapId, activeMapId, dispatch]);
}
