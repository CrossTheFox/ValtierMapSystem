import { useState, useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Box,
    CircularProgress,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { uploadCharacterImage } from "../../../firebase/services/assetLoader";
import { ensureNarrativeEntityForCharacter } from "../../../firebase/services/wikiVttLinkService";
import { updateWikiEntity } from "../../../firebase/services/wikiEntityService";
import { updateCharacterInList } from "../../store/characterSlice";
import { openWikiOverlay, showSnackbar } from "../../store/uiSlice";
import { saveWikiEntity, startWikiSync } from "../../store/wikiSlice";
import { VttToWikiLinkBadge } from "../wiki/VttWikiLinkBadge";
import WikiImageUpload from "../wiki/WikiImageUpload";
import TokenImageCropEditor from "./TokenImageCropEditor";
import { TOKEN_SIZE_OPTIONS } from "../../utils/gridMath";
import { DEFAULT_TOKEN_CROP, normalizeTokenCrop } from "../../utils/tokenImageFit";
import { isDmRole } from "../../utils/tokenControl";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

const TXT_MUTED = { color: "rgba(255,255,255,0.55)" };
const NAR_ACCENT = UI_COLORS.accentStrong;
const AUTOSAVE_MS = 650;

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.88rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${NAR_ACCENT}66` },
        "&.Mui-focused fieldset": { borderColor: NAR_ACCENT },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
};

function BioSectionLabel({ children }) {
    return (
        <CyberText
            sx={{
                fontFamily: "monospace",
                fontSize: "0.58rem",
                letterSpacing: "0.14em",
                color: UI_COLORS.anomaly,
                mb: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
                "&::after": {
                    content: '""',
                    flex: 1,
                    height: "1px",
                    bgcolor: UI_COLORS.border,
                },
            }}
        >
            {children}
        </CyberText>
    );
}

/**
 * Identity tab: token chrome + canonical narrative bio (wiki summary/body).
 * VTT `character.bio` is legacy — migrated once into the wiki PERSONAJE ficha.
 */
export default function CharBioTab({ character }) {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const isDM = isDmRole(profile?.role);
    const uid = profile?.uid || null;
    const campaignId = useSelector(
        (s) => s.world.selectedCampaignId || character?.campaignId || profile?.currentCampaignId
    );
    const wikiSyncActive = useSelector((s) => s.wiki.syncActive);
    const wikiLoadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);

    const [tokenImageUrl, setTokenImageUrl] = useState(character?.tokenImageUrl || null);
    const [tokenSize, setTokenSize] = useState(character?.tokenSize || "normal");
    const [tokenCrop, setTokenCrop] = useState(() => normalizeTokenCrop(character?.tokenCrop));
    const [saveState, setSaveState] = useState("idle");
    const [narrativeLoading, setNarrativeLoading] = useState(true);
    const [narrativeEntity, setNarrativeEntity] = useState(null);
    const [summary, setSummary] = useState("");
    const [body, setBody] = useState("");

    const cropDebounceRef = useRef(null);
    const bioTimerRef = useRef(null);
    const draftRef = useRef({ summary: "", body: "" });
    const lastSavedRef = useRef({ summary: "", body: "" });
    const entityIdRef = useRef(null);

    const characterId = character?.id;

    useEffect(() => {
        setTokenImageUrl(character?.tokenImageUrl || null);
        setTokenSize(character?.tokenSize || "normal");
        setTokenCrop(normalizeTokenCrop(character?.tokenCrop));
    }, [character?.id, character?.tokenImageUrl, character?.tokenSize, character?.tokenCrop]);

    // Keep wiki sync warm so Lab IA / NAR see edits from Identidad.
    useEffect(() => {
        if (!campaignId || !uid) return;
        if (wikiSyncActive && wikiLoadedCampaignId === campaignId) return;
        dispatch(startWikiSync({ campaignId, role: isDM ? "dm" : "player" }));
    }, [campaignId, uid, wikiSyncActive, wikiLoadedCampaignId, isDM, dispatch]);

    useEffect(() => {
        let cancelled = false;
        async function boot() {
            if (!campaignId || !character?.id || !uid) {
                setNarrativeLoading(false);
                setNarrativeEntity(null);
                return;
            }
            setNarrativeLoading(true);
            try {
                const ent = await ensureNarrativeEntityForCharacter(campaignId, character, uid);
                if (cancelled) return;
                entityIdRef.current = ent.id;
                setNarrativeEntity(ent);
                const nextSummary = ent.summary || "";
                const nextBody = ent.body || "";
                setSummary(nextSummary);
                setBody(nextBody);
                draftRef.current = { summary: nextSummary, body: nextBody };
                lastSavedRef.current = { summary: nextSummary, body: nextBody };
                if (character.narrativeEntityId !== ent.id) {
                    dispatch(updateCharacterInList({
                        id: character.id,
                        data: { narrativeEntityId: ent.id },
                    }));
                }
            } catch (err) {
                console.error("[CharBioTab] ensure narrative failed", err);
                if (!cancelled) {
                    dispatch(showSnackbar({
                        message: "No se pudo abrir la biografía narrativa",
                        severity: "error",
                    }));
                }
            } finally {
                if (!cancelled) setNarrativeLoading(false);
            }
        }
        boot();
        return () => {
            cancelled = true;
            if (bioTimerRef.current) clearTimeout(bioTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-boot on character/campaign
    }, [campaignId, character?.id, uid]);

    const persistTokenFields = useCallback(
        async (partial) => {
            if (!characterId) return;
            setSaveState("saving");
            try {
                await updateCharacterFields(characterId, partial);
                dispatch(updateCharacterInList({ id: characterId, data: partial }));
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 2000);
            } catch {
                setSaveState("error");
            }
        },
        [characterId, dispatch]
    );

    const handleTokenImageChange = useCallback(
        (url) => {
            setTokenImageUrl(url);
            const crop = { ...DEFAULT_TOKEN_CROP };
            setTokenCrop(crop);
            persistTokenFields({ tokenImageUrl: url || null, tokenCrop: crop });
        },
        [persistTokenFields]
    );

    const handleTokenUpload = useCallback(
        async (file) => uploadCharacterImage(characterId, file),
        [characterId]
    );

    const handleTokenSizeChange = (_e, value) => {
        if (!value) return;
        setTokenSize(value);
        persistTokenFields({ tokenSize: value });
    };

    const handleTokenCropChange = useCallback(
        (next) => {
            const crop = normalizeTokenCrop(next);
            setTokenCrop(crop);
            setSaveState("pending");
            if (cropDebounceRef.current) clearTimeout(cropDebounceRef.current);
            cropDebounceRef.current = setTimeout(() => {
                persistTokenFields({ tokenCrop: crop });
            }, 400);
        },
        [persistTokenFields]
    );

    useEffect(() => () => {
        if (cropDebounceRef.current) clearTimeout(cropDebounceRef.current);
    }, []);

    const persistNarrative = useCallback(async () => {
        const entityId = entityIdRef.current;
        if (!campaignId || !entityId || !uid) return;
        const d = draftRef.current;
        const prev = lastSavedRef.current;
        if (d.summary === prev.summary && d.body === prev.body) return;

        setSaveState("saving");
        try {
            if (wikiSyncActive && wikiLoadedCampaignId === campaignId) {
                await dispatch(saveWikiEntity({
                    campaignId,
                    entityId,
                    uid,
                    data: { summary: d.summary || "", body: d.body || "" },
                })).unwrap();
            } else {
                await updateWikiEntity(
                    campaignId,
                    entityId,
                    { summary: d.summary || "", body: d.body || "" },
                    uid
                );
            }
            lastSavedRef.current = { summary: d.summary || "", body: d.body || "" };
            setNarrativeEntity((prevEnt) => (prevEnt
                ? { ...prevEnt, summary: d.summary || "", body: d.body || "" }
                : prevEnt));
            setSaveState("saved");
            setTimeout(() => setSaveState("idle"), 2000);
        } catch (err) {
            console.error("[CharBioTab] save narrative bio", err);
            setSaveState("error");
            dispatch(showSnackbar({
                message: "No se pudo guardar la biografía narrativa",
                severity: "error",
            }));
        }
    }, [campaignId, uid, wikiSyncActive, wikiLoadedCampaignId, dispatch]);

    const scheduleNarrativeSave = useCallback(() => {
        setSaveState("pending");
        if (bioTimerRef.current) clearTimeout(bioTimerRef.current);
        bioTimerRef.current = setTimeout(() => {
            persistNarrative();
        }, AUTOSAVE_MS);
    }, [persistNarrative]);

    const patchNarrative = useCallback((partial) => {
        draftRef.current = {
            summary: partial.summary !== undefined ? partial.summary : draftRef.current.summary,
            body: partial.body !== undefined ? partial.body : draftRef.current.body,
        };
        if (partial.summary !== undefined) setSummary(partial.summary);
        if (partial.body !== undefined) setBody(partial.body);
        scheduleNarrativeSave();
    }, [scheduleNarrativeSave]);

    const flushNarrativeSave = useCallback(() => {
        if (bioTimerRef.current) {
            clearTimeout(bioTimerRef.current);
            bioTimerRef.current = null;
        }
        persistNarrative();
    }, [persistNarrative]);

    const handleOpenArchive = () => {
        if (!narrativeEntity?.id) return;
        dispatch(
            openWikiOverlay({
                mode: "detail",
                entityId: narrativeEntity.id,
                vttContext: { linkedVttCharacterId: character?.id },
            })
        );
    };

    return (
        <Box
            sx={{
                p: { xs: 2, sm: 3 },
                maxWidth: 900,
                mx: "auto",
                width: "100%",
                maxHeight: "100%",
                overflow: "auto",
                ...CYBER_SCROLL_STYLE,
            }}
        >
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5, minHeight: 18 }}>
                {saveState === "saving" && <CircularProgress size={14} sx={{ color: UI_COLORS.accent }} />}
                {saveState === "saved" && (
                    <CyberText sx={{ fontSize: "0.58rem", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>GUARDADO</CyberText>
                )}
                {saveState === "error" && (
                    <CyberText sx={{ fontSize: "0.58rem", color: "#ff4d4d", letterSpacing: "0.1em" }}>ERROR AL GUARDAR</CyberText>
                )}
            </Box>

            <BioSectionLabel>TOKEN DE MAPA</BioSectionLabel>
            <Box
                sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 2,
                    mb: 3,
                    alignItems: "flex-start",
                }}
            >
                <WikiImageUpload
                    value={tokenImageUrl}
                    fallbackPath={character?.imageUrl || null}
                    fallbackSource="vtt_character"
                    onChange={handleTokenImageChange}
                    uploadImage={handleTokenUpload}
                    label="Imagen del token"
                    helperText="Si no subes una, se usa el retrato del personaje (cover centrado, sin estirar)."
                    variant="portrait"
                />
                <Box sx={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 2 }}>
                    <Box>
                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary, mb: 1, letterSpacing: 0.5 }}>
                            Tamaño base
                        </CyberText>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={tokenSize}
                            onChange={handleTokenSizeChange}
                            sx={{
                                flexWrap: "wrap",
                                "& .MuiToggleButton-root": {
                                    color: UI_COLORS.textSecondary,
                                    borderColor: UI_COLORS.border,
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.58rem",
                                    letterSpacing: 1,
                                    px: 1.25,
                                    "&.Mui-selected": {
                                        color: UI_COLORS.anomaly,
                                        bgcolor: `${UI_COLORS.anomaly}18`,
                                        borderColor: `${UI_COLORS.anomaly}66`,
                                    },
                                },
                            }}
                        >
                            {TOKEN_SIZE_OPTIONS.map((opt) => (
                                <ToggleButton key={opt.id} value={opt.id}>
                                    {opt.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                        <CyberText sx={{ ...TXT_MUTED, fontSize: "0.7rem", mt: 1, lineHeight: 1.45 }}>
                            Small ½ celda · Normal 1 · Large 2 · Huge 3. El DM puede sobreescribir el tamaño en sesión.
                        </CyberText>
                    </Box>
                    <TokenImageCropEditor
                        imagePath={tokenImageUrl || character?.imageUrl || null}
                        crop={tokenCrop}
                        onChange={handleTokenCropChange}
                    />
                </Box>
            </Box>

            <BioSectionLabel>BIOGRAFÍA NARRATIVA (CANÓNICA)</BioSectionLabel>
            <CyberText sx={{ ...TXT_MUTED, fontSize: "0.72rem", mb: 1.25, lineHeight: 1.45 }}>
                Misma ficha que NAR → FICHA. La IA usa este resumen y biografía.
            </CyberText>

            {narrativeLoading ? (
                <Box sx={{ display: "grid", placeItems: "center", minHeight: 120, mb: 3 }}>
                    <CircularProgress size={22} sx={{ color: NAR_ACCENT }} />
                </Box>
            ) : !narrativeEntity ? (
                <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem", lineHeight: 1.5, mb: 3 }}>
                    No hay ficha narrativa vinculada. Abrí la pestaña NAR para crearla.
                </CyberText>
            ) : (
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.25 }}>
                        <CyberTitle sx={{ fontSize: "0.7rem", letterSpacing: "0.1em", color: NAR_ACCENT }}>
                            {narrativeEntity.title || character?.name || "Personaje"}
                        </CyberTitle>
                        <VttToWikiLinkBadge wikiEntity={narrativeEntity} compact />
                        {isDM && (
                            <Box
                                component="button"
                                type="button"
                                onClick={handleOpenArchive}
                                sx={{
                                    ml: "auto",
                                    px: 1.25,
                                    py: 0.55,
                                    borderRadius: 0.5,
                                    border: `1px solid ${UI_COLORS.anomaly}66`,
                                    bgcolor: `${UI_COLORS.anomaly}12`,
                                    color: UI_COLORS.anomaly,
                                    fontFamily: "monospace",
                                    fontSize: "0.58rem",
                                    letterSpacing: "0.08em",
                                    cursor: "pointer",
                                    "&:hover": { bgcolor: `${UI_COLORS.anomaly}22` },
                                }}
                            >
                                Abrir en Archive →
                            </Box>
                        )}
                    </Box>
                    <TextField
                        fullWidth
                        size="small"
                        label="Resumen"
                        value={summary}
                        onChange={(e) => patchNarrative({ summary: e.target.value })}
                        onBlur={flushNarrativeSave}
                        sx={{ ...fieldSx, mb: 1.25 }}
                        inputProps={{ maxLength: 280 }}
                        helperText={`${summary.length}/280`}
                        FormHelperTextProps={{ sx: { color: UI_COLORS.textSecondary } }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        minRows={6}
                        label="Biografía / lore"
                        value={body}
                        onChange={(e) => patchNarrative({ body: e.target.value })}
                        onBlur={flushNarrativeSave}
                        sx={fieldSx}
                    />
                </Box>
            )}
        </Box>
    );
}
