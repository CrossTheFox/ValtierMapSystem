import { useState, useEffect, useMemo } from "react";
import { Grid, Box, Skeleton, Typography } from "@mui/material";
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineOppositeContent,
} from "@mui/lab";
import { useDispatch, useSelector } from "react-redux";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import AnimatedTypewriterText from "../animations/AnimatedTypewriterText";
import LandscapeIcon from "@mui/icons-material/Landscape";
import { UI_COLORS } from "../../constants/uiColors";
import { useCampaignWikiEntities } from "../../hooks/useCampaignWikiEntities";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import WikiMentionRenderer from "../wiki/WikiMentionRenderer";
import { openWikiOverlay } from "../../store/uiSlice";
import { ROLES } from "../../constants/roles";

function ArchiveImage({ imageUrl }) {
    const [url, setUrl] = useState(() => (imageUrl?.startsWith("http") ? imageUrl : getCachedUrl(imageUrl)) || null);

    useEffect(() => {
        if (url || !imageUrl) return;
        if (imageUrl.startsWith("http")) {
            setUrl(imageUrl);
            return;
        }
        loadFirebaseAsset(imageUrl).then(setUrl).catch(() => setUrl(null));
    }, [imageUrl, url]);

    if (!imageUrl) return <LandscapeIcon sx={{ fontSize: 60, color: "#3a3a4d" }} />;
    if (!url) return <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: "#121221" }} />;
    return <Box component="img" src={url} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

function VttImage({ location }) {
    const [url, setUrl] = useState(() => getCachedUrl(location?.imageUrl) || null);

    useEffect(() => {
        if (!url && location?.imageUrl) {
            loadFirebaseAsset(location.imageUrl).then(setUrl);
        }
    }, [location?.imageUrl, url]);

    if (!location?.imageUrl) return <LandscapeIcon sx={{ fontSize: 60, color: "#3a3a4d" }} />;
    if (!url) return <Skeleton variant="rectangular" width="100%" height="100%" sx={{ bgcolor: "#121221" }} />;
    return <Box component="img" src={url} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />;
}

function SourceBadge({ source }) {
    return (
        <Box
            sx={{
                display: "inline-block",
                mb: 1.5,
                fontFamily: "'Fira Code', monospace",
                fontSize: "9px",
                letterSpacing: "0.12em",
                px: 1,
                py: 0.35,
                borderRadius: 0.5,
                border: `1px solid ${source === "archive" ? UI_COLORS.anomaly : UI_COLORS.border}`,
                color: source === "archive" ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                bgcolor: source === "archive" ? `${UI_COLORS.anomaly}10` : "transparent",
            }}
        >
            FUENTE: {source === "archive" ? "ARCHIVO" : "VTT"}
        </Box>
    );
}

function TimelineSection({ historyEvents }) {
    if (!historyEvents.length) {
        return (
            <Typography sx={{ color: "gray", textAlign: "center", py: 4 }}>
                No historical data packets found in memory banks.
            </Typography>
        );
    }

    return (
        <Timeline position="alternate">
            {historyEvents.map((event, index) => (
                <TimelineItem key={index}>
                    <TimelineOppositeContent sx={{ m: "auto 0", color: UI_COLORS.accent, fontWeight: "bold", fontFamily: "Orbitron, sans-serif" }}>
                        {event.date}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                        <TimelineConnector sx={{ bgcolor: UI_COLORS.accent }} />
                        <TimelineDot sx={{
                            borderColor: UI_COLORS.accent,
                            borderWidth: 2,
                            boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                            backgroundColor: "#000",
                            margin: "12px 0",
                        }} />
                        <TimelineConnector sx={{ bgcolor: UI_COLORS.accent }} />
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: "12px", px: 2 }}>
                        <Typography variant="subtitle1" component="div" sx={{ color: UI_COLORS.accent, fontWeight: "bold", mb: 0.5 }}>
                            {event.event}
                        </Typography>
                        <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", lineHeight: 1.2 }}>
                            {event.description}
                        </Typography>
                    </TimelineContent>
                </TimelineItem>
            ))}
        </Timeline>
    );
}

export default function LocationHistoryDescriptionTab({ location, campaignId }) {
    const dispatch = useDispatch();
    const isDM = useSelector((s) => s.player.profile?.role) === ROLES.DM;
    const wikiEntities = useCampaignWikiEntities(campaignId);

    const wikiEntity = useMemo(() => {
        if (!location?.id) return null;
        return wikiEntities.find(
            (e) => e.entityType === WIKI_ENTITY_TYPES.LOCACION && e.linkedVttLocationId === location.id
        ) || null;
    }, [wikiEntities, location?.id]);

    const historyEvents = Array.isArray(location?.history) ? location.history : [];
    const hasArchive = !!wikiEntity;

    const handleEntityClick = (entityId) => {
        if (!isDM || !entityId) return;
        dispatch(openWikiOverlay({ mode: "detail", entityId }));
    };

    const imageBoxSx = {
        width: "100%",
        height: "250px",
        backgroundColor: "#1a1a2a",
        borderRadius: "8px",
        border: `1px solid ${UI_COLORS.accent}44`,
        boxShadow: `0 0 20px ${UI_COLORS.accentGlow}33`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    };

    return (
        <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, overflow: "auto" }}>
            <SourceBadge source={hasArchive ? "archive" : "vtt"} />

            <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <CyberTitle variant="h5" sx={{ mb: 2, color: UI_COLORS.accent, fontSize: "clamp(13px, 1vw, 16px)" }}>
                        {hasArchive ? "ARCHIVO_NARRATIVO" : "SYSTEM_LOG: DESCRIPTION"}
                    </CyberTitle>

                    {hasArchive ? (
                        <Box sx={{ fontSize: "14px", lineHeight: 1.7, color: "#ccc" }}>
                            {wikiEntity.summary && (
                                <Box sx={{ mb: 2, fontStyle: "italic", color: "rgba(255,255,255,0.75)" }}>
                                    <WikiMentionRenderer
                                        body={wikiEntity.summary}
                                        entities={wikiEntities}
                                        onEntityClick={handleEntityClick}
                                    />
                                </Box>
                            )}
                            <WikiMentionRenderer
                                body={wikiEntity.body || ""}
                                entities={wikiEntities}
                                onEntityClick={handleEntityClick}
                            />
                            {!wikiEntity.body && !wikiEntity.summary && (
                                <CyberText sx={{ color: UI_COLORS.textSecondary }}>Sin contenido en el archivo.</CyberText>
                            )}
                        </Box>
                    ) : (
                        <AnimatedTypewriterText
                            text={location?.description || "No description available."}
                            duration={3000}
                        />
                    )}
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Box sx={imageBoxSx}>
                        {hasArchive
                            ? <ArchiveImage imageUrl={wikiEntity.imageUrl} />
                            : <VttImage location={location} />}
                    </Box>
                </Grid>

                {(historyEvents.length > 0 || !hasArchive) && (
                    <Grid size={{ xs: 12 }}>
                        <Box sx={{ mt: 2, pt: 3, borderTop: `1px solid ${UI_COLORS.accent}22` }}>
                            <CyberTitle variant="h6" sx={{ mb: 4, color: UI_COLORS.accent, textAlign: "center", fontSize: "clamp(13px, 1vw, 16px)" }}>
                                HISTORICAL_TIMELINE_STREAMS
                            </CyberTitle>
                            <TimelineSection historyEvents={historyEvents} />
                        </Box>
                    </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                    <Box sx={{ mt: 2, pt: 3, borderTop: `1px solid ${UI_COLORS.accent}22` }}>
                        <CyberTitle variant="h6" sx={{ mb: 2, color: UI_COLORS.accent, textAlign: "center", fontSize: "clamp(13px, 1vw, 16px)" }}>
                            REGISTRO_DE_VISITAS
                        </CyberTitle>
                        <Typography sx={{ color: "gray", textAlign: "center", py: 2, fontSize: "0.85rem", lineHeight: 1.5 }}>
                            [Función pendiente] Registro de visitas de la party.
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
}
