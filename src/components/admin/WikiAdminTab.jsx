import { useMemo } from "react";
import { Box, Button, Grid } from "@mui/material";
import { useDispatch } from "react-redux";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import HubIcon from "@mui/icons-material/Hub";
import SettingsIcon from "@mui/icons-material/Settings";
import { db } from "../../../firebase/firebaseConfig";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { WIKI_AREA_IDS } from "../../constants/wiki";
import { useCampaignWikiEntities } from "../../hooks/useCampaignWikiEntities";
import { openWikiOverlay, openNeuralLabOverlay, restoreDialog } from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import AdminSectionShell from "./AdminSectionShell";

function StatCard({ label, value, hint }) {
    return (
        <Box
            sx={{
                p: 1.25,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                bgcolor: UI_COLORS.backgroundPrimary,
                minHeight: 72,
            }}
        >
            <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, letterSpacing: 1, textTransform: "uppercase" }}>
                {label}
            </CyberText>
            <CyberTitle sx={{ fontSize: "1.1rem", color: UI_COLORS.accent, mt: 0.5, lineHeight: 1 }}>
                {value}
            </CyberTitle>
            {hint && (
                <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.textSecondary, mt: 0.35 }}>{hint}</CyberText>
            )}
        </Box>
    );
}

export default function WikiAdminTab({ campaignId, onOpenAiConfig }) {
    const dispatch = useDispatch();
    const wikiEntities = useCampaignWikiEntities(campaignId);
    const [characters, setCharacters] = useState([]);
    const [locations, setLocations] = useState([]);

    useEffect(() => {
        if (!campaignId) return undefined;
        const qChar = query(collection(db, "characters"), where("campaignId", "==", campaignId));
        const unsubC = onSnapshot(qChar, (snap) => {
            setCharacters(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsubC();
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) return undefined;
        let locUnsub = null;
        const unsubMaps = onSnapshot(
            query(collection(db, "maps"), where("campaignId", "==", campaignId)),
            (snap) => {
                if (locUnsub) locUnsub();
                const mapIds = snap.docs.map((d) => d.id);
                if (!mapIds.length) {
                    setLocations([]);
                    return;
                }
                locUnsub = onSnapshot(
                    query(collection(db, "locations"), where("mapId", "in", mapIds)),
                    (s) => setLocations(s.docs.map((d) => ({ id: d.id, ...d.data() })))
                );
            }
        );
        return () => {
            unsubMaps();
            if (locUnsub) locUnsub();
        };
    }, [campaignId]);

    const stats = useMemo(() => {
        const byType = {};
        for (const e of wikiEntities) {
            byType[e.entityType] = (byType[e.entityType] || 0) + 1;
        }
        const lockedCronica = wikiEntities.filter(
            (e) => e.entityType === WIKI_ENTITY_TYPES.CRONICA && e.customFields?.cronica?.isLocked
        ).length;
        const charsNoWiki = characters.filter((c) => !c.wikiPersonajeEntityId).length;
        const locsNoWiki = locations.filter((l) => !l.wikiLocacionEntityId).length;
        return {
            total: wikiEntities.length,
            byType,
            lockedCronica,
            charsNoWiki,
            locsNoWiki,
        };
    }, [wikiEntities, characters, locations]);

    const openArchive = (areaId) => {
        dispatch(restoreDialog(DIALOG_IDS.WIKI));
        dispatch(openWikiOverlay({ mode: "list", areaFilter: areaId }));
    };

    const openNeuralLab = () => {
        dispatch(openNeuralLabOverlay());
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
            <AdminSectionShell
                title="ESTADO DEL ARCHIVO"
                hint="Resumen narrativo de la campaña activa. La edición de fichas vive en el Narrative Archive."
            >
                <Grid container spacing={1.25}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="Fichas wiki" value={stats.total} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="Crónicas bloqueadas" value={stats.lockedCronica} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="PJ sin vínculo wiki" value={stats.charsNoWiki} hint="Personajes VTT" />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="Loc. sin wiki" value={stats.locsNoWiki} hint="Marcadores VTT" />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="Personajes lore" value={stats.byType[WIKI_ENTITY_TYPES.PERSONAJE] || 0} />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                        <StatCard label="Organizaciones" value={stats.byType[WIKI_ENTITY_TYPES.ORGANIZACION] || 0} />
                    </Grid>
                </Grid>
            </AdminSectionShell>

            <AdminSectionShell title="ATAJOS" hint="Abre superficies del archivo narrativo sin salir del VTT.">
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    <Button
                        size="small"
                        startIcon={<MenuBookIcon />}
                        onClick={() => openArchive(WIKI_AREA_IDS.CODEX)}
                        sx={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.62rem",
                            color: UI_COLORS.accent,
                            border: `1px solid ${UI_COLORS.accent}55`,
                            "&:hover": { bgcolor: `${UI_COLORS.accent}12` },
                        }}
                    >
                        ABRIR CODEX
                    </Button>
                    <Button
                        size="small"
                        startIcon={<HubIcon />}
                        onClick={openNeuralLab}
                        sx={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.62rem",
                            color: UI_COLORS.anomaly,
                            border: `1px solid ${UI_COLORS.anomaly}55`,
                            "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                        }}
                    >
                        NEURAL LAB
                    </Button>
                    <Button
                        size="small"
                        startIcon={<SettingsIcon />}
                        onClick={onOpenAiConfig}
                        sx={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.62rem",
                            color: UI_COLORS.textPrimary,
                            border: `1px solid ${UI_COLORS.border}`,
                            "&:hover": { borderColor: UI_COLORS.anomaly },
                        }}
                    >
                        CONFIG IA
                    </Button>
                </Box>
                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 1, lineHeight: 1.45 }}>
                    El formulario CREATE_LORE fue sustituido por el Archive: crea crónicas y entidades desde CODEX o CHRONICLE.
                </CyberText>
            </AdminSectionShell>
        </Box>
    );
}
