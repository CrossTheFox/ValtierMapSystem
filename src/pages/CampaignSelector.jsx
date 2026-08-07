import React, { useEffect, useState } from "react";
import { Stack, CircularProgress } from "@mui/material";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedCampaign } from "../store/worldSlice";
import { CyberTitle, CyberText } from "../components/customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";

/** True if the signed-in user owns or is listed on the campaign. */
function canAccessCampaign(camp, uid) {
    if (!uid || !camp) return false;
    if (camp.ownerId === uid) return true;
    if (Array.isArray(camp.playerIds) && camp.playerIds.includes(uid)) return true;
    return false;
}

const CampaignSelector = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();
    const uid = useSelector((s) => s.player.profile?.uid);
    const campaignIds = useSelector((s) => s.player.profile?.campaignIds) || [];

    useEffect(() => {
        if (!uid) {
            setCampaigns([]);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;

        const fetchCampaigns = async () => {
            setLoading(true);
            try {
                const col = collection(db, "campaigns");
                const [byPlayer, byOwner] = await Promise.all([
                    getDocs(query(col, where("playerIds", "array-contains", uid))),
                    getDocs(query(col, where("ownerId", "==", uid))),
                ]);

                const byId = new Map();
                for (const snap of [...byPlayer.docs, ...byOwner.docs]) {
                    const data = { id: snap.id, ...snap.data() };
                    if (canAccessCampaign(data, uid)) byId.set(snap.id, data);
                }

                // Legacy profile.campaignIds: fetch only missing docs (no full collection scan).
                const missing = campaignIds.filter((id) => id && !byId.has(id));
                await Promise.all(
                    missing.map(async (id) => {
                        try {
                            const snap = await getDoc(doc(db, "campaigns", id));
                            if (!snap.exists()) return;
                            const data = { id: snap.id, ...snap.data() };
                            if (canAccessCampaign(data, uid)) byId.set(snap.id, data);
                        } catch {
                            // permission-denied / missing — skip
                        }
                    }),
                );

                const docs = [...byId.values()].sort((a, b) =>
                    String(a.name || "").localeCompare(String(b.name || "")),
                );

                if (!cancelled) setCampaigns(docs);
            } catch (error) {
                console.error("Error fetching campaigns:", error);
                if (!cancelled) setCampaigns([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchCampaigns();
        return () => {
            cancelled = true;
        };
    }, [uid, campaignIds]);

    if (loading) return <CircularProgress sx={{ color: UI_COLORS.accent }} />;

    return (
        <div className="login-box">
            <CyberTitle variant="h5" className="title-auth" sx={{ mb: 4, textAlign: "center" }}>
                SELECT_MISSION_FILE
            </CyberTitle>

            <Stack spacing={2.5}>
                {campaigns.length === 0 && (
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
