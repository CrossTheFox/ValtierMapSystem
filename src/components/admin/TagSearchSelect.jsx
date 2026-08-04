import { useMemo, useState } from "react";
import {
    Autocomplete,
    Box,
    Chip,
    TextField,
    createFilterOptions,
} from "@mui/material";

import { UI_COLORS } from "../../constants/uiColors";
import { TAG_CATEGORIES, sanitizeTagKeys } from "../../constants/abilityKinds";
import { cyberMenuPaperSx, cyberMenuItemSx } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

const C = {
    pink: UI_COLORS.accent,
    cyan: UI_COLORS.anomaly,
    border: UI_COLORS.border,
    text: UI_COLORS.textPrimary,
    muted: UI_COLORS.textSecondary,
    bg: UI_COLORS.backgroundSecondary,
};

/** User-facing groups for the tag picker (Statuses / Positive effects / Simple). */
export const TAG_PICKER_GROUPS = Object.freeze({
    STATUSES: "Statuses",
    POSITIVE: "Positive effects",
    SIMPLE: "Simple",
});

export const TAG_PICKER_GROUP_LIST = Object.freeze(Object.values(TAG_PICKER_GROUPS));

/**
 * Map Firestore tag.category → picker group label.
 * @param {string} category
 */
export function tagPickerGroup(category) {
    const c = String(category || "").toLowerCase();
    if (c === TAG_CATEGORIES.STATUS || c === "statuses") return TAG_PICKER_GROUPS.STATUSES;
    if (c === TAG_CATEGORIES.EFFECT || c === "positive_effects" || c === "positive") {
        return TAG_PICKER_GROUPS.POSITIVE;
    }
    return TAG_PICKER_GROUPS.SIMPLE;
}

const baseFilter = createFilterOptions({
    stringify: (option) =>
        [
            option.label,
            option.key,
            option.category,
            option.summary,
            ...(option.aliases || []),
            tagPickerGroup(option.category),
        ]
            .filter(Boolean)
            .join(" "),
});

/**
 * Multi-select Autocomplete for combat tags — search + group by Statuses /
 * Positive effects / Simple. Selected chips stay visible above the field.
 *
 * @param {{
 *   available?: Array<{ id?: string, key: string, label?: string, category?: string, summary?: string, aliases?: string[] }>,
 *   value?: string[],
 *   onChange?: (keys: string[]) => void,
 *   disabled?: boolean,
 *   label?: string,
 * }} props
 */
export default function TagSearchSelect({
    available = [],
    value = [],
    onChange,
    disabled = false,
    label = "TAGS",
}) {
    const [groupFilter, setGroupFilter] = useState(null); // null = all
    const [inputValue, setInputValue] = useState("");

    const byKey = useMemo(() => {
        const map = new Map();
        for (const t of available) {
            if (t?.key) map.set(t.key, t);
        }
        return map;
    }, [available]);

    const selectedKeys = useMemo(() => sanitizeTagKeys(value), [value]);

    const selectedOptions = useMemo(
        () => selectedKeys.map((k) => byKey.get(k) || { key: k, label: k, category: "other" }),
        [selectedKeys, byKey],
    );

    const options = useMemo(() => {
        const list = [...available].filter((t) => t?.key);
        list.sort((a, b) => {
            const ga = tagPickerGroup(a.category);
            const gb = tagPickerGroup(b.category);
            const gi = TAG_PICKER_GROUP_LIST.indexOf(ga) - TAG_PICKER_GROUP_LIST.indexOf(gb);
            if (gi !== 0) return gi;
            return String(a.label || a.key).localeCompare(String(b.label || b.key));
        });
        return list;
    }, [available]);

    const filterOptions = (opts, state) => {
        let filtered = baseFilter(opts, state);
        if (groupFilter) {
            filtered = filtered.filter((o) => tagPickerGroup(o.category) === groupFilter);
        }
        return filtered;
    };

    const handleChange = (_e, next) => {
        onChange?.(sanitizeTagKeys(next.map((o) => o.key)));
    };

    if (!available.length) {
        return (
            <Box sx={{ fontSize: "0.65rem", color: C.muted, mb: 1 }}>
                Sin tags en catálogo — seed:icon-tags o VTT Configs → Tags
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 1 }} onClick={(e) => e.stopPropagation()}>
            <Box
                sx={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "0.52rem",
                    letterSpacing: "0.12em",
                    color: C.muted,
                    mb: 0.6,
                }}
            >
                {label}
            </Box>

            {/* Group filter chips */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
                <Box
                    component="button"
                    type="button"
                    disabled={disabled}
                    onClick={() => setGroupFilter(null)}
                    sx={groupChipSx(groupFilter == null)}
                >
                    All
                </Box>
                {TAG_PICKER_GROUP_LIST.map((g) => (
                    <Box
                        key={g}
                        component="button"
                        type="button"
                        disabled={disabled}
                        onClick={() => setGroupFilter((prev) => (prev === g ? null : g))}
                        sx={groupChipSx(groupFilter === g, g)}
                    >
                        {g}
                    </Box>
                ))}
            </Box>

            <Autocomplete
                multiple
                disableCloseOnSelect
                disabled={disabled}
                options={options}
                value={selectedOptions}
                onChange={handleChange}
                inputValue={inputValue}
                onInputChange={(_e, v) => setInputValue(v)}
                filterOptions={filterOptions}
                groupBy={(option) => tagPickerGroup(option.category)}
                getOptionLabel={(option) => option.label || option.key || ""}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                noOptionsText={
                    <Box sx={{ color: C.muted, fontSize: "0.75rem", fontFamily: "'Fira Sans', sans-serif" }}>
                        Sin coincidencias
                    </Box>
                }
                slotProps={{
                    paper: {
                        sx: {
                            ...cyberMenuPaperSx,
                            mt: 0.5,
                            overflow: "hidden",
                            // Scroll lives only on listbox — avoid dual bars (Paper + ul).
                            "& .MuiAutocomplete-listbox": {
                                maxHeight: 280,
                                overflowY: "auto",
                                overflowX: "hidden",
                                p: 0,
                                ...CYBER_SCROLL_STYLE,
                            },
                            "& .MuiAutocomplete-groupUl": {
                                p: 0,
                                m: 0,
                            },
                            "& .MuiAutocomplete-option": {
                                ...cyberMenuItemSx,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.78rem",
                                minHeight: 36,
                                py: 0.75,
                            },
                        },
                    },
                }}
                renderGroup={(params) => {
                    const accent = groupAccent(params.group);
                    return (
                        <li key={params.key} style={{ listStyle: "none" }}>
                            <Box
                                sx={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 2,
                                    px: 1.25,
                                    py: 0.55,
                                    bgcolor: UI_COLORS.backgroundPrimary,
                                    color: accent,
                                    fontFamily: "Orbitron, sans-serif",
                                    fontSize: "0.58rem",
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    borderBottom: `1px solid ${accent}55`,
                                    borderLeft: `3px solid ${accent}`,
                                    boxShadow: `0 4px 12px rgba(0,0,0,0.45)`,
                                }}
                            >
                                {params.group}
                            </Box>
                            <ul className="MuiAutocomplete-groupUl" style={{ padding: 0, margin: 0 }}>
                                {params.children}
                            </ul>
                        </li>
                    );
                }}
                renderOption={(props, option, { selected }) => {
                    const { key, ...rest } = props;
                    return (
                        <Box
                            component="li"
                            key={key}
                            {...rest}
                            sx={{
                                display: "flex !important",
                                flexDirection: "column",
                                alignItems: "flex-start !important",
                                gap: "2px",
                            }}
                        >
                            <Box sx={{ display: "flex", width: "100%", justifyContent: "space-between", gap: 1 }}>
                                <Box component="span" sx={{ color: selected ? C.cyan : C.text, fontWeight: selected ? 600 : 400 }}>
                                    {option.label || option.key}
                                </Box>
                                <Box
                                    component="span"
                                    sx={{
                                        fontFamily: "'Fira Code', monospace",
                                        fontSize: "0.55rem",
                                        color: C.muted,
                                        flexShrink: 0,
                                    }}
                                >
                                    {option.key}
                                </Box>
                            </Box>
                            {option.summary && (
                                <Box
                                    component="span"
                                    sx={{
                                        fontSize: "0.65rem",
                                        color: C.muted,
                                        lineHeight: 1.3,
                                        whiteSpace: "normal",
                                    }}
                                >
                                    {option.summary}
                                </Box>
                            )}
                        </Box>
                    );
                }}
                renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                        const { key, ...tagProps } = getTagProps({ index });
                        return (
                            <Chip
                                key={key}
                                {...tagProps}
                                size="small"
                                label={option.label || option.key}
                                sx={{
                                    height: 22,
                                    fontFamily: "'Fira Code', monospace",
                                    fontSize: "0.58rem",
                                    color: C.text,
                                    bgcolor: `${C.cyan}18`,
                                    border: `1px solid ${C.cyan}66`,
                                    "& .MuiChip-deleteIcon": {
                                        color: C.muted,
                                        fontSize: "0.9rem",
                                        "&:hover": { color: C.pink },
                                    },
                                }}
                            />
                        );
                    })
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={selectedKeys.length ? "Buscar más tags…" : "Buscar tag o categoría…"}
                        size="small"
                        sx={{
                            "& .MuiOutlinedInput-root": {
                                bgcolor: "rgba(0,0,0,0.45)",
                                color: C.text,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.78rem",
                                borderRadius: "4px",
                                "& fieldset": { borderColor: C.border },
                                "&:hover fieldset": { borderColor: `${C.pink}88` },
                                "&.Mui-focused fieldset": {
                                    borderColor: C.cyan,
                                    boxShadow: `0 0 10px ${C.cyan}22`,
                                },
                            },
                            "& .MuiInputBase-input": {
                                color: C.text,
                                "&::placeholder": { color: "rgba(255,255,255,0.35)", opacity: 1 },
                            },
                        }}
                    />
                )}
            />
        </Box>
    );
}

function groupAccent(group) {
    if (group === TAG_PICKER_GROUPS.STATUSES) return UI_COLORS.accentStrong;
    if (group === TAG_PICKER_GROUPS.POSITIVE) return C.cyan;
    if (group === TAG_PICKER_GROUPS.SIMPLE) return C.pink;
    return C.cyan;
}

function groupChipSx(active, group = null) {
    const accent = groupAccent(group);
    return {
        px: 0.9,
        py: 0.35,
        borderRadius: "4px",
        border: `1px solid ${active ? accent : C.border}`,
        bgcolor: active ? `${accent}18` : "transparent",
        color: active ? accent : C.muted,
        fontFamily: "Orbitron, sans-serif",
        fontSize: "0.52rem",
        letterSpacing: "0.06em",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s, color 0.15s",
        "&:hover": { borderColor: accent, color: accent },
        "&:disabled": { opacity: 0.45, cursor: "default" },
    };
}
