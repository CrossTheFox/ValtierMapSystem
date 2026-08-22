import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Box } from "@mui/material";
import { setSelectedCampaign, loadWorld } from "../store/worldSlice";
import { openWikiOverlay, openNeuralLabOverlay } from "../store/uiSlice";
import NarrativeWikiOverlay from "../components/wiki/NarrativeWikiOverlay";
import CampaignNeuralLabOverlay from "../components/wiki/CampaignNeuralLabOverlay";
import CyberLoader from "../components/animations/CyberLoader";
import { UI_COLORS } from "../constants/uiColors";
import { WIKI_AREA_IDS, DEFAULT_ARCHIVE_AREA, normalizeWikiAreaFilter } from "../constants/wiki";
import { CyberText } from "../components/customs/CustomTexts";

/**
 * Dedicated browser-tab page for the NARRATIVE_ARCHIVE workspace.
 * Reads campaign + optional overlay state from URL search params.
 */
export default function NarrativeArchivePage() {
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const [bootstrapped, setBootstrapped] = useState(false);
    const worldStatus = useSelector((s) => s.world.worldStatus);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);

    useEffect(() => {
        document.title = "◈ NARRATIVE ARCHIVE";
    }, []);

    useEffect(() => {
        const paramCampaignId = searchParams.get("campaignId");
        const entityId = searchParams.get("entityId");
        const rawArea = searchParams.get("areaFilter");
        const mode = searchParams.get("mode") || "list";

        if (paramCampaignId) {
            dispatch(setSelectedCampaign(paramCampaignId));
            dispatch(loadWorld(paramCampaignId));
        }

        const wantsNeuralLab = rawArea === "network" || rawArea === WIKI_AREA_IDS.NEURAL_LAB;
        const areaFilter = rawArea
            ? normalizeWikiAreaFilter(rawArea)
            : DEFAULT_ARCHIVE_AREA;

        if (wantsNeuralLab) {
            dispatch(openNeuralLabOverlay({ focusEntityId: entityId || null }));
        }

        dispatch(
            openWikiOverlay({
                mode: wantsNeuralLab ? "list" : mode,
                entityId: wantsNeuralLab ? null : (entityId ?? null),
                areaFilter,
                vttContext: null,
            })
        );

        setBootstrapped(true);
    }, [dispatch, searchParams]);

    if (!bootstrapped) return null;

    const isReady = worldStatus === "succeeded" || worldStatus === "failed";

    if (!isReady) {
        return (
            <Box
                sx={{
                    width: "100vw",
                    height: "100dvh",
                    bgcolor: UI_COLORS.backgroundPrimary,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                }}
            >
                <CyberLoader />
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.8rem" }}>
                    Cargando archivo narrativo...
                </CyberText>
            </Box>
        );
    }

    if (!campaignId) {
        return (
            <Box
                sx={{
                    width: "100vw",
                    height: "100dvh",
                    bgcolor: UI_COLORS.backgroundPrimary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 3,
                }}
            >
                <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem", textAlign: "center" }}>
                    No se pudo cargar la campaña. Vuelve al mapa e inténtalo de nuevo desde SYSTEM_SESSIONS.
                </CyberText>
            </Box>
        );
    }

    return (
        <>
            <NarrativeWikiOverlay popupMode />
            <CampaignNeuralLabOverlay />
        </>
    );
}
