/**
 * Dossier NAR tab — editable narrative facet (wiki PERSONAJE).
 *
 * Sub-tabs: FICHA (bio + impacts + affinity) | MISIONES | RED | NOTAS DM.
 * DM-only notes live in entityDmNotes (separate Firestore doc).
 * Bio canónica: wiki summary/body (also editable from Identidad / CharBioTab).
 *
 * BACKLOG:
 * - Cleanup misaligned PERSONAJE ↔ VTT links after manual fix.
 * - Deep-link from relation track; inject entityDmNotes into Lab IA context.
 * - Replace LocationMissionsTab (location.missions[]) with campaign missions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, TextField } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { DebouncedTextField } from "../customs/DebouncedField";
import { UI_COLORS } from "../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../constants/wikiEntityTypes";
import { getEntityMeta, mergeCustomFields } from "../../utils/wikiCustomFields";
import { isDmRole } from "../../utils/tokenControl";
import { ensureNarrativeEntityForCharacter } from "../../../firebase/services/wikiVttLinkService";
import { updateWikiEntity } from "../../../firebase/services/wikiEntityService";
import {
    getEntityDmNotes,
    setEntityDmNotes,
} from "../../../firebase/services/entityDmNotesService";
import { showSnackbar } from "../../store/uiSlice";
import {
    fetchWikiEntities,
    fetchWikiRelations,
    resetWiki,
    startWikiSync,
} from "../../store/wikiSlice";
import { useDossier } from "../CharactersSettingsDialog";
import DossierRelationTrack from "./DossierRelationTrack";
import DossierNeuralMap from "./DossierNeuralMap";
import DossierMissionsView from "./DossierMissionsView";
import DossierStructuralFacts from "./DossierStructuralFacts";
import WikiAiImpactBlocks from "../wiki/WikiAiImpactBlocks";
import WikiDateInput from "../wiki/WikiDateInput";
import WikiSearchableSelect, { entitiesToSearchOptions } from "../wiki/WikiSearchableSelect";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { updateCharacterInList } from "../../store/characterSlice";
import { updateCharacterInState } from "../../store/worldSlice";

/** True until wiki entities + relations snapshots are in for this campaign. */
function isWikiGraphLoading(wiki, campaignId) {
    if (!campaignId) return true;
    const {
        status,
        relationsStatus,
        loadedCampaignId,
    } = wiki || {};
    if (loadedCampaignId && loadedCampaignId !== campaignId) return true;
    if (status === "failed" || relationsStatus === "failed") return false;
    return status !== "succeeded" || relationsStatus !== "succeeded";
}

const AUTOSAVE_MS = 650;
const NAR_ACCENT = UI_COLORS.accentStrong;

const fieldSx = {
    "& .MuiOutlinedInput-root": {
        color: UI_COLORS.textPrimary,
        fontFamily: '"Fira Sans", sans-serif',
        fontSize: "0.82rem",
        bgcolor: "rgba(8,8,14,0.55)",
        "& fieldset": { borderColor: UI_COLORS.border },
        "&:hover fieldset": { borderColor: `${NAR_ACCENT}66` },
        "&.Mui-focused fieldset": { borderColor: NAR_ACCENT },
    },
    "& .MuiInputBase-input": { color: UI_COLORS.textPrimary },
    "& .MuiInputLabel-root": { color: UI_COLORS.textSecondary },
};

function SaveChip({ status }) {
    if (status === "idle") return null;
    const label =
        status === "pending" ? "…"
            : status === "saving" ? "GUARDANDO"
                : status === "saved" ? "GUARDADO"
                    : "ERROR";
    const color =
        status === "error" ? UI_COLORS.danger
            : status === "saved" ? UI_COLORS.boon
                : NAR_ACCENT;
    return (
        <CyberText
            sx={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: "0.55rem",
                letterSpacing: "0.14em",
                color,
                opacity: status === "pending" ? 0.7 : 1,
            }}
        >
            {label}
        </CyberText>
    );
}

function buildFichaDraft(entity) {
    const meta = getEntityMeta(entity, WIKI_ENTITY_TYPES.PERSONAJE);
    return {
        summary: entity?.summary || "",
        body: entity?.body || "",
        speciesEntityId: meta.speciesEntityId || "",
        genderPresentation: meta.genderPresentation || "",
        birthDate: meta.birthDate || "",
        reactionArchetype: meta.reactionArchetype || "",
        narrativeState: meta.narrativeState || "",
        stressResponse: meta.stressResponse || "",
        narrativeTraits: Array.isArray(meta.narrativeTraits) ? [...meta.narrativeTraits] : [],
        bondNotes: meta.bondNotes || "",
    };
}

export default function DossierNarrativeView({ character }) {
    const dispatch = useDispatch();
    const { patchDraft } = useDossier();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector(
        (s) => s.world.selectedCampaignId || character?.campaignId || profile?.currentCampaignId
    );
    const uid = profile?.uid || null;
    const isDM = isDmRole(profile?.role);
    const wikiSyncActive = useSelector((s) => s.wiki.syncActive);
    const wikiStatus = useSelector((s) => s.wiki.status);
    const wikiRelationsStatus = useSelector((s) => s.wiki.relationsStatus);
    const wikiLoadedCampaignId = useSelector((s) => s.wiki.loadedCampaignId);
    const wikiEntities = useSelector((s) => s.wiki.entities);
    const wikiRelations = useSelector((s) => s.wiki.relations);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings);
    const graphLoading = isWikiGraphLoading(
        {
            status: wikiStatus,
            relationsStatus: wikiRelationsStatus,
            loadedCampaignId: wikiLoadedCampaignId,
        },
        campaignId,
    );

    const [subTab, setSubTab] = useState("ficha"); // ficha | red | dm
    const [loading, setLoading] = useState(true);
    const [entity, setEntity] = useState(null);
    const [ficha, setFicha] = useState(() => buildFichaDraft(null));
    const [dmNotes, setDmNotes] = useState("");
    const [saveStatus, setSaveStatus] = useState("idle");
    const [dmSaveStatus, setDmSaveStatus] = useState("idle");
    const [loadError, setLoadError] = useState(null);

    const fichaTimer = useRef(null);
    const dmTimer = useRef(null);
    const entityIdRef = useRef(null);
    const fichaRef = useRef(ficha);
    const dmNotesRef = useRef(dmNotes);
    const savedClearRef = useRef(null);
    const persistFichaRef = useRef(async () => false);
    const persistDmRef = useRef(async () => false);
    const fichaDirtyRef = useRef(false);
    const dmDirtyRef = useRef(false);

    useEffect(() => { fichaRef.current = ficha; }, [ficha]);
    useEffect(() => { dmNotesRef.current = dmNotes; }, [dmNotes]);

    const liveEntity = useMemo(() => {
        if (!entity?.id) return entity;
        return (wikiEntities || []).find((e) => e.id === entity.id) || entity;
    }, [wikiEntities, entity]);

    // Players never see / mount the DM notes tab
    useEffect(() => {
        if (!isDM && subTab === "dm") setSubTab("ficha");
    }, [isDM, subTab]);

    // Keep wiki sync aligned with campaign (same pattern as NarrativeWikiOverlay).
    useEffect(() => {
        if (!campaignId) return;
        if (wikiLoadedCampaignId && wikiLoadedCampaignId !== campaignId) {
            dispatch(resetWiki());
            return;
        }
        if (wikiStatus === "failed") {
            dispatch(resetWiki());
            return;
        }
        const role = isDM ? "dm" : "player";
        if (wikiStatus === "idle" && !wikiSyncActive) {
            dispatch(startWikiSync({ campaignId, role }));
        } else if (wikiStatus === "idle" && wikiSyncActive) {
            // Listeners may exist after a soft reset — one-shot refill.
            dispatch(fetchWikiEntities({ campaignId, role }));
            dispatch(fetchWikiRelations(campaignId));
        }
    }, [
        campaignId,
        wikiLoadedCampaignId,
        wikiStatus,
        wikiSyncActive,
        isDM,
        dispatch,
    ]);

    useEffect(() => {
        let cancelled = false;
        async function boot() {
            if (!campaignId || !character?.id || !uid) {
                setLoading(false);
                setLoadError("Falta campaña o sesión.");
                return;
            }
            setLoading(true);
            setLoadError(null);
            try {
                const ent = await ensureNarrativeEntityForCharacter(campaignId, character, uid);
                if (cancelled) return;
                setEntity(ent);
                entityIdRef.current = ent.id;
                setFicha(buildFichaDraft(ent));
                if (character.narrativeEntityId !== ent.id) {
                    patchDraft?.({ narrativeEntityId: ent.id });
                }
                if (isDM) {
                    const secret = await getEntityDmNotes(campaignId, ent.id);
                    if (!cancelled) setDmNotes(secret.notes || "");
                } else {
                    setDmNotes("");
                }
            } catch (err) {
                console.error("[DossierNarrativeView] ensure failed", err);
                if (!cancelled) {
                    setLoadError(err?.message || "No se pudo abrir la ficha narrativa.");
                    dispatch(showSnackbar({
                        message: "No se pudo abrir la ficha narrativa",
                        severity: "error",
                    }));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        boot();
        return () => {
            cancelled = true;
            if (fichaTimer.current) clearTimeout(fichaTimer.current);
            if (dmTimer.current) clearTimeout(dmTimer.current);
            if (savedClearRef.current) clearTimeout(savedClearRef.current);
            if (fichaDirtyRef.current) persistFichaRef.current?.();
            if (dmDirtyRef.current) persistDmRef.current?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-ensure when character/campaign changes
    }, [campaignId, character?.id, uid, isDM]);

    const persistFicha = useCallback(async () => {
        const entityId = entityIdRef.current;
        if (!campaignId || !entityId || !uid) return false;
        const d = fichaRef.current;
        setSaveStatus("saving");
        try {
            const customFields = mergeCustomFields(
                entity?.customFields || {},
                WIKI_ENTITY_TYPES.PERSONAJE,
                {
                    speciesEntityId: d.speciesEntityId || null,
                    genderPresentation: d.genderPresentation || "",
                    birthDate: d.birthDate || "",
                    reactionArchetype: d.reactionArchetype || null,
                    narrativeState: d.narrativeState || null,
                    stressResponse: d.stressResponse || null,
                    narrativeTraits: (d.narrativeTraits || []).slice(0, 5),
                    bondNotes: d.bondNotes || "",
                }
            );
            const updated = await updateWikiEntity(campaignId, entityId, {
                summary: d.summary || "",
                body: d.body || "",
                customFields,
            }, uid);
            fichaDirtyRef.current = false;
            setEntity((prev) => ({ ...(prev || {}), ...updated, id: entityId, customFields }));

            // Keep VTT species mirror in sync when present.
            const nextSpecies = d.speciesEntityId || null;
            if (character?.id && (character.speciesEntityId || null) !== nextSpecies) {
                try {
                    await updateCharacterFields(character.id, { speciesEntityId: nextSpecies });
                    patchDraft?.({ speciesEntityId: nextSpecies });
                    dispatch(updateCharacterInList({ id: character.id, data: { speciesEntityId: nextSpecies } }));
                    dispatch(updateCharacterInState({
                        id: character.id,
                        data: { speciesEntityId: nextSpecies },
                    }));
                } catch (syncErr) {
                    console.warn("[DossierNarrativeView] species VTT sync", syncErr);
                }
            }

            setSaveStatus("saved");
            if (savedClearRef.current) clearTimeout(savedClearRef.current);
            savedClearRef.current = setTimeout(() => setSaveStatus("idle"), 1600);
            return true;
        } catch (err) {
            console.error("[DossierNarrativeView] save ficha", err);
            setSaveStatus("error");
            dispatch(showSnackbar({
                message: "No se pudo guardar la ficha narrativa",
                severity: "error",
            }));
            return false;
        }
    }, [campaignId, uid, entity?.customFields, character?.id, character?.speciesEntityId, patchDraft, dispatch]);

    const persistDmNotes = useCallback(async () => {
        const entityId = entityIdRef.current;
        if (!isDM || !campaignId || !entityId || !uid) return false;
        setDmSaveStatus("saving");
        try {
            await setEntityDmNotes(campaignId, entityId, dmNotesRef.current, uid);
            dmDirtyRef.current = false;
            setDmSaveStatus("saved");
            if (savedClearRef.current) clearTimeout(savedClearRef.current);
            savedClearRef.current = setTimeout(() => setDmSaveStatus("idle"), 1600);
            return true;
        } catch (err) {
            console.error("[DossierNarrativeView] save dm notes", err);
            setDmSaveStatus("error");
            dispatch(showSnackbar({
                message: "No se pudieron guardar las notas del DM",
                severity: "error",
            }));
            return false;
        }
    }, [isDM, campaignId, uid, dispatch]);

    useEffect(() => { persistFichaRef.current = persistFicha; }, [persistFicha]);
    useEffect(() => { persistDmRef.current = persistDmNotes; }, [persistDmNotes]);

    const scheduleFichaSave = useCallback(() => {
        fichaDirtyRef.current = true;
        setSaveStatus("pending");
        if (fichaTimer.current) clearTimeout(fichaTimer.current);
        fichaTimer.current = setTimeout(() => {
            persistFicha();
        }, AUTOSAVE_MS);
    }, [persistFicha]);

    const scheduleDmSave = useCallback(() => {
        if (!isDM) return;
        dmDirtyRef.current = true;
        setDmSaveStatus("pending");
        if (dmTimer.current) clearTimeout(dmTimer.current);
        dmTimer.current = setTimeout(() => {
            persistDmNotes();
        }, AUTOSAVE_MS);
    }, [isDM, persistDmNotes]);

    const flushFichaSave = useCallback(() => {
        if (fichaTimer.current) {
            clearTimeout(fichaTimer.current);
            persistFicha();
        }
    }, [persistFicha]);

    const patchFicha = useCallback((partial) => {
        setFicha((prev) => {
            const next = { ...prev, ...partial };
            fichaRef.current = next;
            return next;
        });
        scheduleFichaSave();
    }, [scheduleFichaSave]);

    const addTrait = useCallback((raw) => {
        const t = String(raw || "").trim();
        if (!t) return;
        setFicha((prev) => {
            const cur = Array.isArray(prev.narrativeTraits) ? prev.narrativeTraits : [];
            if (cur.includes(t) || cur.length >= 5) return prev;
            const next = { ...prev, narrativeTraits: [...cur, t] };
            fichaRef.current = next;
            return next;
        });
        scheduleFichaSave();
    }, [scheduleFichaSave]);

    const removeTrait = useCallback((t) => {
        setFicha((prev) => {
            const next = {
                ...prev,
                narrativeTraits: (prev.narrativeTraits || []).filter((x) => x !== t),
            };
            fichaRef.current = next;
            return next;
        });
        scheduleFichaSave();
    }, [scheduleFichaSave]);

    const subTabs = useMemo(() => {
        const list = [
            { id: "ficha", label: "FICHA" },
            { id: "misiones", label: "MISIONES" },
            { id: "red", label: "RED" },
        ];
        if (isDM) list.push({ id: "dm", label: "NOTAS DM" });
        return list;
    }, [isDM]);

    const saveChipStatus = subTab === "dm" ? dmSaveStatus : saveStatus;

    const speciesOptions = useMemo(
        () => entitiesToSearchOptions(wikiEntities || [], WIKI_ENTITY_TYPES.ESPECIE),
        [wikiEntities],
    );

    if (loading) {
        return (
            <Box sx={{ flex: 1, display: "grid", placeItems: "center", minHeight: 200 }}>
                <CircularProgress size={28} sx={{ color: NAR_ACCENT }} />
            </Box>
        );
    }

    if (loadError || !entity) {
        return (
            <Box sx={{ p: 3 }}>
                <CyberText sx={{ color: UI_COLORS.danger }}>
                    {loadError || "Sin ficha narrativa."}
                </CyberText>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                    bgcolor: "rgba(18,12,22,0.65)",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {subTabs.map((t) => {
                        const on = subTab === t.id;
                        const danger = t.id === "dm";
                        const tone = danger ? UI_COLORS.danger : NAR_ACCENT;
                        return (
                            <Box
                                key={t.id}
                                component="button"
                                type="button"
                                onClick={() => setSubTab(t.id)}
                                sx={{
                                    border: on ? `1px solid ${tone}88` : "1px solid transparent",
                                    bgcolor: on ? `${tone}18` : "transparent",
                                    color: on ? UI_COLORS.textPrimary : UI_COLORS.textSecondary,
                                    fontFamily: '"Orbitron", sans-serif',
                                    fontSize: "0.55rem",
                                    letterSpacing: "0.12em",
                                    px: 1.2,
                                    py: 0.55,
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    "&:hover": { color: UI_COLORS.textPrimary },
                                }}
                            >
                                {t.label}
                            </Box>
                        );
                    })}
                </Box>
                <SaveChip status={saveChipStatus} />
            </Box>

            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: subTab === "dm" ? "auto" : "hidden",
                    ...(subTab === "dm" ? CYBER_SCROLL_STYLE : {}),
                    p: subTab === "red" ? 0.75 : subTab === "misiones" ? 1.25 : 1.75,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {subTab === "ficha" && (
                    <Box
                        sx={{
                            flex: 1,
                            height: { xs: "auto", md: "100%" },
                            minHeight: 0,
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "minmax(0, 1.05fr) minmax(280px, 0.95fr)",
                            },
                            gap: 2,
                            alignItems: "stretch",
                        }}
                    >
                        <Box
                            sx={{
                                minHeight: 0,
                                overflow: "auto",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                pr: { md: 0.5 },
                                ...CYBER_SCROLL_STYLE,
                            }}
                        >
                            <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 260 }}>
                                <CyberTitle
                                    sx={{
                                        fontSize: "0.7rem",
                                        letterSpacing: "0.14em",
                                        color: NAR_ACCENT,
                                        mb: 0.75,
                                    }}
                                >
                                    BIOGRAFÍA
                                </CyberTitle>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "row",
                                        flexWrap: { xs: "wrap", sm: "nowrap" },
                                        alignItems: "center",
                                        gap: 1.25,
                                        mb: 1.25,
                                    }}
                                >
                                    <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                                        <WikiSearchableSelect
                                            label="Especie"
                                            value={ficha.speciesEntityId || ""}
                                            onChange={(v) => {
                                                patchFicha({ speciesEntityId: v || "" });
                                                flushFichaSave();
                                            }}
                                            options={speciesOptions}
                                            minWidth={0}
                                            clearLabel="— Sin especie —"
                                        />
                                    </Box>
                                    <DebouncedTextField
                                        size="small"
                                        label="Género"
                                        value={ficha.genderPresentation}
                                        onCommit={(next) => patchFicha({ genderPresentation: next })}
                                        onBlurExtra={flushFichaSave}
                                        sx={{
                                            ...fieldSx,
                                            flex: "1 1 140px",
                                            minWidth: 120,
                                        }}
                                    />
                                    <WikiDateInput
                                        compact
                                        showHint={false}
                                        value={ficha.birthDate || ""}
                                        onChange={(v) => {
                                            patchFicha({ birthDate: v || "" });
                                        }}
                                    />
                                </Box>
                                <DebouncedTextField
                                    fullWidth
                                    size="small"
                                    label="Resumen"
                                    value={ficha.summary}
                                    onCommit={(next) => patchFicha({ summary: next })}
                                    onBlurExtra={flushFichaSave}
                                    sx={{ ...fieldSx, mb: 1.25 }}
                                    inputProps={{ maxLength: 280 }}
                                />
                                <DebouncedTextField
                                    fullWidth
                                    multiline
                                    minRows={10}
                                    label="Biografía / lore"
                                    value={ficha.body}
                                    onCommit={(next) => patchFicha({ body: next })}
                                    onBlurExtra={flushFichaSave}
                                    sx={{
                                        ...fieldSx,
                                        flex: 1,
                                        "& .MuiOutlinedInput-root": {
                                            ...fieldSx["& .MuiOutlinedInput-root"],
                                            height: "100%",
                                            alignItems: "flex-start",
                                        },
                                    }}
                                />
                            </Box>
                            <WikiAiImpactBlocks entity={liveEntity} canManage={isDM} />
                        </Box>

                        <Box
                            sx={{
                                minHeight: { xs: 320, md: 0 },
                                height: { md: "100%" },
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                                minWidth: 0,
                            }}
                        >
                            <DossierStructuralFacts
                                entityId={entity.id}
                                campaignId={campaignId}
                                canEdit={isDM}
                                variant="fichaStrip"
                            />
                            <Box sx={{ flex: 1, minHeight: 0 }}>
                                <DossierRelationTrack
                                    entityId={entity.id}
                                    campaignId={campaignId}
                                    canEdit={isDM}
                                />
                            </Box>
                        </Box>
                    </Box>
                )}

                {subTab === "misiones" && (
                    <DossierMissionsView
                        character={character}
                        campaignId={campaignId}
                        isDM={isDM}
                    />
                )}

                {subTab === "red" && (
                    <Box
                        sx={{
                            flex: 1,
                            height: { xs: 480, md: "100%" },
                            minHeight: 0,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <DossierNeuralMap
                            anchorEntity={liveEntity}
                            entities={wikiEntities || []}
                            relations={wikiRelations || []}
                            graphLoading={graphLoading}
                            campaignId={campaignId}
                            narrativeSettings={narrativeSettings}
                            showLab={isDM}
                            ficha={ficha}
                            patchFicha={patchFicha}
                            addTrait={addTrait}
                            removeTrait={removeTrait}
                            flushSave={flushFichaSave}
                            canEditStructural={isDM}
                        />
                    </Box>
                )}

                {subTab === "dm" && isDM && (
                    <Box sx={{ maxWidth: 920 }}>
                        <CyberTitle
                            sx={{
                                fontSize: "0.7rem",
                                letterSpacing: "0.14em",
                                color: UI_COLORS.danger,
                                mb: 0.5,
                            }}
                        >
                            NOTAS DEL DM — SECRETAS
                        </CyberTitle>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 1.25, display: "block" }}>
                            Solo el DJ puede ver o editar esto. Úsalo para reglas/recomendaciones a la IA
                            y prep del personaje que el jugador no debe conocer. No vive en la ficha pública.
                        </CyberText>
                        <TextField
                            fullWidth
                            multiline
                            minRows={12}
                            value={dmNotes}
                            onChange={(e) => {
                                const v = e.target.value;
                                setDmNotes(v);
                                dmNotesRef.current = v;
                                scheduleDmSave();
                            }}
                            onBlur={() => {
                                if (dmTimer.current) {
                                    clearTimeout(dmTimer.current);
                                    persistDmNotes();
                                }
                            }}
                            placeholder="Instrucciones secretas para la IA / arcos preparados / spoilers…"
                            sx={{
                                ...fieldSx,
                                "& .MuiOutlinedInput-root": {
                                    ...fieldSx["& .MuiOutlinedInput-root"],
                                    borderColor: `${UI_COLORS.danger}44`,
                                    "& fieldset": { borderColor: `${UI_COLORS.danger}55` },
                                    "&:hover fieldset": { borderColor: `${UI_COLORS.danger}88` },
                                    "&.Mui-focused fieldset": { borderColor: UI_COLORS.danger },
                                },
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Box>
    );
}
