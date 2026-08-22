import React, { useEffect, useMemo, useState } from "react";
import { Stack, CircularProgress } from "@mui/material";
import { collection, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedCampaign } from "../store/worldSlice";
import { CyberTitle, CyberText } from "../components/customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";

/**
 * Campaign is visible if the user is owner/member, or (legacy) listed in
 * profile.campaignIds — except owner_only / eval pilots, which require real membership.
 */
function canAccessCampaign(camp, uid, profileCampaignIds = []) {
    if (!uid || !camp) return false;

    const isOwner = camp.ownerId === uid;
    const isMember = Array.isArray(camp.playerIds) && camp.playerIds.includes(uid);
    const inProfile = Array.isArray(profileCampaignIds) && profileCampaignIds.includes(camp.id);
    const restricted = camp.access === "owner_only" || camp.isEvalPilot === true;

    // Eval / owner-only: hard membership only.
    if (restricted) return isOwner || isMember;

    // Normal table campaigns (e.g. Valtia): member, owner, or profile grant.
    return isOwner || isMember || inProfile;
}

const CampaignSelector = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const dispatch = useDispatch();

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
        // Wait for player profile when possible; fall back to auth uid.
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
    }, [uid, campaignIdsKey, playerStatus]);

    if (loading || playerStatus === "pending" || playerStatus === "idle") {
        return <CircularProgress sx={{ color: UI_COLORS.accent }} />;
    }

    return (
        <div className="login-box">
            <CyberTitle variant="h5" className="title-auth" sx={{ mb: 4, textAlign: "center" }}>
                SELECT_MISSION_FILE
            </CyberTitle>

            <Stack spacing={2.5}>
                {error && (
                    <CyberText sx={{ textAlign: "center", color: "#ff4d4d", opacity: 0.9 }}>
                        {error}
                    </CyberText>
                )}
                {campaigns.length === 0 && !error && (
                    <CyberText sx={{ textAlign: "center", opacity: 0.6 }}>
                        Sin misiones asignadas a este operador.
                    </CyberText>
                )}
                {campaigns.map((camp) => (
                    <button
                        key={camp.id}
                        className="submit-btn"
                        type="button"
                        onClick={() => dispatch(setSelectedCampaign({ id: camp.id, name: camp.name }))}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "15px 20px",
                            display: "flex",
                            flexDirection: "column",
                            height: "auto",
                        }}
                    >
                        <span /><span /><span /><span />
                        <CyberTitle sx={{ fontSize: "1.1rem", mb: 0.5 }}>
                            {camp.name?.toUpperCase() || "UNKNOWN_DATA"}
                        </CyberTitle>
                        <CyberText variant="caption" sx={{ opacity: 0.5, letterSpacing: "2px" }}>
                            REF_ID: {camp.id.substring(0, 12).toUpperCase()}
                        </CyberText>
                    </button>
                ))}
            </Stack>
        </div>
    );
};

export default CampaignSelector;
