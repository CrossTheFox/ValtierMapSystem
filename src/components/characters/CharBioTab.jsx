import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useDispatch } from "react-redux";
import { Box, CircularProgress } from "@mui/material";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { updateCharacterInList } from "../../store/characterSlice";
import { openWikiOverlay } from "../../store/uiSlice";

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
    const [saveState, setSaveState] = useState("idle");
    const debounceRef = useRef(null);
    const lastSavedRef = useRef(character?.bio || "");

    const wikiEntity = useMemo(
        () => wikiEntities.find((e) => e.linkedVttCharacterId === character?.id) || null,
        [wikiEntities, character?.id]
    );

    useEffect(() => {
        const next = character?.bio || "";
        setBio(next);
        lastSavedRef.current = next;
        setSaveState("idle");
    }, [character?.id, character?.bio]);

    const persistBio = useCallback(
        async (value) => {
            if (!character?.id || value === lastSavedRef.current) return;
            setSaveState("saving");
            try {
                await updateCharacterFields(character.id, { bio: value });
                dispatch(updateCharacterInList({ id: character.id, data: { bio: value } }));
                lastSavedRef.current = value;
                setSaveState("saved");
                setTimeout(() => setSaveState("idle"), 2000);
            } catch {
                setSaveState("error");
            }
        },
        [character?.id, dispatch]
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
                    <CyberTitle sx={{ fontSize: "0.75rem", letterSpacing: "0.1em", color: UI_COLORS.accent, mb: 1 }}>
                        {`${wikiEntity.title || character?.name} · Codex`}
                    </CyberTitle>
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
