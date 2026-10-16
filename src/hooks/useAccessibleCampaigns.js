import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { canAccessCampaign } from "../utils/campaignAccess";

/**
 * Campaigns the signed-in user may enter, sorted by name.
 * Waits for the player profile when possible; falls back to the auth uid.
 * Pass `refreshKey` after creating a mesa so the list reloads.
 * @returns {{ campaigns: object[], loading: boolean, error: string|null, uid: string|null }}
 */
export function useAccessibleCampaigns(refreshKey = 0) {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const profile = useSelector((s) => s.player.profile);
    const playerStatus = useSelector((s) => s.player.status);
    const authUid = getAuth().currentUser?.uid || null;
    const uid = profile?.uid || authUid;
    const profileCampaignIds = profile?.campaignIds;
    const campaignIdsKey = useMemo(
        () => (Array.isArray(profileCampaignIds) ? profileCampaignIds.join("|") : ""),
        [profileCampaignIds],
    );

    useEffect(() => {
        if (playerStatus === "pending" || playerStatus === "idle") {
            setLoading(true);
            return undefined;
        }
        if (!uid) {
            setCampaigns([]);
            setLoading(false);
            setError(null);
            return undefined;
        }

        let cancelled = false;

        const fetchCampaigns = async () => {
            setLoading(true);
            setError(null);
            try {
                const snap = await getDocs(collection(db, "campaigns"));
                const ids = campaignIdsKey ? campaignIdsKey.split("|").filter(Boolean) : [];
                const docs = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((c) => canAccessCampaign(c, uid, ids))
                    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

                if (!cancelled) setCampaigns(docs);
            } catch (err) {
                console.error("Error fetching campaigns:", err);
                if (!cancelled) {
                    setCampaigns([]);
                    setError(err?.message || "No se pudieron cargar las misiones");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchCampaigns();
        return () => {
            cancelled = true;
        };
    }, [uid, campaignIdsKey, playerStatus, refreshKey]);

    const waitingProfile = playerStatus === "pending" || playerStatus === "idle";
    return { campaigns, loading: loading || waitingProfile, error, uid };
}
