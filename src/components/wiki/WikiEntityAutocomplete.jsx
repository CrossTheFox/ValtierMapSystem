import { useMemo, useState } from "react";
import { Autocomplete, Box, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import Fuse from "fuse.js";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { Z_INDEX } from "../../constants/designSystem";
import { WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";
import { WikiToVttLinkBadge } from "./VttWikiLinkBadge";

const FUSE_OPTIONS = {
    keys: [
        { name: "title", weight: 3 },
        { name: "summary", weight: 2 },
        { name: "tags", weight: 2 },
        { name: "slug", weight: 1 },
    ],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 2,
};

const HUD_BG = "rgba(10,10,20,0.85)";

/**
 * Entity picker for NEURAL_LAB — searches only the entities passed in
 * (typically those currently visible via the graph legend filters).
 */
export default function WikiEntityAutocomplete({
    entities = [],
    onSelect,
    placeholder = "Buscar nodo…",
    compact = true,
}) {
    const [inputValue, setInputValue] = useState("");

    const fuse = useMemo(
        () => (entities.length > 0 ? new Fuse(entities, FUSE_OPTIONS) : null),
        [entities]
    );

    const options = useMemo(() => {
        const q = inputValue.trim();
        if (q.length < 2 || !fuse) return [];
        return fuse.search(q).map((r) => r.item).slice(0, 12);
    }, [inputValue, fuse]);

    return (
        <Box
            sx={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: compact ? "min(300px, calc(100% - 200px))" : "min(420px, calc(100% - 48px))",
                zIndex: 5,
                pointerEvents: "auto",
                bgcolor: HUD_BG,
                backdropFilter: "blur(12px)",
                border: `1px solid ${UI_COLORS.border}`,
                borderRadius: "8px",
                px: 1.25,
                py: 0.5,
            }}
        >
            <Autocomplete
                freeSolo
                options={options}
                inputValue={inputValue}
                onInputChange={(_e, value) => setInputValue(value)}
                onChange={(_e, value) => {
                    if (value && typeof value === "object") {
                        onSelect?.(value);
                        setInputValue("");
                    }
                }}
                getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.title ?? "")}
                isOptionEqualToValue={(a, b) => a?.id === b?.id}
                filterOptions={(x) => x}
                noOptionsText={
                    inputValue.trim().length < 2
                        ? "Escribe al menos 2 caracteres"
                        : "Sin coincidencias"
                }
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.id}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, width: "100%" }}>
                            <Box sx={{ minWidth: 0 }}>
                                <CyberText sx={{ fontSize: compact ? "0.72rem" : "0.8rem", color: UI_COLORS.textPrimary }}>
                                    {option.title}
                                </CyberText>
                                <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>
                                    {WIKI_ENTITY_TYPE_LABELS[option.entityType] ?? option.entityType}
                                </CyberText>
                            </Box>
                            <WikiToVttLinkBadge entity={option} compact />
                        </Box>
                    </Box>
                )}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={placeholder}
                        size="small"
                        variant="standard"
                        InputProps={{
                            ...params.InputProps,
                            disableUnderline: true,
                            startAdornment: (
                                <SearchIcon
                                    sx={{
                                        color: UI_COLORS.textSecondary,
                                        fontSize: compact ? "0.9rem" : "1rem",
                                        mr: 0.5,
                                    }}
                                />
                            ),
                        }}
                        sx={{
                            "& .MuiInputBase-root": {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Code', monospace",
                                fontSize: compact ? "0.68rem" : "0.78rem",
                                minHeight: compact ? 26 : 32,
                                "& input": { py: 0.25 },
                            },
                            "& input::placeholder": { color: UI_COLORS.textSecondary, opacity: 0.8 },
                        }}
                    />
                )}
                slotProps={{
                    popper: {
                        sx: { zIndex: Z_INDEX.wikiLabMenu },
                    },
                    paper: {
                        sx: {
                            bgcolor: UI_COLORS.backgroundSecondary,
                            border: `1px solid ${UI_COLORS.border}`,
                            zIndex: Z_INDEX.wikiLabMenu,
                            "& .MuiAutocomplete-option": {
                                minHeight: compact ? 32 : 40,
                                py: compact ? 0.35 : undefined,
                                "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                                "&[aria-selected='true']": { bgcolor: `${UI_COLORS.anomaly}18` },
                            },
                        },
                    },
                }}
            />
        </Box>
    );
}
