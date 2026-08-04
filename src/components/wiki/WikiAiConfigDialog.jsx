/**
 * WikiAiConfigDialog.jsx
 *
 * Panel de Configuración de IA narrativa (reglas DJ + parámetros del modelo).
 * Abierto desde el engranaje junto a las tabs del archivo.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    IconButton, Slider, Switch, TextField, Tooltip, FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useDispatch } from "react-redux";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    AI_CONFIG_CATEGORIES,
    AI_CONFIG_CATEGORY_LABELS,
    AI_RULE_PRESETS,
    DEFAULT_AI_GENERATION,
    defaultAiRulesFromPresets,
    resolveNarrativeAiConfig,
} from "../../constants/wiki/narrativeAiConfig";
import { saveCampaignAiConfig } from "../../store/wikiSlice";

/** Por encima del Dialog (1800) y del overlay del archivo (1400). */
const CONFIG_TOOLTIP_Z = 2100;

const tooltipSlotProps = {
    popper: {
        sx: { zIndex: CONFIG_TOOLTIP_Z },
    },
    tooltip: {
        sx: {
            maxWidth: 300,
            fontSize: "0.72rem",
            fontFamily: "'Fira Sans', sans-serif",
            bgcolor: UI_COLORS.backgroundPrimary,
            color: UI_COLORS.textPrimary,
            border: `1px solid ${UI_COLORS.border}`,
            lineHeight: 1.45,
            boxShadow: `0 4px 20px rgba(0,0,0,0.45)`,
        },
    },
};

function InfoTip({ title }) {
    return (
        <Tooltip title={title} slotProps={tooltipSlotProps} arrow enterDelay={200}>
            <Box
                component="span"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    cursor: "help",
                    flexShrink: 0,
                    lineHeight: 0,
                }}
            >
                <InfoOutlinedIcon sx={{ fontSize: "0.85rem", color: UI_COLORS.textSecondary }} />
            </Box>
        </Tooltip>
    );
}

const sectionSx = {
    p: 1.5,
    borderRadius: 1,
    border: `1px solid ${UI_COLORS.border}`,
    bgcolor: `${UI_COLORS.backgroundPrimary}aa`,
};

const switchSx = {
    ml: 0,
    mr: 0,
    alignItems: "flex-start",
    "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.anomaly },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
        bgcolor: `${UI_COLORS.anomaly}88`,
    },
};

function RuleLabel({ label, tooltip }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1, pr: 1 }}>
            <CyberText sx={{ fontSize: "0.75rem", color: UI_COLORS.textPrimary, lineHeight: 1.35 }}>
                {label}
            </CyberText>
            <InfoTip title={tooltip} />
        </Box>
    );
}

function ParamLabel({ label, tooltip, valueLabel }) {
    return (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.textSecondary }}>
                    {label}
                </CyberText>
                <InfoTip title={tooltip} />
            </Box>
            {valueLabel && (
                <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.anomaly, fontFamily: "'Orbitron', sans-serif" }}>
                    {valueLabel}
                </CyberText>
            )}
        </Box>
    );
}

export default function WikiAiConfigDialog({
    open,
    onClose,
    narrativeSettings,
    campaignId,
    uid,
}) {
    const dispatch = useDispatch();
    const resolved = useMemo(
        () => resolveNarrativeAiConfig(narrativeSettings),
        [narrativeSettings?.aiRules, narrativeSettings?.aiGeneration]
    );

    const [draftRules, setDraftRules] = useState(resolved.rules);
    const [draftGen, setDraftGen] = useState(resolved.generation);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (open) {
            setDraftRules(resolved.rules);
            setDraftGen(resolved.generation);
            setDirty(false);
        }
    }, [open, resolved]);

    const presetsByCategory = useMemo(() => {
        const map = {};
        for (const cat of Object.values(AI_CONFIG_CATEGORIES)) {
            map[cat] = AI_RULE_PRESETS.filter((p) => p.category === cat);
        }
        return map;
    }, []);

    const handleRuleToggle = (key) => (e) => {
        setDraftRules((prev) => ({ ...prev, [key]: e.target.checked }));
        setDirty(true);
    };

    const handleSave = useCallback(async () => {
        if (!campaignId) return;
        setSaving(true);
        try {
            await dispatch(saveCampaignAiConfig({
                campaignId,
                aiRules: draftRules,
                aiGeneration: draftGen,
                uid,
            })).unwrap();
            setDirty(false);
            onClose();
        } finally {
            setSaving(false);
        }
    }, [campaignId, dispatch, draftRules, draftGen, uid, onClose]);

    const handleReset = () => {
        setDraftRules(defaultAiRulesFromPresets());
        setDraftGen({ ...DEFAULT_AI_GENERATION });
        setDirty(true);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            sx={{ zIndex: 1800 }}
            PaperProps={{
                sx: {
                    bgcolor: UI_COLORS.backgroundSecondary,
                    border: `1px solid ${UI_COLORS.border}`,
                    boxShadow: `0 0 40px ${UI_COLORS.anomaly}22`,
                    maxHeight: "min(90vh, 720px)",
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1.5,
                    borderBottom: `1px solid ${UI_COLORS.border}`,
                }}
            >
                <SettingsIcon sx={{ color: UI_COLORS.anomaly, fontSize: "1.1rem" }} />
                <Box sx={{ flex: 1 }}>
                    <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.anomaly, letterSpacing: 2 }}>
                        CONFIGURACIÓN IA
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary, mt: 0.25 }}>
                        Reglas de campaña y parámetros del modelo para NEURAL_LAB
                    </CyberText>
                </Box>
                <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary }}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                {Object.values(AI_CONFIG_CATEGORIES).map((cat) => (
                    <Box key={cat} sx={sectionSx}>
                        <CyberText
                            sx={{
                                fontSize: "0.62rem",
                                color: UI_COLORS.anomaly,
                                letterSpacing: 1.2,
                                mb: 1,
                                textTransform: "uppercase",
                            }}
                        >
                            {AI_CONFIG_CATEGORY_LABELS[cat]}
                        </CyberText>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                            {presetsByCategory[cat].map((preset) => (
                                <FormControlLabel
                                    key={preset.key}
                                    control={
                                        <Switch
                                            size="small"
                                            checked={Boolean(draftRules[preset.key])}
                                            onChange={handleRuleToggle(preset.key)}
                                        />
                                    }
                                    label={<RuleLabel label={preset.label} tooltip={preset.tooltip} />}
                                    labelPlacement="start"
                                    sx={{ ...switchSx, justifyContent: "space-between", width: "100%" }}
                                />
                            ))}
                        </Box>
                    </Box>
                ))}

                <Box sx={sectionSx}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
                        <CyberText
                            sx={{
                                fontSize: "0.62rem",
                                color: UI_COLORS.anomaly,
                                letterSpacing: 1.2,
                                textTransform: "uppercase",
                            }}
                        >
                            Instrucciones personalizadas
                        </CyberText>
                        <InfoTip title="Reglas narrativas libres inyectadas en el system prompt. Ej.: «Toda muerte debe hacer que sospechosos apunten al culpable más obvio». No excluyen entidades; guían el estilo de respuesta." />
                    </Box>
                    <TextField
                        multiline
                        minRows={4}
                        maxRows={8}
                        fullWidth
                        placeholder={'Ej.: "Toda propagación de muerte debe proponer que personajes sospechosos crean que fue asesinado por X..."'}
                        value={draftRules.customPromptRules ?? ""}
                        onChange={(e) => {
                            setDraftRules((prev) => ({ ...prev, customPromptRules: e.target.value }));
                            setDirty(true);
                        }}
                        size="small"
                        sx={{
                            "& .MuiInputBase-root": {
                                color: UI_COLORS.textPrimary,
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: "0.8rem",
                                bgcolor: UI_COLORS.backgroundSecondary,
                            },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: `${UI_COLORS.anomaly}66` },
                            "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.anomaly },
                        }}
                    />
                </Box>

                <Box sx={sectionSx}>
                    <CyberText
                        sx={{
                            fontSize: "0.62rem",
                            color: UI_COLORS.anomaly,
                            letterSpacing: 1.2,
                            mb: 1.25,
                            textTransform: "uppercase",
                        }}
                    >
                        Parámetros del modelo
                    </CyberText>

                    <Box sx={{ mb: 2 }}>
                        <ParamLabel
                            label="Temperatura"
                            valueLabel={draftGen.temperature?.toFixed(2)}
                            tooltip="Controla creatividad vs. coherencia. 0.3–0.5: factual. 0.7–0.9: narrativa equilibrada (recomendado). >1.0: más sorpresa, más riesgo de incoherencia."
                        />
                        <Slider
                            value={draftGen.temperature ?? 0.8}
                            min={0}
                            max={1.2}
                            step={0.05}
                            marks={[
                                { value: 0.3, label: "0.3" },
                                { value: 0.7, label: "0.7" },
                                { value: 0.9, label: "0.9" },
                                { value: 1.2, label: "1.2" },
                            ]}
                            onChange={(_, v) => {
                                setDraftGen((prev) => ({ ...prev, temperature: v }));
                                setDirty(true);
                            }}
                            sx={{
                                color: UI_COLORS.anomaly,
                                "& .MuiSlider-markLabel": {
                                    fontSize: "0.55rem",
                                    color: UI_COLORS.textSecondary,
                                },
                            }}
                        />
                    </Box>

                    <Box sx={{ mb: 2 }}>
                        <ParamLabel
                            label="Top-P (nucleus)"
                            valueLabel={draftGen.topP?.toFixed(2)}
                            tooltip="Limita vocabulario a tokens acumulados hasta esta probabilidad. 0.9–0.95 recomendado. Ajusta top-P o temperatura; no ambos a la vez salvo pruebas."
                        />
                        <Slider
                            value={draftGen.topP ?? 0.95}
                            min={0.5}
                            max={1}
                            step={0.05}
                            onChange={(_, v) => {
                                setDraftGen((prev) => ({ ...prev, topP: v }));
                                setDirty(true);
                            }}
                            sx={{ color: UI_COLORS.anomaly }}
                        />
                    </Box>

                    <Box>
                        <ParamLabel
                            label="Tokens de salida máx."
                            valueLabel={draftGen.maxOutputTokens ? String(draftGen.maxOutputTokens) : "Auto"}
                            tooltip="Límite de tokens en la respuesta JSON. Auto: 8192 (ideas/ondas) / 6144 (evento). El modo evento es lean-first: cambios concretos, no prosa. Subir solo si hay truncación persistente."
                        />
                        <Slider
                            value={draftGen.maxOutputTokens ?? 6144}
                            min={2048}
                            max={16384}
                            step={512}
                            marks={[
                                { value: 4096, label: "4k" },
                                { value: 6144, label: "6k" },
                                { value: 8192, label: "8k" },
                                { value: 16384, label: "16k" },
                            ]}
                            onChange={(_, v) => {
                                setDraftGen((prev) => ({ ...prev, maxOutputTokens: v }));
                                setDirty(true);
                            }}
                            sx={{
                                color: UI_COLORS.anomaly,
                                "& .MuiSlider-markLabel": { fontSize: "0.55rem", color: UI_COLORS.textSecondary },
                            }}
                        />
                        <Button
                            size="small"
                            onClick={() => {
                                setDraftGen((prev) => ({ ...prev, maxOutputTokens: null }));
                                setDirty(true);
                            }}
                            sx={{
                                mt: 0.5,
                                fontSize: "0.62rem",
                                color: UI_COLORS.textSecondary,
                                textTransform: "none",
                                "&:hover": { color: UI_COLORS.anomaly },
                            }}
                        >
                            Usar límite automático por modo
                        </Button>
                    </Box>
                </Box>

                <CyberText sx={{ fontSize: "0.6rem", color: UI_COLORS.textSecondary, lineHeight: 1.45 }}>
                    La configuración se guarda en la campaña y aplica a todas las generaciones del LAB_IA.
                    Los idiomas ya están excluidos del grafo por diseño.
                </CyberText>
            </DialogContent>

            <DialogActions
                sx={{
                    px: 2.5,
                    py: 1.5,
                    borderTop: `1px solid ${UI_COLORS.border}`,
                    justifyContent: "space-between",
                }}
            >
                <Tooltip title="Restaurar valores recomendados" slotProps={tooltipSlotProps} arrow enterDelay={200}>
                    <span>
                        <Button
                        size="small"
                        startIcon={<RestartAltIcon sx={{ fontSize: "1rem !important" }} />}
                        onClick={handleReset}
                        sx={{
                            color: UI_COLORS.textSecondary,
                            fontSize: "0.72rem",
                            fontFamily: "'Fira Sans', sans-serif",
                        }}
                    >
                        Restaurar
                    </Button>
                    </span>
                </Tooltip>
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                        onClick={onClose}
                        sx={{ color: UI_COLORS.textSecondary, fontSize: "0.78rem" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="outlined"
                        disabled={!dirty || saving || !campaignId}
                        onClick={handleSave}
                        sx={{
                            borderColor: UI_COLORS.anomaly,
                            color: UI_COLORS.anomaly,
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: "0.72rem",
                            letterSpacing: 1,
                            "&:hover": { bgcolor: `${UI_COLORS.anomaly}12` },
                        }}
                    >
                        {saving ? "Guardando…" : "Guardar"}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}
