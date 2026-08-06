import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, IconButton } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { useDispatch, useSelector } from "react-redux";

import { UI_COLORS } from "../../constants/uiColors";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import {
    createClaseDoc,
    linkAbilityToClase,
    listClasesForCampaign,
    updateClaseFields,
    upsertAbilityDoc,
} from "../../../firebase/services/classService";
import { callKitCardInChat } from "../../../firebase/services/chatService";
import { useCharacterJobData } from "../../hooks/useCharacterJobData";
import { useResolvedCombatStats } from "../../hooks/useResolvedCombatStats";
import { useDossier } from "../CharactersSettingsDialog";
import { showSnackbar } from "../../store/uiSlice";
import { isDmRole } from "../../utils/tokenControl";
import {
    COMBAT_STAT_KEYS,
    DAMAGE_DIE_OPTIONS,
    classResourceForArchetype,
    combatDefaultsForArchetype,
    sanitizeClassResource,
    sanitizeCombatPartial,
    sanitizeSpecialMechanic,
} from "../../constants/combatStats";
import {
    ABILITY_KINDS,
    DEFAULT_ATTACK_CONTENT,
    TRAIT_CATEGORIES,
    TRAIT_CATEGORY_LABELS,
    TRAIT_CATEGORY_LIST,
    normalizeAbilityKind,
    normalizeTraitCategory,
    sanitizeTagKeys,
} from "../../constants/abilityKinds";
import { resolveCombatStats } from "../../utils/resolveCombatStats";
import AbilityCommandToolbar from "../abilities/AbilityCommandToolbar";
import TagSearchSelect from "../admin/TagSearchSelect";
import MacroPinButton from "./MacroPinButton";
import KitMarkdown from "./KitMarkdown";
import { MACRO_SLOT_TYPES } from "../../constants/macroBar";
import { useCampaignTags } from "../../hooks/useCampaignTags";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import CyberTooltip from "../customs/CyberTooltip";

/* ── colour tokens ────────────────────────────────────────────────── */
const C = {
    border: UI_COLORS.border,
    text: "#ffffff",
    muted: "rgba(255,255,255,0.75)",
    pink: UI_COLORS.accent,
    cyan: UI_COLORS.anomaly,
    lb: "#ffcc33",
    trait: "#7dd3fc",
    danger: "#ff3355",
    glowC: "rgba(0,242,234,0.45)",
};

const MAX_LOADOUT = 6;

const STAT_META = {
    vit: { label: "VIT", accent: "#00f2ea" },
    defense: { label: "DEF", accent: "#00f2ea" },
    speed: { label: "SPD", accent: "#00f2ea" },
    fray: { label: "FRAY", accent: "#ff66ff" },
    damageDie: { label: "DIE", accent: "#ff66ff" },
    armor: { label: "ARM", accent: "#ffb020" },
    vigor: { label: "VIG", accent: "#b8ff3c" },
};

function CallChatBtn({ onClick, disabled = false }) {
    return (
        <CyberTooltip title="Llamar al chat" placement="top">
            <IconButton
                size="small"
                disabled={disabled}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.(e);
                }}
                aria-label="Llamar al chat"
                sx={{
                    width: 26,
                    height: 26,
                    color: C.cyan,
                    border: `1px solid ${C.cyan}55`,
                    bgcolor: "rgba(0,0,0,0.35)",
                    "&:hover": {
                        borderColor: C.cyan,
                        bgcolor: `${C.cyan}18`,
                    },
                    "&.Mui-disabled": { opacity: 0.35 },
                }}
            >
                <ChatBubbleOutlineIcon sx={{ fontSize: "0.9rem" }} />
            </IconButton>
        </CyberTooltip>
    );
}

const SCROLL_SX = {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    ...CYBER_SCROLL_STYLE,
};

const ABILITY_TEXTAREA_SX = {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(0,0,0,0.45)",
    border: `1px solid rgba(255,102,255,0.35)`,
    borderRadius: "4px",
    color: "#ffffff",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    p: "8px",
    resize: "vertical",
    outline: "none",
    fontFamily: '"Fira Sans", sans-serif',
    "&:focus": { borderColor: C.cyan },
    ...CYBER_SCROLL_STYLE,
};

function slugify(label) {
    return String(label || "ability")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "ability";
}

function insertAtCursor(textarea, value, insert) {
    const el = textarea;
    if (!el) return `${value || ""}${insert}`;
    const start = el.selectionStart ?? (value || "").length;
    const end = el.selectionEnd ?? start;
    const next = `${(value || "").slice(0, start)}${insert}${(value || "").slice(end)}`;
    requestAnimationFrame(() => {
        try {
            el.focus();
            const pos = start + insert.length;
            el.setSelectionRange(pos, pos);
        } catch {
            /* ignore */
        }
    });
    return next;
}

/* ── SectionLabel (ID parity) ─────────────────────────────────────── */
function SectionLabel({ children, limit, sx }) {
    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            mb: "10px",
            mt: "18px",
            fontFamily: "Orbitron, sans-serif",
            fontSize: "0.58rem",
            letterSpacing: "0.14em",
            color: "#ffffff",
            "&::after": {
                content: '""',
                flex: 1,
                height: "1px",
                background: `linear-gradient(90deg, ${C.cyan}66, transparent)`,
            },
            ...sx,
        }}>
            {children}
            {limit && (
                <Box component="span" sx={{ fontSize: "0.52rem", color: "rgba(255,255,255,0.75)", ml: 0.5 }}>
                    {limit}
                </Box>
            )}
        </Box>
    );
}

function AddRowButton({ label, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            onClick={onClick}
            sx={{
                width: "100%",
                mt: 1,
                py: 1.1,
                borderRadius: "8px",
                border: `1px dashed ${C.border}`,
                bgcolor: "transparent",
                color: C.muted,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.58rem",
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s, background-color 0.15s",
                "&:hover": {
                    borderColor: C.pink,
                    color: C.pink,
                    bgcolor: `${C.pink}10`,
                },
            }}
        >
            {label}
        </Box>
    );
}

/* ── Combat stat cell ─────────────────────────────────────────────── */
function CombatStatCell({
    statKey,
    value,
    display,
    editMode,
    isOverride,
    onChange,
}) {
    const meta = STAT_META[statKey] || { label: statKey, accent: C.cyan };
    const accent = isOverride ? C.pink : (meta.accent || C.cyan);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (!editMode) setEditing(false);
    }, [editMode]);

    const showEditor = editMode && editing;
    const shown = statKey === "damageDie" ? `d${display}` : display;

    return (
        <Box
            onClick={() => {
                if (editMode && !editing) setEditing(true);
            }}
            sx={{
                p: "10px 8px",
                borderRadius: "6px",
                border: `1px solid ${showEditor ? C.cyan : `${accent}99`}`,
                bgcolor: isOverride ? "rgba(255,102,255,0.1)" : "rgba(0,0,0,0.42)",
                textAlign: "center",
                minWidth: 0,
                cursor: editMode ? "pointer" : "default",
                boxShadow: isOverride
                    ? `0 0 14px ${C.pink}22`
                    : `inset 0 0 12px ${accent}10`,
                transition: "border-color 0.15s, box-shadow 0.15s",
            }}
        >
            <Box sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.52rem",
                letterSpacing: "0.14em",
                color: accent,
                mb: "6px",
                textShadow: `0 0 8px ${accent}44`,
            }}>
                {meta.label}
            </Box>
            {showEditor ? (
                statKey === "damageDie" ? (
                    <Box
                        component="select"
                        autoFocus
                        value={String(value ?? "")}
                        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={() => setEditing(false)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: C.text,
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            textAlign: "center",
                            cursor: "pointer",
                        }}
                    >
                        <option value="" style={{ backgroundColor: "#12121a", color: "#fff" }}>
                            heredado
                        </option>
                        {DAMAGE_DIE_OPTIONS.map((d) => (
                            <option key={d} value={d} style={{ backgroundColor: "#12121a", color: "#fff" }}>
                                d{d}
                            </option>
                        ))}
                    </Box>
                ) : (
                    <Box
                        component="input"
                        type="number"
                        autoFocus
                        value={value === "" || value == null ? "" : value}
                        placeholder={String(display)}
                        onChange={(e) => {
                            const raw = e.target.value;
                            onChange(raw === "" ? "" : Number(raw));
                        }}
                        onBlur={() => setEditing(false)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                setEditing(false);
                            }
                        }}
                        sx={{
                            width: "100%",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: C.text,
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            textAlign: "center",
                            "&::placeholder": { color: "rgba(255,255,255,0.4)", opacity: 1 },
                        }}
                    />
                )
            ) : (
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: C.text,
                    lineHeight: 1.1,
                    textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}>
                    {shown}
                </Box>
            )}
        </Box>
    );
}

/* ── Class resource (full-width row) ───────────────────────────────── */
function ClassResourceCell({
    resource,
    value,
    editMode,
    isDM,
    onChangeValue,
    onChangeMeta,
}) {
    const name = resource?.name || "CLASS RESOURCE";
    const min = resource?.min ?? 0;
    const max = resource?.max;
    const display = value ?? min;

    // Local drafts — commit meta to Firestore only on blur / Enter (not per keystroke).
    const [draftName, setDraftName] = useState(name);
    const [draftMax, setDraftMax] = useState(max == null ? "" : String(max));
    const [draftValue, setDraftValue] = useState(String(display));

    useEffect(() => {
        setDraftName(name);
    }, [name]);

    useEffect(() => {
        setDraftMax(max == null ? "" : String(max));
    }, [max]);

    useEffect(() => {
        setDraftValue(String(display));
    }, [display]);

    const commitName = () => {
        const next = String(draftName || "").trim();
        if (!next || next === name) {
            setDraftName(name);
            return;
        }
        onChangeMeta?.({ name: next });
    };

    const commitMax = () => {
        const raw = String(draftMax ?? "").trim();
        const nextMax = raw === "" ? null : Number(raw);
        const prev = max == null ? null : Number(max);
        if (raw !== "" && !Number.isFinite(nextMax)) {
            setDraftMax(max == null ? "" : String(max));
            return;
        }
        if (nextMax === prev || (nextMax == null && prev == null)) return;
        onChangeMeta?.({ max: nextMax });
    };

    const commitValue = () => {
        const n = Number(draftValue);
        if (!Number.isFinite(n)) {
            setDraftValue(String(display));
            return;
        }
        if (n === Number(display)) return;
        onChangeValue?.(n);
    };

    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                gap: 1.5,
                p: "12px 16px",
                borderRadius: "8px",
                border: `1px solid ${C.cyan}99`,
                bgcolor: "rgba(0,242,234,0.07)",
                minWidth: 0,
                boxShadow: `inset 0 0 24px ${C.cyan}10`,
                "@media (max-width:700px)": {
                    gridTemplateColumns: "1fr",
                    gap: 1,
                },
            }}
        >
            <Box sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.48rem",
                letterSpacing: "0.14em",
                color: C.cyan,
                flexShrink: 0,
            }}>
                CLASS RESOURCE
            </Box>

            {editMode && isDM ? (
                <Box
                    component="input"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                            setDraftName(name);
                            e.currentTarget.blur();
                        }
                    }}
                    placeholder="Nombre del recurso"
                    sx={{
                        minWidth: 0,
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.78rem",
                        letterSpacing: "0.08em",
                        color: C.text,
                        textTransform: "uppercase",
                    }}
                />
            ) : (
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.78rem",
                    letterSpacing: "0.08em",
                    color: C.text,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}>
                    {name}
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifySelf: "end" }}>
                {editMode ? (
                    <>
                        <Box
                            component="input"
                            type="number"
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={commitValue}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                }
                            }}
                            sx={{
                                width: 64,
                                background: "rgba(0,0,0,0.4)",
                                border: `1px solid ${C.cyan}55`,
                                borderRadius: "4px",
                                outline: "none",
                                color: C.text,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "1rem",
                                textAlign: "center",
                                p: "6px 4px",
                            }}
                        />
                        {isDM && (
                            <>
                                <Box sx={{ color: C.muted, fontFamily: "Orbitron, sans-serif", fontSize: "0.7rem" }}>/</Box>
                                <Box
                                    component="input"
                                    type="number"
                                    title="Máximo"
                                    value={draftMax}
                                    placeholder="max"
                                    onChange={(e) => setDraftMax(e.target.value)}
                                    onBlur={commitMax}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    sx={{
                                        width: 56,
                                        background: "rgba(0,0,0,0.35)",
                                        border: `1px solid ${C.border}`,
                                        borderRadius: "4px",
                                        outline: "none",
                                        color: C.muted,
                                        fontFamily: "Orbitron, sans-serif",
                                        fontSize: "0.78rem",
                                        textAlign: "center",
                                        p: "6px 4px",
                                    }}
                                />
                            </>
                        )}
                    </>
                ) : (
                    <Box sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "1.1rem",
                        color: C.text,
                        letterSpacing: "0.04em",
                    }}>
                        {display}
                        {max != null && (
                            <Box component="span" sx={{ color: C.muted, fontSize: "0.78rem", ml: 0.75 }}>
                                / {max}
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/* ── Job identity (name + description) ────────────────────────────── */
function JobIdentityPanel({
    jobName,
    description,
    editMode,
    isDM,
    onSave,
    onCall,
}) {
    const canEdit = Boolean(editMode && isDM && typeof onSave === "function");
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(jobName || "");
    const [draftDesc, setDraftDesc] = useState(description || "");

    useEffect(() => { setDraftName(jobName || ""); }, [jobName]);
    useEffect(() => { setDraftDesc(description || ""); }, [description]);
    useEffect(() => {
        if (!canEdit) setEditing(false);
    }, [canEdit]);

    const commit = () => {
        if (!canEdit) return;
        const nextName = String(draftName || "").trim();
        const nextDesc = String(draftDesc || "").trim();
        if (!nextName) {
            setDraftName(jobName || "");
            setEditing(false);
            return;
        }
        if (nextName !== (jobName || "") || nextDesc !== (description || "")) {
            onSave({ displayName: nextName, description: nextDesc });
        }
        setEditing(false);
    };

    const showEditor = canEdit && editing;

    return (
        <Box
            sx={{
                position: "relative",
                height: "100%",
                minHeight: 220,
                p: "14px 16px",
                borderRadius: "8px",
                border: `1px solid ${C.pink}66`,
                bgcolor: "rgba(255,102,255,0.05)",
                backgroundImage: `
                    linear-gradient(135deg, rgba(255,102,255,0.07) 0%, transparent 42%),
                    linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35))
                `,
                boxShadow: `inset 0 0 0 1px rgba(255,102,255,0.08), 0 0 22px rgba(255,102,255,0.06)`,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 3,
                    height: "100%",
                    background: `linear-gradient(180deg, ${C.pink}, ${C.cyan})`,
                },
            }}
        >
            <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
            }}>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.48rem",
                    letterSpacing: "0.16em",
                    color: C.pink,
                }}>
                    JOB
                </Box>
                {typeof onCall === "function" && (
                    <CallChatBtn onClick={onCall} />
                )}
            </Box>

            {showEditor ? (
                <Box
                    component="input"
                    value={draftName}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                            setDraftName(jobName || "");
                            setDraftDesc(description || "");
                            setEditing(false);
                        }
                    }}
                    placeholder="NOMBRE DEL JOB"
                    sx={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "1rem",
                        letterSpacing: "0.08em",
                        color: C.text,
                        textTransform: "uppercase",
                        p: 0,
                        "&::placeholder": { color: "rgba(255,255,255,0.3)", opacity: 1 },
                    }}
                />
            ) : (
                <Box
                    onClick={canEdit ? () => setEditing(true) : undefined}
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "1rem",
                        letterSpacing: "0.08em",
                        color: C.text,
                        lineHeight: 1.2,
                        cursor: canEdit ? "text" : "default",
                    }}
                >
                    {(jobName || "SIN JOB").toUpperCase()}
                </Box>
            )}

            <Box sx={{
                height: "1px",
                background: `linear-gradient(90deg, ${C.pink}88, transparent)`,
                flexShrink: 0,
            }} />

            {showEditor ? (
                <Box
                    component="textarea"
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    onBlur={commit}
                    rows={5}
                    placeholder="Descripción / flavor del job (Markdown)…"
                    sx={{
                        ...ABILITY_TEXTAREA_SX,
                        flex: 1,
                        minHeight: 96,
                        borderColor: `${C.pink}44`,
                        bgcolor: "rgba(0,0,0,0.28)",
                        fontSize: "0.9rem",
                        lineHeight: 1.6,
                        color: C.text,
                    }}
                />
            ) : (
                <Box
                    onClick={canEdit ? () => setEditing(true) : undefined}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        cursor: canEdit ? "text" : "default",
                        ...CYBER_SCROLL_STYLE,
                    }}
                >
                    <KitMarkdown
                        content={description}
                        emptyLabel="Sin descripción de job."
                    />
                </Box>
            )}
        </Box>
    );
}

/* ── Special mechanic (name + rules text on job) ──────────────────── */
function SpecialMechanicPanel({ mechanic, editMode, isDM, onChangeMeta, onCall }) {
    const name = mechanic?.name || "SPECIAL MECHANIC";
    const text = mechanic?.text || "";
    const canEdit = Boolean(editMode && isDM && typeof onChangeMeta === "function");
    const [editing, setEditing] = useState(false);
    const [draftName, setDraftName] = useState(name);
    const [draftText, setDraftText] = useState(text);

    useEffect(() => { setDraftName(name); }, [name]);
    useEffect(() => { setDraftText(text); }, [text]);
    useEffect(() => {
        if (!canEdit) setEditing(false);
    }, [canEdit]);

    const commit = () => {
        const next = sanitizeSpecialMechanic({ name: draftName, text: draftText });
        if (!next) {
            setDraftName(name);
            setDraftText(text);
            setEditing(false);
            return;
        }
        if (next.name !== name || next.text !== text) {
            onChangeMeta?.(next);
        }
        setEditing(false);
    };

    const empty = !text && !editing;
    const showEditor = canEdit && editing;

    return (
        <Box sx={{
            p: "14px 16px",
            borderRadius: "8px",
            border: `1px solid ${C.pink}88`,
            bgcolor: "rgba(255,102,255,0.05)",
            minWidth: 0,
            boxShadow: `inset 0 0 28px rgba(255,102,255,0.04)`,
        }}>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                mb: 1,
            }}>
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.48rem",
                    letterSpacing: "0.14em",
                    color: C.pink,
                }}>
                    SPECIAL MECHANIC
                </Box>
                {typeof onCall === "function" && !empty && (
                    <CallChatBtn onClick={onCall} />
                )}
            </Box>
            {showEditor ? (
                <>
                    <Box
                        component="input"
                        value={draftName}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commit}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget.blur();
                            } else if (e.key === "Escape") {
                                setDraftName(name);
                                setDraftText(text);
                                setEditing(false);
                            }
                        }}
                        placeholder="Nombre (ej. MOON PHASES)"
                        sx={{
                            width: "100%",
                            boxSizing: "border-box",
                            mb: 0.85,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.88rem",
                            letterSpacing: "0.08em",
                            color: C.text,
                            textTransform: "uppercase",
                        }}
                    />
                    <Box
                        component="textarea"
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        onBlur={commit}
                        rows={5}
                        placeholder="Reglas del special mechanic (Markdown)…"
                        sx={{
                            ...ABILITY_TEXTAREA_SX,
                            borderColor: `${C.pink}55`,
                            minHeight: 100,
                            color: C.text,
                            fontSize: "0.9rem",
                            lineHeight: 1.6,
                        }}
                    />
                </>
            ) : empty ? (
                <Box
                    onClick={canEdit ? () => setEditing(true) : undefined}
                    sx={{
                        fontSize: "0.85rem",
                        color: C.muted,
                        fontFamily: "'Fira Sans', sans-serif",
                        cursor: canEdit ? "text" : "default",
                    }}
                >
                    Sin special mechanic en este job.
                    {canEdit ? " Clic para editar." : ""}
                </Box>
            ) : (
                <Box
                    onClick={canEdit ? () => setEditing(true) : undefined}
                    sx={{ cursor: canEdit ? "text" : "default" }}
                >
                    <Box sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.88rem",
                        letterSpacing: "0.08em",
                        color: C.text,
                        mb: 0.75,
                    }}>
                        {name}
                    </Box>
                    <KitMarkdown content={text} />
                </Box>
            )}
        </Box>
    );
}

/* ── Tag chips / picker ───────────────────────────────────────────── */
function TagChipsRow({ tagKeys = [], color = C.cyan }) {
    if (!tagKeys?.length) return null;
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "4px", mt: "6px" }}>
            {tagKeys.map((k) => (
                <Box
                    key={k}
                    component="span"
                    sx={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.52rem",
                        letterSpacing: "0.04em",
                        color: "#ffffff",
                        border: `1px solid ${color}66`,
                        bgcolor: `${color}14`,
                        px: "5px",
                        py: "1px",
                        borderRadius: "3px",
                    }}
                >
                    {k}
                </Box>
            ))}
        </Box>
    );
}

const selectSx = {
    mb: 1,
    width: "100%",
    boxSizing: "border-box",
    bgcolor: "rgba(0,0,0,0.45)",
    border: `1px solid ${C.border}`,
    color: C.text,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: "0.78rem",
    p: "6px",
    borderRadius: "4px",
};

/* ── Editable kit card (ID-style contrast) ────────────────────────── */
function KitCard({
    tag,
    tagColor,
    title,
    text,
    editMode,
    onSave,
    showCommands = false,
    pinEntry = null,
    character = null,
    abilityKind = null,
    traitCategory = null,
    showTraitMeta = false,
    tagKeys = null,
    availableTags = null,
    onCall = null,
}) {
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(title || "");
    const [draftText, setDraftText] = useState(text || "");
    const [draftKind, setDraftKind] = useState(normalizeAbilityKind(abilityKind));
    const [draftTraitCat, setDraftTraitCat] = useState(
        normalizeTraitCategory(traitCategory),
    );
    const [draftTags, setDraftTags] = useState(() => sanitizeTagKeys(tagKeys));
    const textRef = useRef(null);
    const showAbilityMeta = abilityKind != null;
    const showTags = availableTags != null || tagKeys != null;

    useEffect(() => {
        if (!editing) {
            setDraftTitle(title || "");
            setDraftText(text || "");
            setDraftKind(normalizeAbilityKind(abilityKind));
            setDraftTraitCat(normalizeTraitCategory(traitCategory));
            setDraftTags(sanitizeTagKeys(tagKeys));
        }
    }, [title, text, editing, abilityKind, traitCategory, tagKeys]);

    return (
        <Box
            onClick={() => {
                if (editMode && !editing) setEditing(true);
            }}
            sx={{
                position: "relative",
                p: "12px 14px",
                border: `1px solid ${editing ? C.cyan : C.border}`,
                borderRadius: "8px",
                bgcolor: "rgba(0,0,0,0.28)",
                transition: "border-color 0.18s, box-shadow 0.18s",
                cursor: editMode ? "pointer" : "default",
                boxShadow: editing ? `0 0 18px rgba(0,242,234,0.12)` : "none",
                "&:hover": { borderColor: editMode ? "rgba(255,102,255,0.4)" : C.border },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "6px" }}>
                <Box component="span" sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    letterSpacing: "0.1em",
                    color: "#ffffff",
                    border: `1px solid ${tagColor ? `${tagColor}88` : "rgba(255,204,51,0.55)"}`,
                    px: "6px", py: "2px", borderRadius: "3px",
                }}>
                    {tag}
                </Box>
                {!editing && showTraitMeta && (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.5rem",
                        letterSpacing: "0.06em",
                        color: C.trait,
                        border: `1px solid ${C.trait}66`,
                        px: "5px", py: "1px", borderRadius: "3px",
                    }}>
                        {TRAIT_CATEGORY_LABELS[normalizeTraitCategory(traitCategory)] || "Simple"}
                    </Box>
                )}
                {!editing && abilityKind === ABILITY_KINDS.ATTACK && (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.55rem",
                        letterSpacing: "0.08em",
                        color: C.danger,
                        border: `1px solid ${C.danger}88`,
                        px: "5px", py: "1px", borderRadius: "3px",
                    }}>
                        ATK
                    </Box>
                )}
                {editing ? (
                    <Box
                        component="input"
                        value={draftTitle}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        sx={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.82rem",
                            letterSpacing: "0.08em",
                            color: C.text,
                        }}
                    />
                ) : (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.82rem",
                        letterSpacing: "0.1em",
                        color: C.text,
                        flex: 1,
                        minWidth: 0,
                    }}>
                        {title}
                    </Box>
                )}
                {typeof onCall === "function" && !editing && (
                    <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <CallChatBtn onClick={onCall} />
                    </Box>
                )}
                {pinEntry && character && !editing && (
                    <Box sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <MacroPinButton character={character} entry={pinEntry} size="tiny" />
                    </Box>
                )}
            </Box>
            {!editing && <TagChipsRow tagKeys={tagKeys} />}
            {editing ? (
                <Box onClick={(e) => e.stopPropagation()}>
                    {showAbilityMeta && (
                        <Box
                            component="select"
                            value={draftKind}
                            onChange={(e) => {
                                const kind = normalizeAbilityKind(e.target.value);
                                setDraftKind(kind);
                                if (kind === ABILITY_KINDS.ATTACK && !draftText.trim()) {
                                    setDraftText(DEFAULT_ATTACK_CONTENT);
                                }
                            }}
                            sx={selectSx}
                        >
                            <option value={ABILITY_KINDS.STANDARD} style={{ background: "#000" }}>Standard</option>
                            <option value={ABILITY_KINDS.ATTACK} style={{ background: "#000" }}>Attack (d20 + boons)</option>
                        </Box>
                    )}
                    {showTraitMeta && (
                        <Box
                            component="select"
                            value={draftTraitCat}
                            onChange={(e) => setDraftTraitCat(normalizeTraitCategory(e.target.value))}
                            sx={selectSx}
                        >
                            {TRAIT_CATEGORY_LIST.map((cat) => (
                                <option key={cat} value={cat} style={{ background: "#000" }}>
                                    {TRAIT_CATEGORY_LABELS[cat]}
                                </option>
                            ))}
                        </Box>
                    )}
                    {showTags && (
                        <TagSearchSelect
                            available={availableTags || []}
                            value={draftTags}
                            onChange={setDraftTags}
                        />
                    )}
                    {showCommands && (
                        <AbilityCommandToolbar
                            onInsert={(snip) => {
                                setDraftText((prev) => insertAtCursor(textRef.current, prev, snip));
                            }}
                        />
                    )}
                    <Box
                        component="textarea"
                        ref={textRef}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        rows={4}
                        sx={ABILITY_TEXTAREA_SX}
                    />
                    <Box sx={{ display: "flex", gap: 0.75, mt: 0.75 }}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => {
                                onSave?.({
                                    label: draftTitle,
                                    blurb: draftText,
                                    ...(showAbilityMeta ? {
                                        abilityKind: draftKind,
                                    } : {}),
                                    ...(showTraitMeta ? {
                                        traitCategory: draftTraitCat,
                                    } : {}),
                                    ...(showTags ? {
                                        tagKeys: sanitizeTagKeys(draftTags),
                                    } : {}),
                                });
                                setEditing(false);
                            }}
                            sx={{
                                px: 1.25, py: 0.55, borderRadius: "4px",
                                border: `1px solid ${C.cyan}`, bgcolor: `${C.cyan}18`,
                                color: C.cyan, fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                            }}
                        >
                            APLICAR
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setEditing(false)}
                            sx={{
                                px: 1.25, py: 0.55, borderRadius: "4px",
                                border: `1px solid ${C.border}`, bgcolor: "transparent",
                                color: C.muted, fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                            }}
                        >
                            CANCELAR
                        </Box>
                    </Box>
                </Box>
            ) : (
                <KitMarkdown content={text} emptyLabel="Sin descripción" />
            )}
        </Box>
    );
}

/* ── New item draft ───────────────────────────────────────────────── */
function NewItemDraft({
    tag,
    tagColor,
    onCommit,
    onCancel,
    showCommands = false,
    asAbility = false,
    asTrait = false,
    availableTags = null,
}) {
    const [label, setLabel] = useState("");
    const [blurb, setBlurb] = useState(asAbility ? DEFAULT_ATTACK_CONTENT : "");
    const [abilityKind, setAbilityKind] = useState(
        asAbility ? ABILITY_KINDS.ATTACK : ABILITY_KINDS.STANDARD,
    );
    const [traitCategory, setTraitCategory] = useState(TRAIT_CATEGORIES.SIMPLE);
    const [tagKeys, setTagKeys] = useState([]);
    const textRef = useRef(null);
    return (
        <Box sx={{
            p: "12px 14px",
            border: `1px solid ${C.cyan}`,
            borderRadius: "8px",
            bgcolor: "rgba(0,242,234,0.06)",
        }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em",
                color: "#ffffff", mb: 1,
                border: `1px solid ${tagColor ? `${tagColor}88` : C.border}`,
                display: "inline-block", px: "6px", py: "2px", borderRadius: "3px",
            }}>
                NUEVO {tag}
            </Box>
            <Box
                component="input"
                value={label}
                placeholder="Nombre"
                onChange={(e) => setLabel(e.target.value)}
                sx={{
                    width: "100%", mb: 1, boxSizing: "border-box",
                    background: "rgba(0,0,0,0.45)", border: `1px solid ${C.border}`,
                    borderRadius: "4px", color: C.text, p: "8px",
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.82rem", outline: "none",
                }}
            />
            {asAbility && (
                <Box
                    component="select"
                    value={abilityKind}
                    onChange={(e) => {
                        const kind = normalizeAbilityKind(e.target.value);
                        setAbilityKind(kind);
                        if (kind === ABILITY_KINDS.ATTACK && !blurb.trim()) {
                            setBlurb(DEFAULT_ATTACK_CONTENT);
                        }
                    }}
                    sx={selectSx}
                >
                    <option value={ABILITY_KINDS.STANDARD} style={{ background: "#000" }}>Standard</option>
                    <option value={ABILITY_KINDS.ATTACK} style={{ background: "#000" }}>Attack (d20 + boons)</option>
                </Box>
            )}
            {asTrait && (
                <Box
                    component="select"
                    value={traitCategory}
                    onChange={(e) => setTraitCategory(normalizeTraitCategory(e.target.value))}
                    sx={selectSx}
                >
                    {TRAIT_CATEGORY_LIST.map((cat) => (
                        <option key={cat} value={cat} style={{ background: "#000" }}>
                            {TRAIT_CATEGORY_LABELS[cat]}
                        </option>
                    ))}
                </Box>
            )}
            {(asAbility || asTrait) && (
                <TagSearchSelect
                    available={availableTags || []}
                    value={tagKeys}
                    onChange={setTagKeys}
                />
            )}
            {showCommands && (
                <AbilityCommandToolbar
                    onInsert={(snip) => {
                        setBlurb((prev) => insertAtCursor(textRef.current, prev, snip));
                    }}
                />
            )}
            <Box
                component="textarea"
                ref={textRef}
                value={blurb}
                placeholder="Descripción…"
                rows={4}
                onChange={(e) => setBlurb(e.target.value)}
                sx={ABILITY_TEXTAREA_SX}
            />
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.75 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onCommit({
                        label: label.trim() || `Nuevo ${tag}`,
                        blurb,
                        ...(asAbility ? {
                            abilityKind,
                            tagKeys: sanitizeTagKeys(tagKeys),
                        } : {}),
                        ...(asTrait ? {
                            traitCategory,
                            tagKeys: sanitizeTagKeys(tagKeys),
                        } : {}),
                    })}
                    sx={{
                        px: 1.25, py: 0.55, borderRadius: "4px",
                        border: `1px solid ${C.pink}`, bgcolor: `${C.pink}18`,
                        color: C.pink, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CREAR
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onCancel}
                    sx={{
                        px: 1.25, py: 0.55, borderRadius: "4px",
                        border: `1px solid ${C.border}`, bgcolor: "transparent",
                        color: C.muted, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CANCELAR
                </Box>
            </Box>
        </Box>
    );
}

/* ── Limit Break panel ────────────────────────────────────────────── */
function LimitBreakPanel({ limitBreak, unlocked, editMode, onSave, character, onCall }) {
    if (unlocked && limitBreak) {
        return (
            <KitCard
                tag="LIMIT"
                tagColor={C.lb}
                title={limitBreak.label}
                text={limitBreak.blurb}
                editMode={editMode}
                showCommands={editMode}
                onSave={onSave}
                character={character}
                onCall={onCall}
                pinEntry={{
                    type: MACRO_SLOT_TYPES.ULTIMATE,
                    id: limitBreak.key || limitBreak.id,
                    label: limitBreak.label || "LIMIT BREAK",
                    blurb: limitBreak.blurb || "",
                }}
            />
        );
    }

    return (
        <Box
            sx={{
                position: "relative",
                minHeight: 160,
                p: "16px 14px",
                borderRadius: "8px",
                border: `1px solid ${C.danger}88`,
                bgcolor: "rgba(255,51,85,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.25,
                overflow: "hidden",
            }}
        >
            <Box
                className="dossier-lb-locked-x"
                sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    border: `2px solid ${C.danger}`,
                    color: C.danger,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    boxShadow: `0 0 18px ${C.danger}44`,
                }}
            >
                ✕
            </Box>
            <Box
                className="dossier-lb-locked-label"
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.62rem",
                    color: C.danger,
                    textTransform: "uppercase",
                    textAlign: "center",
                }}
            >
                Aún no Desbloqueado
            </Box>
            {limitBreak?.label && (
                <Box sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.72rem",
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: "0.08em",
                    textAlign: "center",
                    px: 1,
                }}>
                    {limitBreak.label}
                </Box>
            )}
        </Box>
    );
}

/* ── Ability block ────────────────────────────────────────────────── */
function AbilityBlock({ ability, isActive, onToggleLoadout, editMode, onSave, character, availableTags = null, onCall = null }) {
    const [open, setOpen] = useState(false);
    const { spawnPing } = useDossier();

    return (
        <Box sx={{
            border: `1px solid ${isActive ? "rgba(0,242,234,0.45)" : C.border}`,
            borderRadius: "8px",
            bgcolor: "rgba(0,0,0,0.22)",
            overflow: "hidden",
            alignSelf: "start",
        }}>
            <Box
                sx={{
                    display: "flex", alignItems: "center", gap: "8px",
                    p: "10px 12px",
                    bgcolor: "rgba(0,0,0,0.2)",
                    "&:hover": { bgcolor: "rgba(255,102,255,0.04)" },
                }}
            >
                <Box
                    role="checkbox"
                    aria-checked={isActive}
                    aria-label="Loadout"
                    onClick={(e) => {
                        e.stopPropagation();
                        spawnPing(e.clientX, e.clientY);
                        onToggleLoadout();
                    }}
                    sx={{
                        width: 18, height: 18, borderRadius: "3px", flexShrink: 0,
                        border: `1px solid ${isActive ? C.cyan : C.border}`,
                        bgcolor: isActive ? "rgba(0,242,234,0.15)" : "transparent",
                        display: "grid", placeItems: "center",
                        color: isActive ? C.cyan : "transparent",
                        fontSize: "0.55rem",
                        cursor: "pointer",
                    }}
                >
                    {isActive ? "✓" : ""}
                </Box>
                <Box
                    onClick={(e) => {
                        spawnPing(e.clientX, e.clientY);
                        setOpen((p) => !p);
                    }}
                    sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        flex: 1,
                        color: C.text,
                        cursor: "pointer",
                        minWidth: 0,
                    }}
                >
                    {ability.label}
                </Box>
                {ability.abilityKind === ABILITY_KINDS.ATTACK && (
                    <Box component="span" sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.5rem",
                        letterSpacing: "0.06em",
                        color: C.danger,
                        border: `1px solid ${C.danger}66`,
                        px: "4px",
                        borderRadius: "2px",
                    }}>
                        ATK
                    </Box>
                )}
                <MacroPinButton
                    character={character}
                    entry={{
                        type: MACRO_SLOT_TYPES.ABILITY,
                        id: ability.key || ability.id,
                        label: ability.label || "ABILITY",
                        blurb: ability.blurb || "",
                    }}
                    size="tiny"
                />
                {typeof onCall === "function" && (
                    <CallChatBtn onClick={onCall} />
                )}
                <Box
                    onClick={() => setOpen((p) => !p)}
                    sx={{
                        fontFamily: '"Fira Code", monospace', fontSize: "0.55rem",
                        color: C.muted, px: "6px", cursor: "pointer",
                        "&:hover": { color: C.cyan },
                    }}
                >
                    {open ? "▲" : "▼"}
                </Box>
            </Box>

            {open && (
                <Box sx={{ p: "0 12px 12px" }}>
                    {editMode ? (
                        <KitCard
                            tag="ABILITY"
                            tagColor={C.cyan}
                            title={ability.label}
                            text={ability.blurb}
                            editMode
                            showCommands
                            onSave={onSave}
                            character={character}
                            abilityKind={ability.abilityKind || ABILITY_KINDS.STANDARD}
                            tagKeys={ability.tagKeys || []}
                            availableTags={availableTags}
                            pinEntry={{
                                type: MACRO_SLOT_TYPES.ABILITY,
                                id: ability.key || ability.id,
                                label: ability.label || "ABILITY",
                                blurb: ability.blurb || "",
                            }}
                        />
                    ) : (
                        <Box>
                            <TagChipsRow tagKeys={ability.tagKeys || []} />
                            <Box sx={{ mt: 1 }}>
                                <KitMarkdown content={ability.blurb} />
                            </Box>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
}

/* ── Create / propose job panel ───────────────────────────────────── */
function CreateJobPanel({ isDM, onCreate, onCancel }) {
    const [name, setName] = useState("");
    const [archetype, setArchetype] = useState("wright");
    const [stats, setStats] = useState(() => combatDefaultsForArchetype("wright"));
    const [resource, setResource] = useState(() => classResourceForArchetype("wright"));

    return (
        <Box sx={{
            mb: 2,
            p: "14px",
            borderRadius: "8px",
            border: `1px solid ${C.pink}`,
            bgcolor: `${C.pink}0c`,
        }}>
            <Box sx={{
                fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem", letterSpacing: "0.12em",
                color: C.pink, mb: 1.25,
            }}>
                {isDM ? "CREAR JOB" : "PROPONER JOB"}
            </Box>
            <Box
                component="input"
                value={name}
                placeholder="Nombre del job"
                onChange={(e) => setName(e.target.value)}
                sx={{
                    width: "100%", mb: 1, boxSizing: "border-box",
                    background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                    borderRadius: "6px", color: C.text, p: "8px 10px",
                    fontFamily: "Orbitron, sans-serif", fontSize: "0.82rem", outline: "none",
                }}
            />
            <Box
                component="select"
                value={archetype}
                onChange={(e) => {
                    const a = e.target.value;
                    setArchetype(a);
                    setStats(combatDefaultsForArchetype(a));
                    setResource(classResourceForArchetype(a));
                }}
                sx={{
                    width: "100%", mb: 1.25, boxSizing: "border-box",
                    background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                    borderRadius: "6px", color: C.text, p: "8px 10px",
                    fontFamily: "'Fira Code', monospace", fontSize: "0.75rem", outline: "none",
                }}
            >
                {["stalwart", "vagabond", "mendicant", "wright"].map((a) => (
                    <option key={a} value={a} style={{ backgroundColor: "#12121a", color: "#fff" }}>
                        {a.toUpperCase()}
                    </option>
                ))}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75, mb: 1.25 }}>
                {COMBAT_STAT_KEYS.map((key) => (
                    <Box key={key}>
                        <Box sx={{ fontSize: "0.52rem", color: C.muted, fontFamily: "Orbitron, sans-serif", mb: 0.35 }}>
                            {STAT_META[key]?.label || key}
                        </Box>
                        {key === "damageDie" ? (
                            <Box
                                component="select"
                                value={stats.damageDie ?? 6}
                                onChange={(e) => setStats((s) => ({ ...s, damageDie: Number(e.target.value) }))}
                                sx={{
                                    width: "100%", background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                    borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                                }}
                            >
                                {DAMAGE_DIE_OPTIONS.map((d) => (
                                    <option key={d} value={d} style={{ backgroundColor: "#12121a" }}>d{d}</option>
                                ))}
                            </Box>
                        ) : (
                            <Box
                                component="input"
                                type="number"
                                value={stats[key] ?? 0}
                                onChange={(e) => setStats((s) => ({ ...s, [key]: Number(e.target.value) }))}
                                sx={{
                                    width: "100%", boxSizing: "border-box",
                                    background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                    borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                                }}
                            />
                        )}
                    </Box>
                ))}
                <Box sx={{ gridColumn: "span 2" }}>
                    <Box sx={{ fontSize: "0.52rem", color: C.cyan, fontFamily: "Orbitron, sans-serif", mb: 0.35 }}>
                        CLASS RESOURCE
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Box
                            component="input"
                            value={resource.name}
                            onChange={(e) => setResource((r) => ({ ...r, name: e.target.value }))}
                            placeholder="Nombre"
                            sx={{
                                flex: 1, background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                            }}
                        />
                        <Box
                            component="input"
                            type="number"
                            value={resource.max ?? ""}
                            placeholder="max"
                            onChange={(e) => setResource((r) => ({
                                ...r,
                                max: e.target.value === "" ? null : Number(e.target.value),
                            }))}
                            sx={{
                                width: 64, background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`,
                                borderRadius: "4px", color: C.text, p: "6px", fontSize: "0.75rem",
                            }}
                        />
                    </Box>
                </Box>
            </Box>
            {!isDM && (
                <Box sx={{ fontSize: "0.75rem", color: C.muted, mb: 1, lineHeight: 1.4 }}>
                    Se enviará como propuesta al DM (status: proposed).
                </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.75 }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onCreate({
                        displayName: name.trim() || "Nuevo Job",
                        classArchetype: archetype,
                        combatStats: sanitizeCombatPartial(stats),
                        classResource: sanitizeClassResource(resource),
                    })}
                    sx={{
                        px: 1.5, py: 0.7, borderRadius: "6px",
                        border: `1px solid ${C.pink}`, bgcolor: `${C.pink}22`,
                        color: C.pink, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    {isDM ? "CREAR Y ASIGNAR" : "ENVIAR PROPUESTA"}
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onCancel}
                    sx={{
                        px: 1.5, py: 0.7, borderRadius: "6px",
                        border: `1px solid ${C.border}`, bgcolor: "transparent",
                        color: C.muted, fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.58rem", letterSpacing: "0.08em", cursor: "pointer",
                    }}
                >
                    CANCELAR
                </Box>
            </Box>
        </Box>
    );
}

/* ── Main ─────────────────────────────────────────────────────────── */
export default function DossierKitView({ character }) {
    const dispatch = useDispatch();
    const { spawnPing, editMode, patchDraft } = useDossier();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const { tags: campaignTags } = useCampaignTags(campaignId);
    const isDM = isDmRole(profile?.role);
    const [reloadTick, setReloadTick] = useState(0);
    const { loading, classIds, jobList } = useCharacterJobData(character, reloadTick);
    const { combatStats, claseDoc } = useResolvedCombatStats(character, reloadTick);

    const activeClassId = character?.activeClassId || classIds[0] || null;
    const [focusClassId, setFocusClassId] = useState(activeClassId);
    const [campaignJobs, setCampaignJobs] = useState([]);
    const [showCreateJob, setShowCreateJob] = useState(false);
    const [draftTrait, setDraftTrait] = useState(false);
    const [traitFilter, setTraitFilter] = useState(null); // null | TRAIT_CATEGORIES.*
    const [draftAbility, setDraftAbility] = useState(false);
    const [savingExtra, setSavingExtra] = useState(false);
    const didSeedLoadout = useRef(false);

    useEffect(() => {
        setFocusClassId(activeClassId);
    }, [activeClassId]);

    useEffect(() => {
        if (!campaignId) {
            setCampaignJobs([]);
            return undefined;
        }
        let cancelled = false;
        listClasesForCampaign(campaignId).then((list) => {
            if (!cancelled) setCampaignJobs(list);
        }).catch(() => {
            if (!cancelled) setCampaignJobs([]);
        });
        return () => { cancelled = true; };
    }, [campaignId, reloadTick]);

    const currentLoadout = useMemo(() => {
        const raw = character?.loadout || character?.selectedAbilities || [];
        return Array.isArray(raw) ? raw : [];
    }, [character?.loadout, character?.selectedAbilities]);

    const [loadout, setLoadout] = useState(currentLoadout);
    useEffect(() => { setLoadout(currentLoadout); }, [currentLoadout]);

    const activeJob = useMemo(
        () => jobList.find((j) => j.classId === (focusClassId || activeClassId)) || jobList[0] || null,
        [jobList, focusClassId, activeClassId],
    );

    const overrides = character?.combatOverrides && typeof character.combatOverrides === "object"
        ? character.combatOverrides
        : {};

    const jobResourceDef = useMemo(() => {
        const fromDoc = sanitizeClassResource(claseDoc?.classResource);
        if (fromDoc) return fromDoc;
        const arch = claseDoc?.classArchetype || "wright";
        return classResourceForArchetype(arch);
    }, [claseDoc]);

    const jobSpecialMechanic = useMemo(
        () => sanitizeSpecialMechanic(claseDoc?.specialMechanic),
        [claseDoc],
    );

    const jobDescription = String(claseDoc?.description || "").trim();
    const jobDisplayName = String(
        claseDoc?.displayName || activeJob?.label || "",
    ).trim();

    const jobResourceValue = useMemo(() => {
        const map = character?.jobResources && typeof character.jobResources === "object"
            ? character.jobResources
            : {};
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) return jobResourceDef.min ?? 0;
        const raw = map[jobId];
        if (raw == null || raw === "") return jobResourceDef.min ?? 0;
        const n = Number(raw);
        return Number.isFinite(n) ? n : (jobResourceDef.min ?? 0);
    }, [character?.jobResources, activeJob?.classId, focusClassId, activeClassId, jobResourceDef.min]);

    const lbKey = activeJob?.limitBreak?.key || activeJob?.limitBreak?.id || null;
    const lbUnlocked = Boolean(
        lbKey && Array.isArray(character?.unlockedAbilities) && character.unlockedAbilities.includes(lbKey),
    );

    const majorityOk = useCallback((nextLoadout, jobAbilityIds) => {
        if (!jobAbilityIds?.length) return true;
        const jobCount = nextLoadout.filter((id) => jobAbilityIds.includes(id)).length;
        const otherCount = nextLoadout.length - jobCount;
        return jobCount >= otherCount;
    }, []);

    const handleJobChip = (e, classId) => {
        spawnPing(e.clientX, e.clientY);
        setFocusClassId(classId);
        if (editMode) {
            patchDraft({ activeClassId: classId });
            return;
        }
        if (character?.id) {
            updateCharacterFields(character.id, { activeClassId: classId }).catch(console.error);
        }
    };

    const handleAssignJob = (jobId) => {
        if (!jobId) return;
        const assigned = Array.isArray(character?.assignedClassIds)
            ? [...character.assignedClassIds]
            : [];
        if (!assigned.includes(jobId)) assigned.push(jobId);
        patchDraft({ assignedClassIds: assigned, activeClassId: jobId });
        setFocusClassId(jobId);
    };

    const setOverride = (key, raw) => {
        const next = { ...overrides };
        if (raw === "" || raw == null) delete next[key];
        else {
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            next[key] = Math.floor(n);
        }
        const cleaned = sanitizeCombatPartial(next);
        const resolved = resolveCombatStats({ ...character, combatOverrides: cleaned }, claseDoc);
        patchDraft({ combatOverrides: cleaned, vit: resolved.vit });
    };

    const setJobResourceValue = (raw) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) return;
        let n = Math.floor(Number(raw));
        if (!Number.isFinite(n)) return;
        const min = jobResourceDef.min ?? 0;
        const max = jobResourceDef.max;
        if (n < min) n = min;
        if (max != null && n > max) n = max;
        const next = {
            ...(character?.jobResources && typeof character.jobResources === "object"
                ? character.jobResources
                : {}),
            [jobId]: n,
        };
        if (editMode) {
            patchDraft({ jobResources: next });
            return;
        }
        if (character?.id) {
            updateCharacterFields(character.id, { jobResources: next }).catch(console.error);
        }
    };

    const setJobResourceMeta = async (partial) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId || !isDM) return;
        const next = sanitizeClassResource({ ...jobResourceDef, ...partial });
        if (!next) {
            dispatch(showSnackbar({
                message: "Class resource necesita un nombre",
                severity: "warning",
            }));
            return;
        }
        if (
            next.name === jobResourceDef.name
            && next.min === jobResourceDef.min
            && next.max === jobResourceDef.max
        ) {
            return;
        }
        setSavingExtra(true);
        try {
            await updateClaseFields(jobId, { classResource: next });
            setReloadTick((t) => t + 1);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar class resource", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const setJobSpecialMechanic = async (nextRaw) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId || !isDM) return;
        const next = sanitizeSpecialMechanic(nextRaw);
        if (!next) return;
        const prev = jobSpecialMechanic;
        if (prev && prev.name === next.name && prev.text === next.text) return;
        setSavingExtra(true);
        try {
            await updateClaseFields(jobId, { specialMechanic: next });
            setReloadTick((t) => t + 1);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar special mechanic", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const setJobIdentity = async ({ displayName, description }) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId || !isDM) return;
        const nextName = String(displayName || "").trim();
        const nextDesc = String(description || "").trim();
        if (!nextName) return;
        const prevName = jobDisplayName;
        const prevDesc = jobDescription;
        if (nextName === prevName && nextDesc === prevDesc) return;
        setSavingExtra(true);
        try {
            await updateClaseFields(jobId, {
                displayName: nextName,
                description: nextDesc || null,
            });
            setReloadTick((t) => t + 1);
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar el job", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const callKit = useCallback(async (card) => {
        if (!campaignId || !character) {
            dispatch(showSnackbar({ message: "Sin campaña/personaje", severity: "warning" }));
            return;
        }
        try {
            await callKitCardInChat(
                campaignId,
                profile,
                {
                    ...card,
                    characterId: character.id,
                    characterName: character.name,
                    characterAvatarUrl: character.tokenImageUrl || character.imageUrl || null,
                },
                { character, claseDoc, combatStats },
            );
            dispatch(showSnackbar({ message: "Enviado al chat", severity: "success" }));
        } catch (err) {
            console.error("[DossierKitView] callKit:", err);
            dispatch(showSnackbar({ message: "No se pudo enviar al chat", severity: "error" }));
        }
    }, [campaignId, character, profile, claseDoc, combatStats, dispatch]);

    const handleCreateJob = async ({ displayName, classArchetype, combatStats: cs, classResource, specialMechanic, description }) => {
        if (!campaignId) return;
        setSavingExtra(true);
        try {
            const id = await createClaseDoc({
                campaignId,
                displayName,
                classArchetype,
                combatStats: cs,
                classResource: classResource || null,
                specialMechanic: specialMechanic || null,
                description: description || null,
                proposed: !isDM,
                proposedBy: profile?.uid || null,
            });
            const assigned = Array.isArray(character?.assignedClassIds)
                ? [...character.assignedClassIds]
                : [];
            if (!assigned.includes(id)) assigned.push(id);
            patchDraft({ assignedClassIds: assigned, activeClassId: id });
            setFocusClassId(id);
            setShowCreateJob(false);
            setReloadTick((t) => t + 1);
            dispatch(showSnackbar({
                message: isDM ? "Job creado y asignado" : "Propuesta de job enviada",
                severity: "success",
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo crear el job", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const saveAbilityToActiveJob = async ({
        label,
        blurb,
        type,
        existingKey = null,
        abilityKind = null,
        tagKeys = null,
        traitCategory = null,
    }) => {
        const jobId = activeJob?.classId || focusClassId || activeClassId;
        if (!jobId) {
            dispatch(showSnackbar({ message: "Asigna un job primero", severity: "warning" }));
            return;
        }
        setSavingExtra(true);
        try {
            const key = existingKey
                || `${slugify(activeJob?.label || jobId)}-${slugify(label)}-${Date.now().toString(36).slice(-4)}`;
            const payload = {
                label,
                type,
                content: blurb || "",
                description: blurb || "",
            };
            if (type === "ability") {
                payload.abilityKind = normalizeAbilityKind(abilityKind);
            }
            if (type === "trait") {
                payload.traitCategory = normalizeTraitCategory(traitCategory);
            }
            if (tagKeys != null) {
                payload.tagKeys = sanitizeTagKeys(tagKeys);
            }
            await upsertAbilityDoc(key, payload);
            await linkAbilityToClase(jobId, key);
            setReloadTick((t) => t + 1);
            dispatch(showSnackbar({
                message: existingKey ? "Actualizado" : `${type} añadido al job`,
                severity: "success",
            }));
        } catch (err) {
            console.error(err);
            dispatch(showSnackbar({ message: "No se pudo guardar", severity: "error" }));
        } finally {
            setSavingExtra(false);
        }
    };

    const handleAbilityToggle = useCallback((abilityId, jobAbilityIds) => {
        setLoadout((prev) => {
            const on = prev.includes(abilityId);
            let next;
            if (on) next = prev.filter((id) => id !== abilityId);
            else {
                if (prev.length >= MAX_LOADOUT) return prev;
                next = [...prev, abilityId];
                if (!majorityOk(next, jobAbilityIds)) return prev;
            }
            if (character?.id) {
                updateCharacterFields(character.id, { loadout: next }).catch(console.error);
            }
            return next;
        });
    }, [character?.id, majorityOk]);

    const jobAbilityIds = useMemo(
        () => (activeJob?.abilities || []).map((a) => a.id),
        [activeJob],
    );

    const traitsGrouped = useMemo(() => {
        const list = (activeJob?.traits || []).filter(Boolean);
        const filtered = traitFilter
            ? list.filter((t) => normalizeTraitCategory(t.traitCategory) === traitFilter)
            : list;
        return TRAIT_CATEGORY_LIST.map((cat) => ({
            cat,
            label: TRAIT_CATEGORY_LABELS[cat],
            items: filtered.filter((t) => normalizeTraitCategory(t.traitCategory) === cat),
        })).filter((g) => g.items.length > 0);
    }, [activeJob?.traits, traitFilter]);

    const allAbilities = useMemo(() => {
        if (!activeJob) return [];
        const fromJob = activeJob.abilities.map((a) => ({ ...a, jobLabel: activeJob.label }));
        const others = jobList
            .filter((j) => j.classId !== activeJob.classId)
            .flatMap((j) => j.abilities.map((a) => ({ ...a, jobLabel: j.label })));
        const seen = new Set();
        return [...fromJob, ...others].filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }, [activeJob, jobList]);

    /* Preselect first 6 abilities when loadout is empty */
    useEffect(() => {
        if (loading || !character?.id || didSeedLoadout.current) return;
        if (currentLoadout.length > 0) {
            didSeedLoadout.current = true;
            return;
        }
        if (!allAbilities.length) return;
        didSeedLoadout.current = true;
        const first6 = allAbilities.slice(0, MAX_LOADOUT).map((a) => a.id);
        setLoadout(first6);
        updateCharacterFields(character.id, { loadout: first6 }).catch(console.error);
    }, [loading, character?.id, currentLoadout.length, allAbilities]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress size={28} sx={{ color: C.cyan }} />
            </Box>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "rgba(8,8,14,0.55)" }}>
            <div className="dossier-trail" style={{ margin: "0 18px 0" }} />

            <Box sx={{ ...SCROLL_SX, px: "18px", pb: "28px" }}>
                {/* JOBS */}
                <SectionLabel limit="1 por sesión" sx={{ mt: "8px" }}>JOB ACTIVO</SectionLabel>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px", mb: "4px", alignItems: "center" }}>
                    {jobList.map((job) => {
                        const isActive = job.classId === (focusClassId || activeClassId);
                        return (
                            <Box
                                key={job.classId}
                                component="button"
                                type="button"
                                onClick={(e) => handleJobChip(e, job.classId)}
                                sx={{
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em",
                                    px: "12px", py: "7px", borderRadius: "999px",
                                    border: `1px solid ${isActive ? C.cyan : C.border}`,
                                    color: isActive ? C.cyan : C.muted,
                                    bgcolor: isActive ? "rgba(0,242,234,0.1)" : "rgba(0,0,0,0.35)",
                                    boxShadow: isActive ? `0 0 14px ${C.glowC}` : "none",
                                    cursor: "pointer",
                                    "&:hover": { borderColor: C.cyan, color: C.text },
                                }}
                            >
                                {job.label}
                                {isActive && (
                                    <Box component="span" sx={{ ml: "6px", fontSize: "0.48rem", color: C.lb }}>ACTIVE</Box>
                                )}
                            </Box>
                        );
                    })}
                    {jobList.length === 0 && (
                        <Box sx={{ fontSize: "0.85rem", color: C.muted }}>Sin clases asignadas</Box>
                    )}
                    {editMode && (
                        <>
                            <Box
                                component="select"
                                value=""
                                onChange={(e) => { if (e.target.value) handleAssignJob(e.target.value); }}
                                sx={{
                                    height: 32, px: 1, borderRadius: 999,
                                    border: `1px solid ${C.border}`, bgcolor: "rgba(0,0,0,0.35)",
                                    color: C.text, fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.52rem", letterSpacing: "0.06em", outline: "none", cursor: "pointer",
                                }}
                            >
                                <option value="" style={{ backgroundColor: "#12121a", color: "#fff" }}>+ ASIGNAR</option>
                                {campaignJobs.map((j) => (
                                    <option key={j.id} value={j.id} style={{ backgroundColor: "#12121a", color: "#fff" }}>
                                        {(j.displayName || j.id).toUpperCase()}
                                        {j.status === "proposed" ? " · PROPUESTO" : ""}
                                    </option>
                                ))}
                            </Box>
                            <Box
                                component="button"
                                type="button"
                                onClick={() => setShowCreateJob((v) => !v)}
                                sx={{
                                    fontFamily: "Orbitron, sans-serif", fontSize: "0.52rem", letterSpacing: "0.08em",
                                    px: "10px", py: "7px", borderRadius: "999px",
                                    border: `1px solid ${C.pink}`, color: C.pink,
                                    bgcolor: `${C.pink}14`, cursor: "pointer",
                                    "&:hover": { bgcolor: `${C.pink}28` },
                                }}
                            >
                                {isDM ? "+ CREAR JOB" : "+ PROPONER JOB"}
                            </Box>
                        </>
                    )}
                </Box>

                {editMode && showCreateJob && (
                    <CreateJobPanel
                        isDM={isDM}
                        onCancel={() => setShowCreateJob(false)}
                        onCreate={handleCreateJob}
                    />
                )}

                {/* COMBAT — Job (left half) | Stats + Class Resource (right) → Special → LB */}
                <SectionLabel>COMBAT</SectionLabel>
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                    gap: "12px",
                    alignItems: "stretch",
                    "@media (max-width:900px)": {
                        gridTemplateColumns: "1fr",
                    },
                }}>
                    {/* Job identity — full left half (matches right stack height) */}
                    <Box sx={{
                        gridColumn: "span 6",
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignSelf: "stretch",
                        "@media (max-width:900px)": { gridColumn: "1 / -1" },
                    }}>
                        <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                            <JobIdentityPanel
                                jobName={jobDisplayName}
                                description={jobDescription}
                                editMode={editMode}
                                isDM={isDM}
                                onSave={setJobIdentity}
                                onCall={() => callKit({
                                    id: `job:${activeClassId || "none"}`,
                                    label: `JOB · ${jobDisplayName || "Sin job"}`,
                                    content: jobDescription || "",
                                    abilityKind: ABILITY_KINDS.STANDARD,
                                })}
                            />
                        </Box>
                    </Box>

                    {/* Right stack: Stats + Class Resource */}
                    <Box sx={{
                        gridColumn: "span 6",
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        "@media (max-width:900px)": { gridColumn: "1 / -1" },
                    }}>
                        <Box sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "8px",
                            alignContent: "start",
                        }}>
                            {COMBAT_STAT_KEYS.map((key) => (
                                <CombatStatCell
                                    key={key}
                                    statKey={key}
                                    value={overrides[key] ?? ""}
                                    display={combatStats?.[key] ?? 0}
                                    editMode={editMode}
                                    isOverride={overrides[key] != null}
                                    onChange={(raw) => setOverride(key, raw)}
                                />
                            ))}
                        </Box>
                        <ClassResourceCell
                            resource={jobResourceDef}
                            value={jobResourceValue}
                            editMode={editMode}
                            isDM={isDM}
                            onChangeValue={setJobResourceValue}
                            onChangeMeta={setJobResourceMeta}
                        />
                    </Box>

                    {/* Special Mechanic — full row */}
                    <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
                        <SpecialMechanicPanel
                            mechanic={jobSpecialMechanic}
                            editMode={editMode}
                            isDM={isDM}
                            onChangeMeta={setJobSpecialMechanic}
                            onCall={() => callKit({
                                id: `special:${activeClassId || "none"}`,
                                label: `SPECIAL · ${jobSpecialMechanic?.name || "Mechanic"}`,
                                content: jobSpecialMechanic?.text || "",
                                abilityKind: ABILITY_KINDS.STANDARD,
                            })}
                        />
                    </Box>

                    {/* Limit Break — full row */}
                    <Box sx={{ gridColumn: "1 / -1", minWidth: 0 }}>
                        <Box sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.48rem",
                            letterSpacing: "0.14em",
                            color: lbUnlocked ? C.lb : C.danger,
                            mb: 1,
                        }}>
                            LIMIT BREAK
                        </Box>
                        <LimitBreakPanel
                            limitBreak={activeJob?.limitBreak || null}
                            unlocked={lbUnlocked}
                            editMode={editMode && lbUnlocked}
                            character={character}
                            onCall={activeJob?.limitBreak ? () => callKit({
                                id: activeJob.limitBreak.key || activeJob.limitBreak.id,
                                label: activeJob.limitBreak.label || "LIMIT BREAK",
                                content: activeJob.limitBreak.blurb || "",
                                abilityKind: ABILITY_KINDS.STANDARD,
                            }) : undefined}
                            onSave={({ label, blurb }) => saveAbilityToActiveJob({
                                label,
                                blurb,
                                type: "ultimate",
                                existingKey: activeJob?.limitBreak?.key || activeJob?.limitBreak?.id,
                            })}
                        />
                    </Box>
                </Box>

                {/* TRAITS */}
                <Box sx={{ mt: 0.5 }}>
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        flexWrap: "wrap",
                        mb: 1,
                        mt: "14px",
                    }}>
                        <Box sx={{
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.58rem",
                            letterSpacing: "0.14em",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            flex: 1,
                            minWidth: 120,
                            "&::after": {
                                content: '""',
                                flex: 1,
                                height: "1px",
                                background: `linear-gradient(90deg, ${C.cyan}66, transparent)`,
                            },
                        }}>
                            TRAITS
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setTraitFilter(null)}
                            sx={{
                                px: 0.8, py: 0.3, borderRadius: "3px",
                                border: `1px solid ${traitFilter == null ? C.trait : C.border}`,
                                bgcolor: traitFilter == null ? `${C.trait}18` : "transparent",
                                color: traitFilter == null ? C.trait : C.muted,
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.48rem", letterSpacing: "0.06em", cursor: "pointer",
                            }}
                        >
                            All
                        </Box>
                        {TRAIT_CATEGORY_LIST.map((cat) => (
                            <Box
                                key={cat}
                                component="button"
                                type="button"
                                onClick={() => setTraitFilter((p) => (p === cat ? null : cat))}
                                sx={{
                                    px: 0.8, py: 0.3, borderRadius: "3px",
                                    border: `1px solid ${traitFilter === cat ? C.trait : C.border}`,
                                    bgcolor: traitFilter === cat ? `${C.trait}18` : "transparent",
                                    color: traitFilter === cat ? C.trait : C.muted,
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.48rem", letterSpacing: "0.06em", cursor: "pointer",
                                }}
                            >
                                {TRAIT_CATEGORY_LABELS[cat]}
                            </Box>
                        ))}
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                        {traitsGrouped.map((group) => (
                            <Box key={group.cat}>
                                {!traitFilter && group.items.length > 0 && (
                                    <Box sx={{
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.55rem",
                                        color: C.trait,
                                        letterSpacing: "0.06em",
                                        mb: 0.5,
                                    }}>
                                        {group.label}
                                    </Box>
                                )}
                                <Box sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr",
                                    gap: "10px",
                                    alignItems: "start",
                                    "@media (max-width:700px)": { gridTemplateColumns: "1fr" },
                                }}>
                                    {group.items.map((t) => (
                                        <KitCard
                                            key={t.id}
                                            tag="TRAIT"
                                            tagColor={C.trait}
                                            title={t.label}
                                            text={t.blurb}
                                            editMode={editMode}
                                            character={character}
                                            showTraitMeta
                                            traitCategory={t.traitCategory}
                                            tagKeys={t.tagKeys || []}
                                            availableTags={campaignTags}
                                            pinEntry={{
                                                type: MACRO_SLOT_TYPES.TRAIT,
                                                id: t.key || t.id,
                                                label: t.label || "TRAIT",
                                                blurb: t.blurb || "",
                                            }}
                                            onSave={({ label, blurb, traitCategory, tagKeys }) => saveAbilityToActiveJob({
                                                label,
                                                blurb,
                                                type: "trait",
                                                existingKey: t.key || t.id,
                                                traitCategory,
                                                tagKeys,
                                            })}
                                            onCall={() => callKit({
                                                id: t.key || t.id,
                                                label: t.label || "TRAIT",
                                                content: t.blurb || "",
                                                tagKeys: t.tagKeys || [],
                                                abilityKind: ABILITY_KINDS.STANDARD,
                                            })}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        ))}
                        {(activeJob?.traits || []).length === 0 && !draftTrait && (
                            <Box sx={{ fontSize: "0.85rem", color: C.muted }}>Sin traits</Box>
                        )}
                        {(activeJob?.traits || []).length > 0
                            && traitsGrouped.every((g) => g.items.length === 0)
                            && !draftTrait && (
                            <Box sx={{ fontSize: "0.85rem", color: C.muted }}>
                                Sin traits en esta categoría
                            </Box>
                        )}
                        {draftTrait && (
                            <NewItemDraft
                                tag="TRAIT"
                                tagColor={C.trait}
                                asTrait
                                availableTags={campaignTags}
                                onCancel={() => setDraftTrait(false)}
                                onCommit={async (data) => {
                                    await saveAbilityToActiveJob({ ...data, type: "trait" });
                                    setDraftTrait(false);
                                }}
                            />
                        )}
                    </Box>
                    {editMode && !draftTrait && (
                        <AddRowButton label="+ AGREGAR TRAIT" onClick={() => setDraftTrait(true)} />
                    )}
                </Box>

                {/* LOADOUT */}
                <Box sx={{
                    display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
                    p: "10px 12px", mt: "16px", mb: "4px", borderRadius: "8px",
                    border: "1px solid rgba(255,204,51,0.28)",
                    bgcolor: "rgba(255,204,51,0.06)",
                    fontFamily: '"Fira Code", monospace', fontSize: "0.72rem", color: C.muted,
                }}>
                    <span>LOADOUT <strong style={{ color: C.lb }}>{loadout.length}/{MAX_LOADOUT}</strong></span>
                    <Box sx={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {Array.from({ length: MAX_LOADOUT }).map((_, i) => (
                            <Box key={i} sx={{
                                width: 22, height: 22, borderRadius: "4px",
                                border: `1px solid ${i < loadout.length ? C.cyan : C.border}`,
                                bgcolor: i < loadout.length ? "rgba(0,242,234,0.12)" : "rgba(0,0,0,0.35)",
                                display: "grid", placeItems: "center",
                                fontSize: "0.5rem",
                                color: i < loadout.length ? C.cyan : C.muted,
                            }}>
                                {i < loadout.length ? "◈" : "·"}
                            </Box>
                        ))}
                    </Box>
                    <Box component="span" sx={{ ml: "auto" }}>✓ = loadout · click nombre = detalle</Box>
                </Box>

                {/* ABILITIES — 3 cols */}
                <SectionLabel limit="+ 2 talentos · 1 mastery c/u">HABILIDADES</SectionLabel>
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "10px",
                    mb: "4px",
                    alignItems: "start",
                    "@media (max-width:900px)": { gridTemplateColumns: "1fr 1fr" },
                    "@media (max-width:600px)": { gridTemplateColumns: "1fr" },
                }}>
                    {allAbilities.map((ab) => (
                        <AbilityBlock
                            key={ab.id}
                            ability={ab}
                            isActive={loadout.includes(ab.id)}
                            onToggleLoadout={() => handleAbilityToggle(ab.id, jobAbilityIds)}
                            editMode={editMode}
                            character={character}
                            availableTags={campaignTags}
                            onSave={({ label, blurb, abilityKind, tagKeys }) => saveAbilityToActiveJob({
                                label, blurb, type: "ability", existingKey: ab.key || ab.id,
                                abilityKind, tagKeys,
                            })}
                            onCall={() => callKit({
                                id: ab.key || ab.id,
                                label: ab.label || "ABILITY",
                                content: ab.blurb || "",
                                tagKeys: ab.tagKeys || [],
                                abilityKind: ab.abilityKind || ABILITY_KINDS.STANDARD,
                            })}
                        />
                    ))}
                    {allAbilities.length === 0 && !draftAbility && (
                        <Box sx={{ fontSize: "0.85rem", color: C.muted, gridColumn: "1 / -1" }}>
                            Sin habilidades cargadas
                        </Box>
                    )}
                    {draftAbility && (
                        <NewItemDraft
                            tag="ABILITY"
                            tagColor={C.cyan}
                            showCommands
                            asAbility
                            availableTags={campaignTags}
                            onCancel={() => setDraftAbility(false)}
                            onCommit={async (data) => {
                                await saveAbilityToActiveJob({ ...data, type: "ability" });
                                setDraftAbility(false);
                            }}
                        />
                    )}
                </Box>
                {editMode && !draftAbility && (
                    <AddRowButton
                        label="+ AGREGAR HABILIDAD"
                        onClick={() => setDraftAbility(true)}
                    />
                )}

                {savingExtra && (
                    <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                        <CircularProgress size={14} sx={{ color: C.cyan }} />
                        <Box sx={{ fontSize: "0.75rem", color: C.muted }}>Guardando…</Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
