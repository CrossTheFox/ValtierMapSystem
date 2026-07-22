import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { Box, CircularProgress, ToggleButton, ToggleButtonGroup } from "@mui/material";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { uploadCharacterImage } from "../../../firebase/services/assetLoader";
import { updateCharacterInList } from "../../store/characterSlice";
import { openWikiOverlay } from "../../store/uiSlice";
import { VttToWikiLinkBadge } from "../wiki/VttWikiLinkBadge";
import WikiImageUpload from "../wiki/WikiImageUpload";
import TokenImageCropEditor from "./TokenImageCropEditor";
import { TOKEN_SIZE_OPTIONS } from "../../utils/gridMath";
import { DEFAULT_TOKEN_CROP, normalizeTokenCrop } from "../../utils/tokenImageFit";

const TXT_MUTED = { color: "rgba(255,255,255,0.55)" };

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

export default function CharBioTab({ character, wikiEntities = [] }) {
    const dispatch = useDispatch();
    const [bio, setBio] = useState(character?.bio || "");
    const [tokenImageUrl, setTokenImageUrl] = useState(character?.tokenImageUrl || null);
    const [tokenSize, setTokenSize] = useState(character?.tokenSize || "normal");
    const [tokenCrop, setTokenCrop] = useState(() => normalizeTokenCrop(character?.tokenCrop));
    const [saveState, setSaveState] = useState("idle");
    const debounceRef = useRef(null);
    const cropDebounceRef = useRef(null);
    const lastSavedRef = useRef(character?.bio || "");

    const characterId = character?.id;

    const wikiEntity = useMemo(
        () => wikiEntities.find((e) => e.linkedVttCharacterId === characterId) || null,
        [wikiEntities, characterId]
    );

    useEffect(() => {
        const next = character?.bio || "";
        setBio(next);
        lastSavedRef.current = next;
        setTokenImageUrl(character?.tokenImageUrl || null);
        setTokenSize(character?.tokenSize || "normal");
        setTokenCrop(normalizeTokenCrop(character?.tokenCrop));
        setSaveState("idle");
    }, [character?.id, character?.bio, character?.tokenImageUrl, character?.tokenSize, character?.tokenCrop]);

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

    const persistBio = useCallback(
        async (value) => {
            if (!characterId || value === lastSavedRef.current) return;
            setSaveState("saving");
            try {
                await updateCharacterFields(characterId, { bio: value });
                dispatch(updateCharacterInList({ id: characterId, data: { bio: value } }));
                lastSavedRef.current = value;
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 2000);
            } catch {
                setSaveState("error");
            }
        },
        [characterId, dispatch]
    );

    const handleBioChange = (e) => {
        const value = e.target.value;
        setBio(value);
        setSaveState("pending");
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => persistBio(value), 600);
    };

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    const handleOpenArchive = () => {
        if (!wikiEntity?.id) return;
        dispatch(
            openWikiOverlay({
                mode: "detail",
                entityId: wikiEntity.id,
                vttContext: { linkedVttCharacterId: character?.id },
            })
        );
    };

    const summary = wikiEntity?.summary || wikiEntity?.body?.slice(0, 280) || "";

    return (
        <Box
            sx={{
                p: { xs: 2, sm: 3 },
                maxWidth: 900,
                mx: "auto",
                width: "100%",
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

            <BioSectionLabel>BIO DEL PERSONAJE (EDITABLE)</BioSectionLabel>
            <Box
                component="textarea"
                value={bio}
                onChange={handleBioChange}
                placeholder="Describe aquí la historia, motivaciones y background de tu personaje..."
                sx={{
                    width: "100%",
                    minHeight: 140,
                    p: 1.75,
                    resize: "vertical",
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.border}`,
                    borderRadius: 1,
                    color: UI_COLORS.textPrimary,
                    fontFamily: "Fira Sans, sans-serif",
                    fontSize: "0.88rem",
                    lineHeight: 1.6,
                    outline: "none",
                    mb: 3,
                    "&:focus": {
                        borderColor: UI_COLORS.accent,
                        boxShadow: `0 0 10px ${UI_COLORS.accent}26`,
                    },
                }}
            />

            <BioSectionLabel>FICHA NARRATIVA (CODEX)</BioSectionLabel>
            {wikiEntity ? (
                <Box
                    sx={{
                        bgcolor: UI_COLORS.backgroundSecondary,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 1,
                        borderLeft: `3px solid ${UI_COLORS.anomaly}`,
                        p: 2,
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
                        <CyberTitle sx={{ fontSize: "0.75rem", letterSpacing: "0.1em", color: UI_COLORS.accent }}>
                            {`${wikiEntity.title || character?.name} · Codex`}
                        </CyberTitle>
                        <VttToWikiLinkBadge wikiEntity={wikiEntity} compact />
                    </Box>
                    {summary && (
                        <CyberText sx={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, mb: 1.5 }}>
                            {summary}
                            {wikiEntity.body && wikiEntity.body.length > 280 ? "…" : ""}
                        </CyberText>
                    )}
                    <Box
                        component="button"
                        type="button"
                        onClick={handleOpenArchive}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.75,
                            px: 1.75,
                            py: 1,
                            borderRadius: 0.5,
                            border: `1px solid ${UI_COLORS.anomaly}`,
                            bgcolor: `${UI_COLORS.anomaly}14`,
                            color: UI_COLORS.anomaly,
                            fontFamily: "monospace",
                            fontSize: "0.62rem",
                            letterSpacing: "0.08em",
                            cursor: "pointer",
                            "&:hover": { bgcolor: `${UI_COLORS.anomaly}22` },
                        }}
                    >
                        Abrir en Narrative Archive →
                    </Box>
                </Box>
            ) : (
                <CyberText sx={{ ...TXT_MUTED, fontSize: "0.85rem", lineHeight: 1.5 }}>
                    Este personaje no tiene ficha vinculada en el Narrative Archive.
                </CyberText>
            )}
        </Box>
    );
}
