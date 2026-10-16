import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";

import { getLore, subscribeLore } from "../../../firebase/services/loreService";
import WikiAreaNav from "./WikiAreaNav";
import LoreCodex from "./archive-codex/LoreCodex";
import LoreTimeline from "./archive-timeline/LoreTimeline";
import ArchiveDiary from "./archive-diary/ArchiveDiary";
import CampaignNeuralLabOverlay from "./CampaignNeuralLabOverlay";
import { ArchiveBrand } from "./ArchiveChrome";
import ArchiveExitMenu from "./ArchiveExitMenu";
import ArchiveLoreGear from "./ArchiveLoreGear";
import { UI_COLORS } from "../../constants/uiColors";
import { TYPO } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { WIKI_AREA_IDS } from "../../constants/wiki";
import { confirmLeaveEditorDraft } from "../../utils/editorDraftGuard";
import {
    ARCHIVE_BORDER,
    ARCHIVE_SPIN_SX,
    ARCHIVE_TOPNAV_SX,
} from "../../constants/archiveChrome";

const LIBRARY_AREAS = [
    WIKI_AREA_IDS.CODEX,
    WIKI_AREA_IDS.TIMELINE,
    WIKI_AREA_IDS.SESSIONS,
    WIKI_AREA_IDS.NEURAL_LAB,
];

function libraryArea(raw) {
    return LIBRARY_AREAS.includes(raw) ? raw : WIKI_AREA_IDS.CODEX;
}

const emptyNoteSx = {
    maxWidth: 640,
    mx: "auto",
    my: "48px",
    px: "16px",
    color: UI_COLORS.textSecondary,
    fontSize: "14px",
    lineHeight: 1.6,
};

const contractSx = {
    flex: "none",
    p: "10px 16px",
    borderBottom: `1px solid ${ARCHIVE_BORDER}`,
    background: "#0d0d14",
    fontSize: "13px",
    color: UI_COLORS.textPrimary,
    "& b": { color: UI_COLORS.anomaly, fontWeight: 600 },
};

function LibraryDiary({ campaigns }) {
    const [picked, setPicked] = useState("");
    const campaignId = campaigns.some((row) => row.id === picked) ? picked : (campaigns[0]?.id || "");

    if (!campaigns.length) {
        return (
            <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
                <Box component="p" sx={{ ...contractSx, m: 0 }}>
                    Este Lore todavía no tiene diario. El engranaje anexa una campaña y aquí aparecen sus sesiones.
                </Box>
                <Box sx={emptyNoteSx}>
                    Sin campaña anexada no hay sesiones. Cuando anexes una, el más de Sesiones crea la primera.
                </Box>
            </Box>
        );
    }

    const current = campaigns.find((row) => row.id === campaignId) || campaigns[0];
    return (
        <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
            {campaigns.length > 1 && (
                <Box sx={{ ...contractSx, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>Diario de</span>
                    <Box
                        component="select"
                        aria-label="Campaña del diario"
                        value={current.id}
                        onChange={(ev) => setPicked(ev.target.value)}
                        sx={{ color: "#fff", background: "#16161f", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "6px", padding: "4px 8px" }}
                    >
                        {campaigns.map((row) => (
                            <option key={row.id} value={row.id}>{row.name}</option>
                        ))}
                    </Box>
                </Box>
            )}
            <Box sx={{ flex: 1, minHeight: 0 }}>
                <ArchiveDiary key={current.id} campaignId={current.id} />
            </Box>
        </Box>
    );
}

function LibraryNeural({ loreId, onCreate, focusId = null }) {
    return (
        <Box sx={{ display: "flex", height: "100%", minHeight: 0, minWidth: 0 }}>
            <CampaignNeuralLabOverlay
                key={focusId || "lab"}
                embedded
                seat="library"
                loreId={loreId}
                isolateFocus
                externalFocusId={focusId}
                onCreateEntity={onCreate}
            />
        </Box>
    );
}

function LibraryScreen({ area, loreId, campaigns, createRequest, onCreate, onOpenLab, labFocusId }) {
    if (area === WIKI_AREA_IDS.SESSIONS) return <LibraryDiary campaigns={campaigns} />;
    if (area === WIKI_AREA_IDS.TIMELINE) {
        return (
            <Box sx={{ height: "100%" }}>
                <LoreTimeline key={loreId} loreId={loreId} />
            </Box>
        );
    }
    if (area === WIKI_AREA_IDS.NEURAL_LAB) {
        return <LibraryNeural loreId={loreId} onCreate={onCreate} focusId={labFocusId} />;
    }
    return <LoreCodex loreId={loreId} onOpenLab={onOpenLab} createRequest={createRequest} />;
}

/**
 * Archive in library seat: a principal Lore opened without a table.
 * No diary, no session marks, no player toggle.
 */
export default function LibraryArchiveShell({ loreId }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const area = libraryArea(searchParams.get("areaFilter"));
    const [state, setState] = useState({ status: "loading", lore: null, error: null });
    const [campaigns, setCampaigns] = useState([]);
    const [createRequest, setCreateRequest] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getLore(loreId)
            .then((lore) => {
                if (cancelled) return;
                setState(lore
                    ? { status: "ready", lore, error: null }
                    : { status: "error", lore: null, error: "No encontramos este Lore o no es tuyo." });
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("getLore:", err);
                setState({
                    status: "error",
                    lore: null,
                    error: err?.code === "permission-denied"
                        ? "No encontramos este Lore o no es tuyo."
                        : (err?.message || "No se pudo cargar el Lore."),
                });
            });
        return () => {
            cancelled = true;
        };
    }, [loreId]);

    const loreName = state.lore?.name;
    useEffect(() => {
        const previous = document.title;
        document.title = loreName ? `◈ ARCHIVE · ${loreName}` : "◈ ARCHIVE · Biblioteca";
        return () => {
            document.title = previous;
        };
    }, [loreName]);

    useEffect(() => {
        if (!createRequest || area !== WIKI_AREA_IDS.CODEX) return undefined;
        const timer = setTimeout(() => setCreateRequest(null), 0);
        return () => clearTimeout(timer);
    }, [createRequest, area]);

    const [labFocusId, setLabFocusId] = useState(null);

    useEffect(() => {
        return subscribeLore(loreId, (lore) => {
            const rows = (Array.isArray(lore?.linked_campaigns) ? lore.linked_campaigns : [])
                .filter((row) => row?.id)
                .map((row) => ({ id: String(row.id), name: row.name || "Mesa" }));
            setCampaigns(rows);
        }, () => {});
    }, [loreId]);

    const setArea = (id, keepFocus = false) => {
        if (!confirmLeaveEditorDraft()) return;
        if (id === WIKI_AREA_IDS.NEURAL_LAB && !keepFocus) setLabFocusId(null);
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("areaFilter", id);
            return next;
        }, { replace: true });
    };

    return (
        <Box
            sx={{
                height: "100dvh",
                display: "flex",
                flexDirection: "column",
                bgcolor: UI_COLORS.backgroundPrimary,
                color: UI_COLORS.textPrimary,
                fontFamily: TYPO.body,
                fontSize: "13.5px",
                lineHeight: 1.5,
            }}
        >
            <Box component="header" sx={ARCHIVE_TOPNAV_SX}>
                <ArchiveBrand sub={loreName} />
                {state.status === "ready" && (
                    <WikiAreaNav areaFilter={area} onAreaFilterChange={setArea} showGlossaryButton={false} />
                )}
                <Box sx={{ flex: 1 }} />
                <ArchiveLoreGear loreId={loreId} linkedIds={campaigns.map((row) => row.id)} />
                <ArchiveExitMenu />
            </Box>

            <Box
                component="main"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: (area === WIKI_AREA_IDS.CODEX || area === WIKI_AREA_IDS.TIMELINE || area === WIKI_AREA_IDS.NEURAL_LAB || (area === WIKI_AREA_IDS.SESSIONS && campaigns.length > 0)) && state.status === "ready" ? "hidden" : "auto",
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {state.status === "loading" && (
                    <Box sx={emptyNoteSx}>
                        <Box component="span" sx={ARCHIVE_SPIN_SX} />
                        Cargando Lore…
                    </Box>
                )}
                {state.status === "error" && (
                    <Box sx={{ ...emptyNoteSx, color: "#ff8095" }}>{state.error}</Box>
                )}
                {state.status === "ready" && (
                    <LibraryScreen
                        area={area}
                        loreId={loreId}
                        campaigns={campaigns}
                        createRequest={area === WIKI_AREA_IDS.CODEX ? createRequest : null}
                        onCreate={(entityType) => {
                            setCreateRequest({ token: Date.now(), entityType });
                            setArea(WIKI_AREA_IDS.CODEX);
                        }}
                        labFocusId={labFocusId}
                        onOpenLab={(id) => {
                            setLabFocusId(id || null);
                            setArea(WIKI_AREA_IDS.NEURAL_LAB, true);
                        }}
                    />
                )}
            </Box>
        </Box>
    );
}
