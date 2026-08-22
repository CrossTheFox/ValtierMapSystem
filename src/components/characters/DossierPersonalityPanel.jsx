/**
 * NAR RED — personality fields for the linked wiki PERSONAJE.
 */

import { useState } from "react";
import { Box, Chip, FormControl, MenuItem, Select, TextField } from "@mui/material";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import {
    BOND_NOTES_FIELD_HELP,
    NARRATIVE_PERSONALITY_SECTION_HELP,
    NARRATIVE_STATE_FIELD_HELP,
    NARRATIVE_STATE_OPTIONS,
    NARRATIVE_STATE_TOOLTIPS,
    NARRATIVE_TRAITS_EXAMPLES,
    NARRATIVE_TRAITS_FIELD_HELP,
    REACTION_ARCHETYPE_FIELD_HELP,
    REACTION_ARCHETYPE_OPTIONS,
    REACTION_ARCHETYPE_TOOLTIPS,
    STRESS_RESPONSE_FIELD_HELP,
    STRESS_RESPONSE_OPTIONS,
    STRESS_RESPONSE_TOOLTIPS,
} from "../../constants/wiki/entityFieldSchemas";

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

const selectSx = {
    color: UI_COLORS.textPrimary,
    fontFamily: '"Fira Code", monospace',
    fontSize: "0.72rem",
    bgcolor: "rgba(8,8,14,0.55)",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${NAR_ACCENT}66` },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: NAR_ACCENT },
    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
};

function EnumField({ label, help, value, options, tooltips, onChange }) {
    return (
        <Box sx={{ flex: 1, minWidth: 160 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.4 }}>
                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, fontWeight: 600 }}>
                    {label}
                </CyberText>
                {help ? (
                    <CyberTooltip title={help}>
                        <Box
                            component="span"
                            sx={{
                                fontSize: "0.55rem",
                                color: UI_COLORS.textSecondary,
                                border: `1px solid ${UI_COLORS.border}`,
                                px: 0.4,
                                borderRadius: "2px",
                                cursor: "help",
                            }}
                        >
                            ?
                        </Box>
                    </CyberTooltip>
                ) : null}
            </Box>
            <FormControl fullWidth size="small">
                <Select
                    value={value || ""}
                    displayEmpty
                    onChange={(e) => onChange(e.target.value || "")}
                    sx={selectSx}
                    MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                >
                    <MenuItem value="" sx={cyberMenuItemSx}>
                        <em style={{ color: UI_COLORS.textSecondary }}>Sin definir</em>
                    </MenuItem>
                    {options.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} sx={cyberMenuItemSx}>
                            <CyberTooltip title={tooltips?.[opt.value] || ""} placement="right">
                                <span>{opt.label}</span>
                            </CyberTooltip>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </Box>
    );
}

/**
 * @param {{
 *   ficha: object,
 *   patchFicha: (partial: object) => void,
 *   addTrait: (raw: string) => void,
 *   removeTrait: (t: string) => void,
 *   flushSave?: () => void,
 * }} props
 */
export default function DossierPersonalityPanel({
    ficha,
    patchFicha,
    addTrait,
    removeTrait,
    flushSave,
}) {
    const [traitDraft, setTraitDraft] = useState("");
    const traits = ficha?.narrativeTraits || [];

    return (
        <Box
            sx={{
                border: `1px solid ${NAR_ACCENT}44`,
                borderRadius: "6px",
                p: 1.5,
                bgcolor: "rgba(255,20,147,0.04)",
            }}
        >
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 1 }}>
                <CyberTitle
                    sx={{
                        fontSize: "0.7rem",
                        letterSpacing: "0.14em",
                        color: NAR_ACCENT,
                    }}
                >
                    PERSONALIDAD
                </CyberTitle>
                <CyberTooltip title={NARRATIVE_PERSONALITY_SECTION_HELP}>
                    <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary, cursor: "help" }}>
                        guía reacciones
                    </CyberText>
                </CyberTooltip>
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mb: 1.25 }}>
                <EnumField
                    label="Arquetipo de reacción"
                    help={REACTION_ARCHETYPE_FIELD_HELP}
                    value={ficha.reactionArchetype}
                    options={REACTION_ARCHETYPE_OPTIONS}
                    tooltips={REACTION_ARCHETYPE_TOOLTIPS}
                    onChange={(v) => patchFicha({ reactionArchetype: v })}
                />
                <EnumField
                    label="Estado narrativo"
                    help={NARRATIVE_STATE_FIELD_HELP}
                    value={ficha.narrativeState}
                    options={NARRATIVE_STATE_OPTIONS}
                    tooltips={NARRATIVE_STATE_TOOLTIPS}
                    onChange={(v) => patchFicha({ narrativeState: v })}
                />
                <EnumField
                    label="Respuesta al estrés"
                    help={STRESS_RESPONSE_FIELD_HELP}
                    value={ficha.stressResponse}
                    options={STRESS_RESPONSE_OPTIONS}
                    tooltips={STRESS_RESPONSE_TOOLTIPS}
                    onChange={(v) => patchFicha({ stressResponse: v })}
                />
            </Box>

            <Box sx={{ mb: 1.25 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, fontWeight: 600 }}>
                        Rasgos narrativos (máx. 5)
                    </CyberText>
                    <CyberTooltip title={NARRATIVE_TRAITS_FIELD_HELP}>
                        <Box component="span" sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, cursor: "help" }}>?</Box>
                    </CyberTooltip>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.75 }}>
                    {traits.map((t) => (
                        <Chip
                            key={t}
                            size="small"
                            label={t}
                            onDelete={() => removeTrait(t)}
                            sx={{
                                height: 22,
                                color: UI_COLORS.textPrimary,
                                bgcolor: `${NAR_ACCENT}22`,
                                border: `1px solid ${NAR_ACCENT}55`,
                                "& .MuiChip-deleteIcon": { color: UI_COLORS.textSecondary },
                            }}
                        />
                    ))}
                    {!traits.length && (
                        <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                            Ningún rasgo aún
                        </CyberText>
                    )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.75, mb: 0.75 }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Añadir rasgo…"
                        value={traitDraft}
                        disabled={traits.length >= 5}
                        onChange={(e) => setTraitDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addTrait(traitDraft);
                                setTraitDraft("");
                            }
                        }}
                        sx={fieldSx}
                    />
                    <Box
                        component="button"
                        type="button"
                        disabled={traits.length >= 5 || !traitDraft.trim()}
                        onClick={() => {
                            addTrait(traitDraft);
                            setTraitDraft("");
                        }}
                        sx={{
                            border: `1px solid ${NAR_ACCENT}66`,
                            bgcolor: `${NAR_ACCENT}18`,
                            color: UI_COLORS.textPrimary,
                            px: 1.5,
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontFamily: '"Fira Code", monospace',
                            fontSize: "0.65rem",
                            opacity: traits.length >= 5 || !traitDraft.trim() ? 0.4 : 1,
                        }}
                    >
                        ADD
                    </Box>
                </Box>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {NARRATIVE_TRAITS_EXAMPLES.map((ex) => (
                        <Chip
                            key={ex}
                            size="small"
                            label={ex}
                            onClick={() => addTrait(ex)}
                            sx={{
                                height: 20,
                                cursor: "pointer",
                                bgcolor: UI_COLORS.backgroundPrimary,
                                border: `1px dashed ${UI_COLORS.border}`,
                                color: UI_COLORS.textSecondary,
                                "&:hover": { borderColor: NAR_ACCENT, color: NAR_ACCENT },
                            }}
                        />
                    ))}
                </Box>
            </Box>

            <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.4 }}>
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, fontWeight: 600 }}>
                        Anclas emocionales
                    </CyberText>
                    <CyberTooltip title={BOND_NOTES_FIELD_HELP}>
                        <Box component="span" sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, cursor: "help" }}>?</Box>
                    </CyberTooltip>
                </Box>
                <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Personas, lugares o promesas que deben pesar si el evento las toca…"
                    value={ficha.bondNotes}
                    onChange={(e) => patchFicha({ bondNotes: e.target.value })}
                    onBlur={() => flushSave?.()}
                    sx={fieldSx}
                />
            </Box>
        </Box>
    );
}
