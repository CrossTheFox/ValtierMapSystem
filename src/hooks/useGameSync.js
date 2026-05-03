import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    getOrCreateGameSession,
    subscribeToGameSession,
} from "../../firebase/services/gameService";
import { setPartyPositions } from "../store/gameSlice";

export function useGameSync() {
    const dispatch   = useDispatch();
    const campaignId = useSelector((s) => s.world.selectedCampaignId);

    useEffect(() => {
        if (!campaignId) return;

        // Ensure the document exists before subscribing
        getOrCreateGameSession(campaignId).catch(console.error);

        const unsub = subscribeToGameSession(campaignId, (data) => {
            dispatch(setPartyPositions(data.partyPositions ?? {}));
        });

        return unsub;
    }, [campaignId, dispatch]);
}
