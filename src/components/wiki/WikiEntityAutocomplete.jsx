import { useMemo, useState } from "react";

import { Autocomplete, Box, TextField } from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";

import Fuse from "fuse.js";

import { CyberText } from "../customs/CustomTexts";

import { UI_COLORS } from "../../constants/uiColors";

import { WIKI_ENTITY_TYPE_LABELS } from "../../constants/wikiEntityTypes";



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



/**

 * Entity picker for NEURAL_LAB — excludes idioma; filters only the dropdown, never the graph.

 */

export default function WikiEntityAutocomplete({

    entities = [],

    onSelect,

    placeholder = "Buscar entidad…",

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

                top: compact ? 6 : 12,

                left: "50%",

                transform: "translateX(-50%)",

                width: compact ? "min(260px, calc(100% - 80px))" : "min(420px, calc(100% - 48px))",

                zIndex: 3,

                pointerEvents: "auto",

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

                        <Box>

                            <CyberText sx={{ fontSize: compact ? "0.72rem" : "0.8rem", color: UI_COLORS.textPrimary }}>

                                {option.title}

                            </CyberText>

                            <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary }}>

                                {WIKI_ENTITY_TYPE_LABELS[option.entityType] ?? option.entityType}

                            </CyberText>

                        </Box>

                    </Box>

                )}

                renderInput={(params) => (

                    <TextField

                        {...params}

                        placeholder={placeholder}

                        size="small"

                        InputProps={{

                            ...params.InputProps,

                            startAdornment: (

                                <SearchIcon

                                    sx={{

                                        color: UI_COLORS.textSecondary,

                                        fontSize: compact ? "0.85rem" : "1rem",

                                        ml: 0.35,

                                        mr: 0.35,

                                    }}

                                />

                            ),

                        }}

                        sx={{

                            "& .MuiOutlinedInput-root": {

                                bgcolor: `${UI_COLORS.backgroundSecondary}ee`,

                                backdropFilter: "blur(8px)",

                                color: UI_COLORS.textPrimary,

                                fontFamily: "'Fira Sans', sans-serif",

                                fontSize: compact ? "0.72rem" : "0.85rem",

                                minHeight: compact ? 28 : undefined,

                                "& input": { py: compact ? 0.35 : undefined },

                                "& fieldset": { borderColor: UI_COLORS.border },

                                "&:hover fieldset": { borderColor: `${UI_COLORS.anomaly}88` },

                                "&.Mui-focused fieldset": {

                                    borderColor: UI_COLORS.anomaly,

                                    boxShadow: `0 0 8px ${UI_COLORS.anomaly}33`,

                                },

                            },

                            "& input::placeholder": { color: UI_COLORS.textSecondary, opacity: 0.8 },

                        }}

                    />

                )}

                slotProps={{

                    paper: {

                        sx: {

                            bgcolor: UI_COLORS.backgroundSecondary,

                            border: `1px solid ${UI_COLORS.border}`,

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

