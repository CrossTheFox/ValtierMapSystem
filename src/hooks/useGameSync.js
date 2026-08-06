import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    getOrCreateGameSession,
    subscribeToGameSession,
    normalizeInitiative,
} from "../../firebase/services/gameService";
import { setGameSession } from "../store/gameSlice";

export function useGameSync() {
    const dispatch   = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);

    useEffect(() => {
        if (!campaignId) return;

        getOrCreateGameSession(campaignId).catch(console.error);

        const unsub = subscribeToGameSession(campaignId, (data) => {
            dispatch(setGameSession({
                partyPositions: data.partyPositions ?? {},
                tokenPositions: data.tokenPositions ?? {},
                activeMapId: data.activeMapId ?? null,
                rulers: data.rulers ?? {},
                drawings: data.drawings ?? {},
                pings: data.pings ?? {},
                sessionPools: data.sessionPools ?? {},
                initiative: normalizeInitiative(data.initiative),
            }));
        });

        return unsub;
    }, [campaignId, dispatch]);
}
