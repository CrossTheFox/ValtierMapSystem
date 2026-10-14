import { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { subscribeTimelineView } from "../../../../firebase/services/timelineViewService";
import ArchiveTimeline from "./ArchiveTimeline";
import LoreTimeline from "./LoreTimeline";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { publishedNodeCount } from "../../../utils/timelinePublish";

function Note({ children }) {
    return (
        <Box sx={{ height: "100%", ...CYBER_SCROLL_STYLE, overflow: "auto", color: UI_COLORS.textPrimary }}>
            <Box sx={{ maxWidth: 560, mx: "auto", my: "48px", px: "16px" }}>{children}</Box>
        </Box>
    );
}

/**
 * What a player sees: the line the DM published for this mesa, read only.
 * The Lore itself stays unreadable for them (`firestore.rules`).
 */
function PublishedTimeline({ campaignId, onOpenSession }) {
    const [view, setView] = useState(undefined);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribeTimelineView(campaignId, (next) => {
            setView(next);
            setError("");
        }, (err) => {
            setView(null);
            setError(err?.code === "permission-denied"
                ? "La línea publicada todavía no tiene permiso de lectura. Falta publicar las reglas de Firestore."
                : "No se pudo leer la línea publicada.");
        });
    }, [campaignId]);

    const data = useMemo(() => (view ? {
        eras: [], arcs: [], events: [], neutrals: [], sessions: [], actas: [], links: [], mentions: [], paints: {},
        ...view,
        scopeKey: `mesa-publicada:${campaignId}`,
        canEdit: false,
    } : null), [view, campaignId]);
    const actions = useMemo(() => ({ openActa: (id) => onOpenSession?.(id) }), [onOpenSession]);

    if (view === undefined) {
        return <Note><Box component="p" sx={{ color: UI_COLORS.textSecondary }}>Leyendo la línea de la mesa…</Box></Note>;
    }
    if (error || !view || !publishedNodeCount(view)) {
        return (
            <Note>
                <Box component="p" sx={{ m: 0, fontSize: "15px", lineHeight: 1.5 }}>
                    {error || "El DM todavía no publica nada de la línea de tiempo."}
                </Box>
                {!error && (
                    <Box component="p" sx={{ color: UI_COLORS.textSecondary, fontSize: "13px", lineHeight: 1.5 }}>
                        Aquí aparecen las eras, arcos, acontecimientos y sesiones que el DM marque como visibles para la mesa.
                    </Box>
                )}
            </Note>
        );
    }
    return (
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
            <ArchiveTimeline
                data={data}
                actions={actions}
                status="ready"
                note="Solo lo que el DM publicó para esta mesa."
            />
        </Box>
    );
}

/**
 * Mesa timeline. The DM draws the linked Lore; a player reads its published projection.
 * Annex lives in the Archive bar.
 */
export default function CampaignTimeline({
    campaignId,
    campaignName,
    canEdit,
    playerView = false,
    onOpenSession,
}) {
    const [loreId, setLoreId] = useState("");
    const [linkReady, setLinkReady] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!campaignId || playerView) return undefined;
        setLinkReady(false);
        return onSnapshot(doc(db, "campaigns", campaignId), (snap) => {
            setLoreId(snap.exists() ? (snap.data().primary_lore_id || "") : "");
            setLinkReady(true);
            setError("");
        }, (err) => {
            setLinkReady(true);
            setError(err?.message || "No se pudo leer la mesa.");
        });
    }, [campaignId, playerView]);

    if (playerView) return <PublishedTimeline campaignId={campaignId} onOpenSession={onOpenSession} />;

    if (!linkReady) {
        return (
            <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: UI_COLORS.textSecondary }}>
                Leyendo el Lore de la mesa…
            </Box>
        );
    }

    if (loreId) {
        return (
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column" }}>
                <LoreTimeline
                    loreId={loreId}
                    campaignId={campaignId}
                    campaignName={campaignName}
                    canEdit={!!canEdit}
                    onOpenActa={onOpenSession}
                />
            </Box>
        );
    }

    return (
        <Note>
            <Box component="p" sx={{ m: 0, fontSize: "15px", lineHeight: 1.5 }}>
                El tiempo vive en un Lore. Esta mesa todavía no tiene uno anexado, así que la línea está vacía.
            </Box>
            <Box component="p" sx={{ color: UI_COLORS.textSecondary, fontSize: "13px", lineHeight: 1.5 }}>
                Anéxalo arriba, con un Lore tuyo. No copia los nodos y no crea sesiones. Una sesión de la mesa se anexa después, a una sesión del Lore.
            </Box>
            {error && <Box component="p" sx={{ color: "#ffb3c0" }}>{error}</Box>}
        </Note>
    );
}
