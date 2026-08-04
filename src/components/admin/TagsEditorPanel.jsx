import { useMemo, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useDispatch } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import { CyberButton } from "../customs/CyberInputs";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { TAG_CATEGORIES, TAG_CATEGORY_LIST } from "../../constants/abilityKinds";
import { DEFAULT_RULE_SYSTEM } from "../../constants/ruleSystems";
import { useCampaignTags } from "../../hooks/useCampaignTags";
import { upsertTagDoc, updateTagFields, deleteTagDoc } from "../../../firebase/services/tagService";
import { showSnackbar } from "../../store/uiSlice";

const C = {
    pink: UI_COLORS.accent,
    cyan: UI_COLORS.anomaly,
    border: UI_COLORS.border,
    text: UI_COLORS.textPrimary,
    muted: UI_COLORS.textSecondary,
    danger: UI_COLORS.accentStrong,
};

const CATEGORY_ACCENT = {
    [TAG_CATEGORIES.ATTACK]: C.pink,
    [TAG_CATEGORIES.STATUS]: C.danger,
    [TAG_CATEGORIES.EFFECT]: C.cyan,
    [TAG_CATEGORIES.TRAIT]: "#ffcc33",
    [TAG_CATEGORIES.OTHER]: C.muted,
};

const emptyDraft = () => ({
    key: "",
    label: "",
    category: TAG_CATEGORIES.OTHER,
    summary: "",
    description: "",
    aliasesText: "",
});

const fieldInputSx = {
    width: "100%",
    boxSizing: "border-box",
    m: 0,
    p: "8px 10px",
    resize: "vertical",
    background: "rgba(0,0,0,0.45)",
    border: `1px solid ${C.pink}55`,
    borderRadius: "4px",
    color: C.text,
    fontFamily: '"Fira Sans", sans-serif',
    fontSize: "0.9rem",
    lineHeight: 1.45,
    outline: "none",
    transition: "border-color 0.18s, box-shadow 0.18s",
    "&:focus": {
        borderColor: C.pink,
        boxShadow: `0 0 12px ${UI_COLORS.accentGlow}`,
    },
    "&::placeholder": { color: "rgba(255,255,255,0.35)", opacity: 1 },
};

function MetaCell({ label, children, accent = C.cyan }) {
    return (
        <Box
            sx={{
                p: "10px 12px",
                borderRadius: "8px",
                border: `1px solid ${C.border}`,
                bgcolor: "rgba(0,0,0,0.28)",
                minWidth: 0,
                transition: "border-color 0.18s, box-shadow 0.18s",
                "&:hover": {
                    borderColor: `${accent}66`,
                    boxShadow: `0 0 14px ${accent}14`,
                },
            }}
        >
            <Box
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.52rem",
                    letterSpacing: "0.12em",
                    color: C.muted,
                    mb: "6px",
                }}
            >
                {label}
            </Box>
            {children}
        </Box>
    );
}

function TagDetailCard({ children, selected = true }) {
    return (
        <Box
            className={`dossier-narr-card${selected ? " is-selected" : ""}`}
            sx={{
                position: "relative",
                p: "14px 16px",
                border: `1px solid ${selected ? C.cyan : C.border}`,
                borderRadius: "8px",
                bgcolor: "rgba(0,0,0,0.28)",
                boxShadow: selected ? "0 0 18px rgba(0,242,234,0.10)" : "none",
                transition: "border-color 0.18s, box-shadow 0.18s, transform 0.15s",
                "&:hover": { borderColor: "rgba(255,102,255,0.4)", transform: "translateY(-1px)" },
            }}
        >
            <div className="dossier-brackets" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <span className="tl" /><span className="tr" /><span className="bl" /><span className="br" />
            </div>
            {children}
        </Box>
    );
}

/**
 * Master/detail editor for combat tags (ICON core + campaign custom).
 */
export default function TagsEditorPanel({ campaignId, rulesSystem = DEFAULT_RULE_SYSTEM }) {
    const dispatch = useDispatch();
    const { tags, loading } = useCampaignTags(campaignId, rulesSystem);
    const [selectedId, setSelectedId] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [draft, setDraft] = useState(emptyDraft);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState("");

    const selected = useMemo(
        () => tags.find((t) => t.id === selectedId) || null,
        [tags, selectedId],
    );

    const isCore = !isNew && selected?.campaignId == null;
    const catAccent = CATEGORY_ACCENT[draft.category] || C.cyan;

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return tags;
        return tags.filter((t) =>
            [t.label, t.key, t.category, t.summary].some((s) =>
                String(s || "").toLowerCase().includes(q),
            ),
        );
    }, [tags, filter]);

    const aliasChips = useMemo(
        () =>
            String(draft.aliasesText || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
        [draft.aliasesText],
    );

    const loadTag = (tag) => {
        setIsNew(false);
        setSelectedId(tag.id);
        setDraft({
            key: tag.key || "",
            label: tag.label || "",
            category: tag.category || TAG_CATEGORIES.OTHER,
            summary: tag.summary || "",
            description: tag.description || "",
            aliasesText: (tag.aliases || []).join(", "),
        });
    };

    const handleNewCustom = () => {
        setIsNew(true);
        setSelectedId(null);
        setDraft(emptyDraft());
    };

    const parseAliases = (text) =>
        String(text || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

    const handleSave = async () => {
        if (!draft.label.trim()) {
            dispatch(showSnackbar({ message: "Label requerido", severity: "warning" }));
            return;
        }
        setSaving(true);
        try {
            if (isNew) {
                if (!campaignId) {
                    dispatch(showSnackbar({ message: "Sin campaña para tag custom", severity: "error" }));
                    return;
                }
                const id = await upsertTagDoc({
                    key: draft.key || draft.label,
                    label: draft.label,
                    rulesSystem,
                    campaignId,
                    category: draft.category,
                    summary: draft.summary,
                    description: draft.description,
                    aliases: parseAliases(draft.aliasesText),
                });
                setIsNew(false);
                setSelectedId(id);
                dispatch(showSnackbar({ message: "Tag custom creado", severity: "success" }));
            } else if (selected) {
                await updateTagFields(selected.id, {
                    label: draft.label,
                    category: draft.category,
                    summary: draft.summary,
                    description: draft.description,
                    aliases: parseAliases(draft.aliasesText),
                });
                dispatch(showSnackbar({ message: "Tag guardado", severity: "success" }));
            }
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al guardar tag", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selected || selected.campaignId == null) {
            dispatch(showSnackbar({
                message: "Los tags CORE no se eliminan desde aquí (usa custom)",
                severity: "info",
            }));
            return;
        }
        setSaving(true);
        try {
            await deleteTagDoc(selected.id);
            setSelectedId(null);
            setDraft(emptyDraft());
            dispatch(showSnackbar({ message: "Tag eliminado", severity: "success" }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "Error al eliminar", severity: "error" }));
        } finally {
            setSaving(false);
        }
    };

    if (!campaignId) {
        return <CyberText sx={{ color: UI_COLORS.textSecondary }}>Sin campaña activa.</CyberText>;
    }

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                minHeight: 0,
                gap: 0,
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: 1,
                overflow: "hidden",
            }}
        >
            {/* ── Master list ───────────────────────────────────────── */}
            <Box
                sx={{
                    width: 260,
                    flexShrink: 0,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    bgcolor: `${UI_COLORS.backgroundPrimary}aa`,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                }}
            >
                <Box
                    sx={{
                        p: 1.25,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                    }}
                >
                    <CyberTitle sx={{ fontSize: "0.65rem", color: UI_COLORS.anomaly, letterSpacing: "0.1em" }}>
                        TAGS · {String(rulesSystem).toUpperCase()}
                    </CyberTitle>
                    <Box
                        component="button"
                        type="button"
                        onClick={handleNewCustom}
                        title="Nuevo tag de campaña"
                        sx={{
                            border: `1px solid ${UI_COLORS.accent}66`,
                            bgcolor: `${UI_COLORS.accent}14`,
                            color: UI_COLORS.accent,
                            borderRadius: 0.5,
                            width: 28,
                            height: 28,
                            display: "grid",
                            placeItems: "center",
                            cursor: "pointer",
                            p: 0,
                            transition: "box-shadow 0.18s, border-color 0.18s",
                            "&:hover": {
                                borderColor: UI_COLORS.accent,
                                boxShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                            },
                        }}
                    >
                        <AddIcon sx={{ fontSize: "1rem" }} />
                    </Box>
                </Box>
                <Box sx={{ px: 1, pt: 1 }}>
                    <Box
                        component="input"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filtrar…"
                        sx={{
                            width: "100%",
                            boxSizing: "border-box",
                            px: 1,
                            py: 0.6,
                            mb: 1,
                            fontFamily: "'Fira Sans', sans-serif",
                            fontSize: "0.72rem",
                            color: UI_COLORS.textPrimary,
                            bgcolor: "rgba(0,0,0,0.4)",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: 0.5,
                            outline: "none",
                            "&:focus": { borderColor: UI_COLORS.accent },
                        }}
                    />
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1, ...CYBER_SCROLL_STYLE }}>
                    {loading ? (
                        <CircularProgress size={18} sx={{ color: UI_COLORS.accent, m: 1 }} />
                    ) : filtered.length === 0 ? (
                        <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, p: 1 }}>
                            Sin tags. Ejecuta seed:icon-tags o crea un custom.
                        </CyberText>
                    ) : (
                        filtered.map((t) => {
                            const rowCore = t.campaignId == null;
                            const active = selectedId === t.id && !isNew;
                            const rowAccent = CATEGORY_ACCENT[t.category] || C.cyan;
                            return (
                                <Box
                                    key={t.id}
                                    onClick={() => loadTag(t)}
                                    sx={{
                                        px: 1,
                                        py: 0.75,
                                        mb: 0.35,
                                        borderRadius: 0.5,
                                        cursor: "pointer",
                                        border: `1px solid ${active ? rowAccent : UI_COLORS.border}`,
                                        bgcolor: active ? `${rowAccent}12` : "transparent",
                                        borderLeft: `3px solid ${active ? rowAccent : "transparent"}`,
                                        transition: "border-color 0.15s, background 0.15s, transform 0.12s",
                                        "&:hover": {
                                            bgcolor: "rgba(255,255,255,0.04)",
                                            transform: "translateX(2px)",
                                        },
                                    }}
                                >
                                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 0.5 }}>
                                        <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textPrimary, fontWeight: 600 }}>
                                            {t.label}
                                        </CyberText>
                                        <CyberText
                                            sx={{
                                                fontSize: "0.48rem",
                                                color: rowCore ? UI_COLORS.anomaly : UI_COLORS.accent,
                                                fontFamily: "'Fira Code', monospace",
                                                letterSpacing: "0.06em",
                                            }}
                                        >
                                            {rowCore ? "CORE" : "CUSTOM"}
                                        </CyberText>
                                    </Box>
                                    <CyberText sx={{ fontSize: "0.52rem", color: UI_COLORS.textSecondary }}>
                                        {t.category} · {t.key}
                                    </CyberText>
                                </Box>
                            );
                        })
                    )}
                    {isNew && (
                        <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.accent, mt: 0.5, px: 1 }}>
                            (nuevo custom sin guardar)
                        </CyberText>
                    )}
                </Box>
            </Box>

            {/* ── Detail ────────────────────────────────────────────── */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                {!selected && !isNew ? (
                    <Box sx={{ p: 3 }}>
                        <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem" }}>
                            Selecciona un tag o crea uno custom de campaña.
                        </CyberText>
                    </Box>
                ) : (
                    <Box sx={{ flex: 1, overflowY: "auto", p: 2, ...CYBER_SCROLL_STYLE }}>
                        {/* Identity header */}
                        <TagDetailCard>
                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, mb: 1 }}>
                                <Box
                                    component="span"
                                    sx={{
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.62rem",
                                        letterSpacing: "0.1em",
                                        color: C.text,
                                        border: `1px solid ${isCore ? `${C.cyan}88` : `${C.pink}88`}`,
                                        bgcolor: isCore ? `${C.cyan}14` : `${C.pink}14`,
                                        px: "8px",
                                        py: "3px",
                                        borderRadius: "3px",
                                        flexShrink: 0,
                                        mt: "4px",
                                    }}
                                >
                                    {isNew ? "NEW" : isCore ? "CORE" : "CUSTOM"}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box
                                        component="input"
                                        value={draft.label}
                                        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                                        placeholder="Nombre del tag"
                                        sx={{
                                            width: "100%",
                                            boxSizing: "border-box",
                                            background: "transparent",
                                            border: "none",
                                            outline: "none",
                                            fontFamily: "Orbitron, sans-serif",
                                            fontSize: "1.15rem",
                                            letterSpacing: "0.08em",
                                            color: C.text,
                                            p: 0,
                                            "&::placeholder": { color: "rgba(255,255,255,0.3)", opacity: 1 },
                                        }}
                                    />
                                    <Box
                                        sx={{
                                            fontFamily: "'Fira Code', monospace",
                                            fontSize: "0.62rem",
                                            color: C.muted,
                                            mt: 0.35,
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        {isNew ? (
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                                <span style={{ color: C.pink }}>key</span>
                                                <Box
                                                    component="input"
                                                    value={draft.key}
                                                    onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                                                    placeholder="pierce"
                                                    sx={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        background: "rgba(0,0,0,0.35)",
                                                        border: `1px solid ${C.border}`,
                                                        borderRadius: "3px",
                                                        color: C.cyan,
                                                        fontFamily: "'Fira Code', monospace",
                                                        fontSize: "0.68rem",
                                                        px: 0.75,
                                                        py: 0.35,
                                                        outline: "none",
                                                        "&:focus": { borderColor: C.cyan },
                                                    }}
                                                />
                                            </Box>
                                        ) : (
                                            <>key · {draft.key}</>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                            <div className="dossier-trail" style={{ margin: "10px 0 12px" }} />

                            {/* Category chips */}
                            <Box
                                sx={{
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.52rem",
                                    letterSpacing: "0.12em",
                                    color: C.muted,
                                    mb: 0.75,
                                }}
                            >
                                CATEGORY
                            </Box>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.6 }}>
                                {TAG_CATEGORY_LIST.map((cat) => {
                                    const active = draft.category === cat;
                                    const accent = CATEGORY_ACCENT[cat] || C.cyan;
                                    return (
                                        <Box
                                            key={cat}
                                            component="button"
                                            type="button"
                                            onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                                            sx={{
                                                px: 1.1,
                                                py: 0.45,
                                                borderRadius: "4px",
                                                border: `1px solid ${active ? accent : C.border}`,
                                                bgcolor: active ? `${accent}18` : "transparent",
                                                color: active ? accent : C.muted,
                                                fontFamily: "Orbitron, sans-serif",
                                                fontSize: "0.58rem",
                                                letterSpacing: "0.08em",
                                                cursor: "pointer",
                                                textTransform: "uppercase",
                                                transition: "border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s",
                                                boxShadow: active ? `0 0 12px ${accent}22` : "none",
                                                "&:hover": {
                                                    borderColor: accent,
                                                    color: accent,
                                                },
                                            }}
                                        >
                                            {cat}
                                        </Box>
                                    );
                                })}
                            </Box>
                        </TagDetailCard>

                        {/* Meta + body grid */}
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                gap: 1.25,
                                mt: 1.5,
                            }}
                        >
                            <MetaCell label="SUMMARY" accent={catAccent}>
                                <Box
                                    component="textarea"
                                    value={draft.summary}
                                    onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                                    rows={3}
                                    placeholder="Resumen corto (tooltips / hotbar)"
                                    sx={{ ...fieldInputSx, minHeight: 72 }}
                                />
                            </MetaCell>

                            <MetaCell label="ALIASES" accent={C.pink}>
                                <Box
                                    component="input"
                                    value={draft.aliasesText}
                                    onChange={(e) => setDraft((d) => ({ ...d, aliasesText: e.target.value }))}
                                    placeholder="pierce, piercing, atraviesa…"
                                    sx={{ ...fieldInputSx, resize: "none" }}
                                />
                                {aliasChips.length > 0 && (
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                                        {aliasChips.map((a) => (
                                            <Box
                                                key={a}
                                                sx={{
                                                    px: "6px",
                                                    py: "2px",
                                                    borderRadius: "3px",
                                                    border: `1px solid ${C.pink}55`,
                                                    bgcolor: `${C.pink}10`,
                                                    fontFamily: "'Fira Code', monospace",
                                                    fontSize: "0.58rem",
                                                    color: C.text,
                                                    letterSpacing: "0.04em",
                                                }}
                                            >
                                                {a}
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </MetaCell>

                            <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
                                <MetaCell label="DESCRIPTION" accent={C.cyan}>
                                    <Box
                                        component="textarea"
                                        value={draft.description}
                                        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                                        rows={5}
                                        placeholder="Texto completo para reglas / wiki"
                                        sx={{ ...fieldInputSx, minHeight: 120 }}
                                    />
                                </MetaCell>
                            </Box>
                        </Box>

                        {/* Actions */}
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                flexWrap: "wrap",
                                mt: 2,
                                pt: 1.5,
                                borderTop: `1px solid ${C.border}`,
                            }}
                        >
                            <CyberButton type="button" onClick={handleSave} loading={saving}>
                                {isNew ? "CREAR" : "GUARDAR"}
                            </CyberButton>
                            {!isNew && selected?.campaignId != null && (
                                <Box
                                    component="button"
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={saving}
                                    sx={{
                                        border: `1px solid ${C.danger}88`,
                                        bgcolor: "transparent",
                                        color: C.danger,
                                        fontFamily: "'Orbitron', sans-serif",
                                        fontSize: "0.7rem",
                                        letterSpacing: "0.08em",
                                        px: 2,
                                        py: 1,
                                        cursor: "pointer",
                                        borderRadius: 0.5,
                                        transition: "background 0.15s, box-shadow 0.15s",
                                        "&:hover": {
                                            bgcolor: `${C.danger}14`,
                                            boxShadow: `0 0 12px ${C.danger}33`,
                                        },
                                    }}
                                >
                                    ELIMINAR
                                </Box>
                            )}
                            <CyberText
                                sx={{
                                    ml: "auto",
                                    fontSize: "0.58rem",
                                    color: C.muted,
                                    fontFamily: "'Fira Code', monospace",
                                }}
                            >
                                {String(rulesSystem).toUpperCase()}
                                {" · "}
                                {draft.category}
                                {draft.key ? ` · ${draft.key}` : ""}
                            </CyberText>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
