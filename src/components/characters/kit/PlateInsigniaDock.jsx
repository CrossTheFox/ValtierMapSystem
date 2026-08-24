import { useState } from "react";
import { Box, MenuItem, Popover } from "@mui/material";
import { UI_COLORS } from "../../../constants/uiColors";
import { DAMAGE_DIE_OPTIONS } from "../../../constants/combatStats";
import { resolveCharacterAp, resolveCharacterLevel } from "../../../constants/skillTreeProgression";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../../constants/designSystem";
import CyberSelect from "../../customs/CyberSelect";
import { DebouncedBoxInput } from "../../customs/DebouncedField";
import {
    KitSvgApStar,
    KitSvgArm,
    KitSvgBriefcase,
    KitSvgDef,
    KitSvgDie,
    KitSvgFray,
    KitSvgSpd,
    KitSvgSwap,
    KitSvgVit,
} from "../../../constants/kitSvg";

const CYAN = UI_COLORS.anomaly;
const PINK = UI_COLORS.accent;
const PINK_S = UI_COLORS.accentStrong;
const GOLD = UI_COLORS.loot;
const TEXT = UI_COLORS.textPrimary;
const MUTED = UI_COLORS.textSecondary;

const STAT_ICONS = {
    vit: KitSvgVit,
    defense: KitSvgDef,
    speed: KitSvgSpd,
    fray: KitSvgFray,
    damageDie: KitSvgDie,
    armor: KitSvgArm,
};

const PLATE_STAT_KEYS = ["vit", "defense", "speed", "fray", "damageDie", "armor"];
const PLATE_STAT_META = {
    vit: { label: "VIT" },
    defense: { label: "DEF" },
    speed: { label: "SPD" },
    fray: { label: "FRAY" },
    damageDie: { label: "DIE" },
    armor: { label: "ARM" },
};

const HIDE_SPIN = {
    "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": { WebkitAppearance: "none", margin: 0 },
    MozAppearance: "textfield",
};

function PlateStatCell({ statKey, value, display, editMode, isOverride, onChange }) {
    const meta = PLATE_STAT_META[statKey];
    const Icon = STAT_ICONS[statKey];
    const isDie = statKey === "damageDie";
    const [editing, setEditing] = useState(false);
    const showEditor = editMode && editing && !isDie;

    const cellSx = {
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gridTemplateRows: "auto auto",
        gridTemplateAreas: `"ico val" "key val"`,
        alignItems: "center",
        columnGap: "5px",
        rowGap: "1px",
        minHeight: 48,
        p: "5px 7px 5px 5px",
        borderRadius: "4px",
        border: `1px solid ${isDie ? "rgba(245,197,66,0.35)" : isOverride ? "rgba(255,102,255,0.45)" : "rgba(0,242,234,0.28)"}`,
        background: isDie
            ? "linear-gradient(180deg, rgba(245,197,66,0.1), transparent 55%), rgba(0,0,0,0.4)"
            : "linear-gradient(180deg, rgba(0,242,234,0.1), transparent 55%), rgba(0,0,0,0.4)",
        cursor: editMode && !isDie ? "pointer" : "default",
    };

    return (
        <Box
            sx={cellSx}
            onClick={() => { if (editMode && !isDie && !editing) setEditing(true); }}
        >
            <Box sx={{
                gridArea: "ico",
                width: isDie ? 22 : 15,
                height: isDie ? 22 : 15,
                color: isDie ? GOLD : CYAN,
                filter: isDie ? "drop-shadow(0 0 6px rgba(245,197,66,0.45))" : "none",
            }}>
                {Icon && <Icon size={isDie ? 22 : 15} />}
            </Box>
            <Box sx={{
                gridArea: "key",
                fontFamily: "Orbitron, sans-serif",
                fontSize: isDie ? "0.44rem" : "0.4rem",
                letterSpacing: "0.1em",
                color: isDie ? "rgba(245,197,66,0.9)" : "rgba(0,242,234,0.9)",
                lineHeight: 1,
            }}>
                {meta.label}
            </Box>
            <Box sx={{
                gridArea: "val",
                justifySelf: "end",
                alignSelf: "center",
                fontFamily: "Orbitron, sans-serif",
                fontSize: isDie ? "1.2rem" : "0.92rem",
                fontWeight: isDie ? 600 : 400,
                color: isDie ? GOLD : TEXT,
                lineHeight: 1,
                textShadow: isDie ? "0 0 10px rgba(245,197,66,0.35)" : "none",
            }}>
                {isDie ? (
                    editMode ? (
                        <CyberSelect
                            value={value === "" || value == null ? "" : String(value)}
                            options={[
                                { value: "", label: "heredado" },
                                ...DAMAGE_DIE_OPTIONS.map((d) => ({ value: String(d), label: `d${d}` })),
                            ]}
                            onChange={(next) => onChange(next === "" ? "" : Number(next))}
                            placeholder={`d${display}`}
                            triggerSx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "1.2rem",
                                fontWeight: 600,
                                color: GOLD,
                                minWidth: "3.8rem",
                                justifyContent: "flex-end",
                                border: "none",
                                bgcolor: "transparent",
                                textShadow: "0 0 10px rgba(245,197,66,0.35)",
                            }}
                        />
                    ) : `d${display}`
                ) : showEditor ? (
                    <Box
                        component="input"
                        type="number"
                        autoFocus
                        value={value === "" || value == null ? "" : value}
                        placeholder={String(display)}
                        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={() => setEditing(false)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                setEditing(false);
                            }
                        }}
                        sx={{
                            width: "2.4em",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: TEXT,
                            font: "inherit",
                            textAlign: "center",
                            ...HIDE_SPIN,
                            "&::placeholder": { color: "rgba(255,255,255,0.4)", opacity: 1 },
                        }}
                    />
                ) : display}
            </Box>
        </Box>
    );
}

function ResourceChip({ name, value, max, onChangeValue }) {
    const [editing, setEditing] = useState(false);
    const title = (name || "RESOURCE").toUpperCase();
    const hasMax = max != null;

    return (
        <Box
            sx={{
                height: 48,
                minHeight: 48,
                maxHeight: 48,
                flex: "1 1 auto",
                minWidth: 0,
                px: "10px",
                py: "5px",
                border: "1px solid rgba(0,242,234,0.25)",
                borderRadius: "5px",
                bgcolor: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                overflow: "hidden",
            }}
        >
            <Box sx={{
                flex: 1,
                minWidth: 0,
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.62rem",
                letterSpacing: "0.12em",
                color: CYAN,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.15,
            }}>
                {title}
            </Box>
            <Box
                onClick={() => { if (onChangeValue) setEditing(true); }}
                sx={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "1px",
                    flexShrink: 0,
                    cursor: onChangeValue ? "pointer" : "default",
                    fontFamily: "Orbitron, sans-serif",
                    lineHeight: 1,
                }}
            >
                {editing ? (
                    <Box
                        component="input"
                        type="number"
                        autoFocus
                        value={value}
                        onChange={(e) => onChangeValue(e.target.value)}
                        onBlur={() => setEditing(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") {
                                e.preventDefault();
                                setEditing(false);
                            }
                        }}
                        sx={{
                            width: "2.2em",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: TEXT,
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "1.15rem",
                            textAlign: "right",
                            ...HIDE_SPIN,
                        }}
                    />
                ) : (
                    <Box component="span" sx={{
                        fontSize: "1.15rem",
                        color: TEXT,
                        textShadow: "0 0 10px rgba(0,242,234,0.25)",
                    }}>
                        {value}
                    </Box>
                )}
                {hasMax && (
                    <>
                        <Box component="span" sx={{ fontSize: "0.55rem", color: MUTED, mx: "2px" }}>/</Box>
                        <Box component="span" sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)" }}>{max}</Box>
                    </>
                )}
            </Box>
        </Box>
    );
}

function MaletinBtn({ open, count = 0, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            title={open ? "Cerrar maletín" : "Maletín"}
            aria-label="Maletín"
            aria-expanded={Boolean(open)}
            onClick={onClick}
            sx={{
                position: "relative",
                width: 48,
                height: 48,
                borderRadius: "5px",
                border: `1px solid ${open ? GOLD : "rgba(245,197,66,0.55)"}`,
                bgcolor: open ? "rgba(245,197,66,0.28)" : "rgba(245,197,66,0.1)",
                color: GOLD,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                cursor: "pointer",
                boxShadow: "0 0 12px rgba(245,197,66,0.18)",
                p: 0,
                "&:hover": { bgcolor: "rgba(245,197,66,0.22)" },
            }}
        >
            <KitSvgBriefcase size={20} />
            {count > 0 && (
                <Box
                    component="span"
                    sx={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 14,
                        height: 14,
                        px: "3px",
                        borderRadius: "999px",
                        bgcolor: GOLD,
                        color: "#1a1408",
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.4rem",
                        display: "grid",
                        placeItems: "center",
                    }}
                >
                    {count > 99 ? "99+" : count}
                </Box>
            )}
        </Box>
    );
}

/**
 * Insignia Dock Large — 12-col plate inside `.dossier-shell`:
 * ID+LV+name+job+AP (3) · VIT DEF SPD FRAY DIE ARM (6) · resource + maletín (3).
 */
export default function PlateInsigniaDock({
    character,
    combatStats,
    overrides = {},
    editMode,
    onChangeStat,
    onChangeName,
    onChangeLevel,
    onChangeAp,
    jobDisplayName,
    jobs = [],
    activeClassId,
    onSelectJob,
    onAssignJob,
    campaignJobs = [],
    kitEdit = false,
    isDM = false,
    onCreateJob,
    resource,
    resourceValue,
    onChangeResourceValue,
    maletinOpen,
    maletinCount = 0,
    onToggleMaletin,
}) {
    const level = resolveCharacterLevel(character);
    const ap = resolveCharacterAp(character);
    const [jobAnchor, setJobAnchor] = useState(null);

    return (
        <Box
            className="dialog-no-drag"
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gap: "8px",
                alignItems: "center",
                px: "12px",
                pt: "7px",
                pb: "8px",
                "@media (max-width:960px)": { gridTemplateColumns: "1fr" },
            }}
        >
            <Box sx={{
                gridColumn: "span 3",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                "@media (max-width:960px)": { gridColumn: "1 / -1" },
            }}>
                <Box sx={{
                    width: 52,
                    height: 52,
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: `2px solid ${CYAN}`,
                    background: "radial-gradient(circle at 40% 35%, rgba(0,242,234,0.22), #041314 70%)",
                    boxShadow: "0 0 0 3px rgba(0,242,234,0.12), 0 0 16px rgba(0,242,234,0.25)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Box sx={{
                        fontFamily: "Orbitron, sans-serif",
                        fontSize: "0.36rem",
                        letterSpacing: "0.14em",
                        color: "#041314",
                        background: "linear-gradient(180deg, #5ffbf5, #00f2ea)",
                        px: "4px",
                        pt: "1px",
                        borderRadius: "2px",
                        lineHeight: 1.1,
                        mb: "1px",
                    }}>
                        LV
                    </Box>
                    <Box
                        component="input"
                        type="number"
                        min={0}
                        max={12}
                        title="Nivel"
                        value={level}
                        onChange={(e) => {
                            const n = Math.max(0, Math.min(12, Math.floor(Number(e.target.value) || 0)));
                            onChangeLevel?.(n);
                        }}
                        sx={{
                            width: "1.4em",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.95rem",
                            color: TEXT,
                            textAlign: "center",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            p: 0,
                            lineHeight: 1,
                            ...HIDE_SPIN,
                        }}
                    />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <DebouncedBoxInput
                        value={character?.name ?? ""}
                        onCommit={(next) => onChangeName?.(next)}
                        placeholder="NOMBRE"
                        spellCheck={false}
                        sx={{
                            width: "100%",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.78rem",
                            letterSpacing: "0.1em",
                            color: TEXT,
                            textTransform: "uppercase",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            p: 0,
                            "&::placeholder": { color: "rgba(255,255,255,0.35)" },
                        }}
                    />                    <Box sx={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                        <Box
                            component="button"
                            type="button"
                            title="Cambiar job"
                            onClick={(e) => setJobAnchor(e.currentTarget)}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                px: "8px",
                                py: "4px",
                                borderRadius: "4px",
                                border: "1px solid rgba(255,102,255,0.45)",
                                bgcolor: "rgba(255,102,255,0.1)",
                                color: PINK,
                                cursor: "pointer",
                                minWidth: 0,
                                maxWidth: "100%",
                            }}
                        >
                            <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: PINK, flexShrink: 0 }} />
                            <Box sx={{
                                fontFamily: "Orbitron, sans-serif",
                                fontSize: "0.48rem",
                                letterSpacing: "0.1em",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}>
                                {(jobDisplayName || "SIN JOB").toUpperCase()}
                            </Box>
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            title="Cambiar job"
                            onClick={(e) => setJobAnchor(e.currentTarget)}
                            sx={{
                                width: 26,
                                height: 26,
                                display: "grid",
                                placeItems: "center",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: "3px",
                                bgcolor: "transparent",
                                color: MUTED,
                                cursor: "pointer",
                                p: 0,
                                flexShrink: 0,
                                "&:hover": { color: CYAN, borderColor: CYAN },
                            }}
                        >
                            <KitSvgSwap size={13} />
                        </Box>
                    </Box>
                </Box>
                <Box
                    title="AP"
                    sx={{
                        position: "relative",
                        width: 56,
                        height: 52,
                        flexShrink: 0,
                        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                        background: "linear-gradient(135deg, rgba(255,102,255,0.5), rgba(255,20,147,0.3))",
                        boxShadow: "0 0 14px rgba(255,102,255,0.32)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1px",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: "2px",
                            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                            bgcolor: "#0a0a12",
                        },
                    }}
                >
                    <Box sx={{ position: "relative", zIndex: 1, color: PINK, width: 13, height: 13 }}>
                        <KitSvgApStar size={13} />
                    </Box>
                    <Box
                        component="input"
                        type="number"
                        min={0}
                        title="Ability Points"
                        value={ap}
                        onChange={(e) => {
                            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            onChangeAp?.(n);
                        }}
                        sx={{
                            position: "relative",
                            zIndex: 1,
                            width: "2em",
                            fontFamily: "Orbitron, sans-serif",
                            fontSize: "0.72rem",
                            color: PINK_S,
                            textAlign: "center",
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            p: 0,
                            lineHeight: 1,
                            ...HIDE_SPIN,
                        }}
                    />
                </Box>
            </Box>

            <Box sx={{
                gridColumn: "span 6",
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: "4px",
                "@media (max-width:960px)": { gridColumn: "1 / -1", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" },
            }}>
                {PLATE_STAT_KEYS.map((key) => (
                    <PlateStatCell
                        key={key}
                        statKey={key}
                        value={overrides[key] ?? ""}
                        display={combatStats?.[key] ?? 0}
                        editMode={editMode}
                        isOverride={overrides[key] != null}
                        onChange={(raw) => onChangeStat(key, raw)}
                    />
                ))}
            </Box>

            <Box sx={{
                gridColumn: "span 3",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                justifyContent: "flex-end",
                "@media (max-width:960px)": { gridColumn: "1 / -1" },
            }}>
                <ResourceChip
                    name={resource?.name}
                    value={resourceValue ?? resource?.min ?? 0}
                    max={resource?.max}
                    onChangeValue={onChangeResourceValue}
                />
                <MaletinBtn open={maletinOpen} count={maletinCount} onClick={onToggleMaletin} />
            </Box>

            <Popover
                open={Boolean(jobAnchor)}
                anchorEl={jobAnchor}
                onClose={() => setJobAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: {
                            ...cyberMenuPaperSx,
                            minWidth: 220,
                            maxHeight: 280,
                            overflow: "auto",
                            ...CYBER_SCROLL_STYLE,
                        },
                    },
                }}
            >
                {jobs.length === 0 && (
                    <MenuItem disabled sx={cyberMenuItemSx}>Sin clases asignadas</MenuItem>
                )}
                {jobs.map((job) => {
                    const active = job.classId === activeClassId;
                    return (
                        <MenuItem
                            key={job.classId}
                            selected={active}
                            sx={cyberMenuItemSx}
                            onClick={(e) => {
                                onSelectJob?.(e, job.classId);
                                setJobAnchor(null);
                            }}
                        >
                            {(job.label || job.classId).toUpperCase()}
                            {active ? " · ACTIVE" : ""}
                        </MenuItem>
                    );
                })}
                {kitEdit && (
                    <>
                        <Box sx={{ px: 1, py: 0.75 }}>
                            <CyberSelect
                                value=""
                                onChange={(next) => {
                                    if (next) {
                                        onAssignJob?.(next);
                                        setJobAnchor(null);
                                    }
                                }}
                                options={campaignJobs.map((j) => ({
                                    value: j.id,
                                    label: `${(j.displayName || j.id).toUpperCase()}${j.status === "proposed" ? " · PROPUESTO" : ""}`,
                                }))}
                                placeholder="+ ASIGNAR"
                            />
                        </Box>
                        <MenuItem
                            sx={{ ...cyberMenuItemSx, color: `${PINK} !important` }}
                            onClick={() => {
                                onCreateJob?.();
                                setJobAnchor(null);
                            }}
                        >
                            {isDM ? "+ CREAR JOB" : "+ PROPONER JOB"}
                        </MenuItem>
                    </>
                )}
            </Popover>
        </Box>
    );
}
