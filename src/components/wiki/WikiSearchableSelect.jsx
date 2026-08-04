import { Autocomplete, Box, Chip, TextField, Tooltip, createFilterOptions } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { CyberText } from "../customs/CustomTexts";
import { wikiEditorInputSx, WIKI_EDITOR_MENU_Z } from "../../constants/wikiEditorStyles";
import { tooltipSlotProps } from "./WikiFieldInfoTip";

const filterOptions = createFilterOptions({
    matchFrom: "any",
    limit: 80,
    stringify: (option) => `${option.label || ""} ${option.sublabel || ""}`,
});

const autocompletePaperSx = {
    bgcolor: UI_COLORS.backgroundSecondary,
    border: `1px solid ${UI_COLORS.border}`,
    zIndex: WIKI_EDITOR_MENU_Z,
    "& .MuiAutocomplete-option": {
        minHeight: 36,
        "&:hover": { bgcolor: `${UI_COLORS.accent}10` },
        "&[aria-selected='true']": { bgcolor: `${UI_COLORS.accent}18` },
    },
};

const autocompleteSx = {
    ...wikiEditorInputSx,
    minWidth: 0,
    "& .MuiAutocomplete-input": { color: UI_COLORS.textPrimary },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

/**
 * Searchable single-select for enum options or entity references.
 * @param {{ label: string, value: string, onChange: (v: string) => void, options: { value: string, label: string, sublabel?: string, tooltip?: string }[], minWidth?: number, clearable?: boolean, clearLabel?: string, placeholder?: string, flex?: number }} props
 */
export default function WikiSearchableSelect({
    label,
    value,
    onChange,
    options = [],
    minWidth = 160,
    flex,
    clearable = true,
    clearLabel = "—",
    placeholder = "Buscar…",
}) {
    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <Autocomplete
            size="small"
            sx={{ minWidth, flex: flex ?? 1 }}
            options={options}
            value={selected}
            disableClearable={!clearable}
            onChange={(_, opt) => onChange(opt?.value ?? (clearable ? "" : value))}
            getOptionLabel={(opt) => opt?.label || ""}
            isOptionEqualToValue={(a, b) => a?.value === b?.value}
            filterOptions={filterOptions}
            noOptionsText="Sin coincidencias"
            slotProps={{
                popper: { sx: { zIndex: WIKI_EDITOR_MENU_Z } },
                paper: { sx: autocompletePaperSx },
            }}
            renderOption={(props, option) => {
                const row = (
                    <Box
                        component="li"
                        {...props}
                        key={option.value}
                        sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.15, py: 0.75 }}
                    >
                        <CyberText sx={{ fontSize: "0.82rem", color: UI_COLORS.textPrimary, lineHeight: 1.25 }}>
                            {option.label}
                        </CyberText>
                        {option.sublabel && (
                            <CyberText sx={{ fontSize: "0.62rem", color: UI_COLORS.textSecondary, lineHeight: 1.2 }}>
                                {option.sublabel}
                            </CyberText>
                        )}
                    </Box>
                );
                if (option.tooltip) {
                    return (
                        <Tooltip title={option.tooltip} placement="right" slotProps={tooltipSlotProps}>
                            {row}
                        </Tooltip>
                    );
                }
                return row;
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    sx={autocompleteSx}
                />
            )}
        />
    );
}

/**
 * Searchable multi-select (entity refs, tags from predefined list, etc.)
 */
export function WikiSearchableMultiSelect({
    label,
    value = [],
    onChange,
    options = [],
    minWidth = 200,
    placeholder = "Buscar…",
}) {
    const selected = options.filter((o) => value.includes(o.value));

    return (
        <Autocomplete
            multiple
            size="small"
            sx={{ minWidth, flex: 1 }}
            options={options}
            value={selected}
            onChange={(_, opts) => onChange(opts.map((o) => o.value))}
            getOptionLabel={(opt) => opt?.label || ""}
            isOptionEqualToValue={(a, b) => a?.value === b?.value}
            filterOptions={filterOptions}
            noOptionsText="Sin coincidencias"
            slotProps={{
                popper: { sx: { zIndex: WIKI_EDITOR_MENU_Z } },
                paper: { sx: autocompletePaperSx },
            }}
            renderTags={(tagValue, getTagProps) =>
                tagValue.map((option, index) => (
                    <Chip
                        {...getTagProps({ index })}
                        key={option.value}
                        size="small"
                        label={<CyberText sx={{ fontSize: "0.6rem" }}>{option.label}</CyberText>}
                        sx={{ height: 20, bgcolor: `${UI_COLORS.accent}18`, color: UI_COLORS.textPrimary }}
                    />
                ))
            }
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    placeholder={placeholder}
                    sx={autocompleteSx}
                />
            )}
        />
    );
}

/** Build { value, label }[] from enum options array. */
export function enumToSearchOptions(options, tooltips = {}) {
    return options.map(({ value, label }) => ({
        value,
        label,
        tooltip: tooltips[value] || undefined,
    }));
}

/** Build searchable options from wiki entities. */
export function entitiesToSearchOptions(entities, entityType) {
    return entities
        .filter((e) => !entityType || e.entityType === entityType)
        .map((e) => ({ value: e.id, label: e.title }))
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
}
