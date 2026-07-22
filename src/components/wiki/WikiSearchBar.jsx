import { useCallback, useRef, useMemo } from "react";

import { Box, InputBase, Chip, IconButton, Tooltip } from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";

import ClearIcon from "@mui/icons-material/Clear";

import FilterListIcon from "@mui/icons-material/FilterList";

import { CyberText } from "../customs/CustomTexts";

import { UI_COLORS } from "../../constants/uiColors";

import { WIKI_ARCHIVE_TYPE_OPTIONS } from "../../constants/wikiEntityTypes";

import {

    WIKI_AREA_IDS,

    WIKI_AREA_ENTITY_TYPES,

    normalizeWikiAreaFilter,

} from "../../constants/wiki";

import WikiAreaNav from "./WikiAreaNav";



/**

 * Search + filter bar for the wiki overlay.

 * Debounces query input at 200ms.

 * NEURAL_LAB hides text search and type chips (graph uses floating autocomplete).

 */

export default function WikiSearchBar({

    query,

    onQueryChange,

    typeFilter,

    onTypeFilterChange,

    areaFilter = null,

    onAreaFilterChange = null,

    showConfigButton = false,

    onOpenConfig = null,

    placeholder = "Buscar en el archivo...",

    compact = false,

    hideAreaNav = false,

}) {

    const debounceRef = useRef(null);

    const effectiveArea = normalizeWikiAreaFilter(areaFilter);

    const isNeuralLab = effectiveArea === WIKI_AREA_IDS.NEURAL_LAB;

    const isTimeline = effectiveArea === WIKI_AREA_IDS.TIMELINE;



    const visibleTypeOptions = useMemo(() => {

        const allowed = WIKI_AREA_ENTITY_TYPES[effectiveArea];

        if (!allowed) return WIKI_ARCHIVE_TYPE_OPTIONS;

        return WIKI_ARCHIVE_TYPE_OPTIONS.filter(({ value }) => allowed.includes(value));

    }, [effectiveArea]);



    const handleQueryInput = useCallback(

        (e) => {

            const value = e.target.value;

            if (debounceRef.current) clearTimeout(debounceRef.current);

            debounceRef.current = setTimeout(() => onQueryChange(value), 200);

        },

        [onQueryChange]

    );



    const clearQuery = () => {

        onQueryChange("");

        if (debounceRef.current) clearTimeout(debounceRef.current);

    };



    const searchField = !isNeuralLab && (

        <Box

            sx={{

                display: "flex",

                alignItems: "center",

                flex: compact ? 1 : undefined,

                minWidth: compact ? 120 : undefined,

                bgcolor: UI_COLORS.backgroundPrimary,

                border: `1px solid ${UI_COLORS.border}`,

                borderRadius: compact ? 0.75 : 1,

                px: compact ? 0.75 : 1.5,

                py: compact ? 0 : undefined,

                minHeight: compact ? 28 : undefined,

                "&:focus-within": {

                    borderColor: UI_COLORS.accent,

                    boxShadow: `0 0 6px ${UI_COLORS.accentGlow}`,

                },

                transition: "border-color 0.2s, box-shadow 0.2s",

            }}

        >

            <SearchIcon

                sx={{

                    color: UI_COLORS.textSecondary,

                    fontSize: compact ? "0.85rem" : "1rem",

                    mr: compact ? 0.5 : 1,

                }}

            />

            <InputBase

                defaultValue={query}

                onChange={handleQueryInput}

                placeholder={compact ? "Buscar..." : placeholder}

                fullWidth

                inputProps={{ "aria-label": "Buscar entidades wiki" }}

                sx={{

                    color: UI_COLORS.textPrimary,

                    fontFamily: "'Fira Sans', sans-serif",

                    fontSize: compact ? "0.75rem" : "0.85rem",

                    "& input::placeholder": { color: UI_COLORS.textSecondary, opacity: 0.7 },

                    "& input": { py: compact ? 0.35 : undefined },

                }}

            />

            {query && (

                <IconButton

                    size="small"

                    onClick={clearQuery}

                    sx={{ color: UI_COLORS.textSecondary, p: compact ? 0.25 : undefined }}

                >

                    <ClearIcon sx={{ fontSize: compact ? "0.8rem" : "0.9rem" }} />

                </IconButton>

            )}

        </Box>

    );



    const typeChips = !isNeuralLab && !isTimeline && onTypeFilterChange && (

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: compact ? 0.35 : 0.5, alignItems: "center" }}>

            <Tooltip title="Filtrar por tipo">

                <FilterListIcon sx={{ color: UI_COLORS.textSecondary, fontSize: compact ? "0.75rem" : "0.9rem" }} />

            </Tooltip>

            <Chip

                label={<CyberText sx={{ fontSize: compact ? "0.58rem" : "0.65rem", lineHeight: 1 }}>Todos</CyberText>}

                size="small"

                onClick={() => onTypeFilterChange("")}

                sx={chipSx(typeFilter === "", compact)}

            />

            {visibleTypeOptions.map(({ value, label }) => (

                <Chip

                    key={value}

                    label={

                        <CyberText sx={{ fontSize: compact ? "0.58rem" : "0.65rem", lineHeight: 1 }}>

                            {label}

                        </CyberText>

                    }

                    size="small"

                    onClick={() => onTypeFilterChange(typeFilter === value ? "" : value)}

                    sx={chipSx(typeFilter === value, compact)}

                />

            ))}

        </Box>

    );



    if (compact) {

        return (

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.375, flex: 1, minWidth: 0 }}>

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>

                    {!hideAreaNav && onAreaFilterChange && (

                        <WikiAreaNav

                            compact

                            areaFilter={areaFilter}

                            onAreaFilterChange={onAreaFilterChange}

                            showConfigButton={showConfigButton}

                            onOpenConfig={onOpenConfig}

                        />

                    )}

                    {searchField}

                </Box>

                {typeChips}

            </Box>

        );

    }



    return (

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>

            {onAreaFilterChange && (

                <WikiAreaNav

                    areaFilter={areaFilter}

                    onAreaFilterChange={onAreaFilterChange}

                    showConfigButton={showConfigButton}

                    onOpenConfig={onOpenConfig}

                />

            )}

            {searchField}

            {typeChips}

        </Box>

    );

}



function chipSx(active, compact) {

    return {

        bgcolor: active ? `${UI_COLORS.accent}22` : UI_COLORS.backgroundPrimary,

        border: `1px solid ${active ? UI_COLORS.accent : UI_COLORS.border}`,

        color: active ? UI_COLORS.accent : UI_COLORS.textSecondary,

        cursor: "pointer",

        transition: "border-color 0.15s, color 0.15s, background-color 0.15s",

        "&:hover": {

            borderColor: UI_COLORS.accent,

            color: UI_COLORS.accent,

        },

        "& .MuiChip-label": { px: compact ? 0.65 : 1 },

        height: compact ? 18 : 22,

    };

}

