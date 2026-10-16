/**
 * Personality of a Lore ficha. The article shows one line. Editar opens the
 * choices. The extra sentence appears on hover or on the ? button.
 */

import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { UI_COLORS } from "../../constants/uiColors";
import {
    BOND_NOTES_FIELD_HELP,
    NARRATIVE_TRAITS_FIELD_HELP,
    REACTION_ARCHETYPE_FIELD_HELP,
    STRESS_RESPONSE_FIELD_HELP,
    NARRATIVE_STATE_FIELD_HELP,
} from "../../constants/wiki/entityFieldSchemas";
import {
    COLLECTIVE_CHOICES,
    COLLECTIVE_FIELD_HELP,
    COLLECTIVE_MOOD_FIELD_HELP,
    MAX_NARRATIVE_TRAITS,
    PERSONALITY_AI_NOTE,
    REACTION_CHOICES,
    STATE_CHOICES,
    STRESS_CHOICES,
    personalitySummary,
    traitList,
} from "../../constants/wiki/lorePersonality";

const TITLE = '"Orbitron", sans-serif';
const SANS = '"Fira Sans", sans-serif';

function useDebounced(value, onCommit, delay = 450) {
    const [draft, setDraft] = useState(value);
    const timer = useRef(null);
    const commitRef = useRef(onCommit);
    useEffect(() => { commitRef.current = onCommit; }, [onCommit]);
    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => () => clearTimeout(timer.current), []);
    const change = (next) => {
        setDraft(next);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => commitRef.current(next), delay);
    };
    return [draft, change];
}

function quietButtonSx() {
    return {
        flex: "none",
        px: "8px",
        py: "3px",
        borderRadius: "4px",
        border: `1px solid ${UI_COLORS.border}`,
        background: "transparent",
        color: "#ffffff",
        fontFamily: SANS,
        fontSize: "12px",
        cursor: "pointer",
        "&:hover": { borderColor: "#ffffff" },
        "&:focus-visible": { outline: `2px solid ${UI_COLORS.anomaly}`, outlineOffset: "1px" },
    };
}

function HelpMark({ label, open, onEnter, onLeave, onClick }) {
    return (
        <Box
            component="button"
            type="button"
            aria-label={`Ayuda: ${label}`}
            aria-expanded={open}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={onClick}
            sx={{
                ...quietButtonSx(),
                width: 22,
                height: 22,
                p: 0,
                fontFamily: TITLE,
                fontSize: "11px",
                lineHeight: 1,
            }}
        >
            ?
        </Box>
    );
}

function Tip({ children }) {
    if (!children) return null;
    return (
        <Box sx={{ mt: 0.4, mb: 0.2, fontFamily: SANS, fontSize: "12.5px", color: "#ffffff", lineHeight: 1.45 }}>
            {children}
        </Box>
    );
}

function ChoiceRow({ label, help, choices, value, onPick, readOnly, tipOn, onTip }) {
    const current = choices.find((choice) => choice.value === value) || null;
    const sentence = current?.short || current?.ai || help;
    return (
        <Box
            onMouseEnter={() => onTip(true)}
            onMouseLeave={() => onTip(false)}
            sx={{ py: 0.6, borderTop: `1px solid ${UI_COLORS.border}` }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 92, flex: "none", fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>
                    {label}
                </Box>
                <Box
                    component="select"
                    aria-label={label}
                    disabled={readOnly}
                    value={value || ""}
                    onChange={(event) => onPick(event.target.value || null)}
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        color: "#ffffff",
                        bgcolor: "rgba(8,8,14,0.92)",
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: "4px",
                        fontFamily: SANS,
                        fontSize: "13px",
                        px: 0.8,
                        py: 0.4,
                        outline: "none",
                        "&:focus": { borderColor: UI_COLORS.anomaly },
                        "& option": { color: "#ffffff", background: "#12121a" },
                    }}
                >
                    <option value="">Sin elegir</option>
                    {choices.map((choice) => (
                        <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                </Box>
                <HelpMark
                    label={label}
                    open={tipOn}
                    onEnter={() => onTip(true)}
                    onLeave={() => onTip(false)}
                    onClick={() => onTip("pin")}
                />
            </Box>
            {tipOn && <Tip>{sentence}</Tip>}
        </Box>
    );
}

function TraitsField({ value, onChange, readOnly, tipOn, onTip }) {
    const traits = traitList(value);
    const [input, setInput] = useState("");
    const add = (raw) => {
        const next = String(raw || "").trim();
        if (!next || traits.length >= MAX_NARRATIVE_TRAITS || traits.includes(next)) return;
        onChange([...traits, next]);
        setInput("");
    };
    return (
        <Box
            onMouseEnter={() => onTip(true)}
            onMouseLeave={() => onTip(false)}
            sx={{ py: 0.6, borderTop: `1px solid ${UI_COLORS.border}` }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 92, flex: "none", fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>
                    Rasgos
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                    {traits.map((trait) => (
                        <Box key={trait} sx={{ display: "inline-flex", alignItems: "center", gap: "2px", fontFamily: SANS, fontSize: "12.5px", color: "#ffffff" }}>
                            {trait}
                            {!readOnly && (
                                <Box
                                    component="button"
                                    type="button"
                                    aria-label={`Quitar ${trait}`}
                                    onClick={() => onChange(traits.filter((item) => item !== trait))}
                                    sx={{ p: 0, border: 0, background: "none", color: UI_COLORS.textSecondary, cursor: "pointer", display: "grid", "&:hover": { color: "#ffffff" } }}
                                >
                                    <CloseIcon sx={{ fontSize: 13 }} />
                                </Box>
                            )}
                        </Box>
                    ))}
                    {!readOnly && traits.length < MAX_NARRATIVE_TRAITS && (
                        <Box
                            component="input"
                            value={input}
                            placeholder="Agregar"
                            aria-label="Nuevo rasgo"
                            onChange={(event) => setInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    add(input);
                                }
                            }}
                            sx={{
                                flex: 1,
                                minWidth: 72,
                                color: "#ffffff",
                                bgcolor: "transparent",
                                border: 0,
                                outline: "none",
                                fontFamily: SANS,
                                fontSize: "13px",
                                p: 0,
                                "&::placeholder": { color: UI_COLORS.textSecondary },
                            }}
                        />
                    )}
                </Box>
                <HelpMark
                    label="Rasgos"
                    open={tipOn}
                    onEnter={() => onTip(true)}
                    onLeave={() => onTip(false)}
                    onClick={() => onTip("pin")}
                />
            </Box>
            {tipOn && <Tip>{NARRATIVE_TRAITS_FIELD_HELP}</Tip>}
        </Box>
    );
}

/**
 * @param {{
 *   row: object,
 *   entityType: string,
 *   onPatch: (patch: object) => void,
 *   readOnly?: boolean,
 *   defaultOpen?: boolean,
 *   stack?: boolean,
 * }} props
 */
export default function LorePersonalityPicker({ row, entityType, onPatch, readOnly = false, defaultOpen = false, stack = false }) {
    const [editing, setEditing] = useState(defaultOpen);
    const [hoverTip, setHoverTip] = useState("");
    const [pinnedTip, setPinnedTip] = useState("");
    const [bond, setBond] = useDebounced(row?.bond_notes || "", (next) => onPatch({ bond_notes: next }));
    const [mood, setMood] = useDebounced(row?.collective_mood || "", (next) => onPatch({ collective_mood: next }));
    const [noteOn, setNoteOn] = useState(false);
    const personaje = entityType === "personaje";
    const collective = entityType === "locacion" || entityType === "organizacion";
    if (!personaje && !collective) return null;

    const summary = personalitySummary(row);
    const tipOn = (key) => pinnedTip === key || hoverTip === key;
    const onTip = (key) => (show) => {
        if (show === true) setHoverTip(key);
        else if (show === false) setHoverTip((current) => (current === key ? "" : current));
        else setPinnedTip((current) => (current === key ? "" : key));
    };

    return (
        <Box data-testid="lore-personality" sx={{ color: "#ffffff" }}>
            <Box sx={{ display: "flex", alignItems: stack ? "flex-start" : "center", flexDirection: stack ? "column" : "row", gap: stack ? 0.35 : 1, py: 0.75 }}>
                <Box sx={{ width: stack ? "auto" : 92, flex: "none", fontFamily: stack ? TITLE : SANS, fontSize: stack ? "8.5px" : "11px", letterSpacing: stack ? "0.14em" : 0, textTransform: stack ? "uppercase" : "none", color: UI_COLORS.textSecondary }}>
                    {personaje ? "Personalidad" : "Temperamento"}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, width: stack ? "100%" : "auto", flex: stack ? "none" : 1, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: "13px", color: summary ? "#ffffff" : UI_COLORS.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: stack ? "normal" : "nowrap", lineHeight: 1.35 }}>
                    {summary || "Sin elegir"}
                </Box>
                <HelpMark
                    label={personaje ? "Personalidad" : "Temperamento"}
                    open={noteOn || hoverTip === "note"}
                    onEnter={() => setHoverTip("note")}
                    onLeave={() => setHoverTip((current) => (current === "note" ? "" : current))}
                    onClick={() => setNoteOn((value) => !value)}
                />
                {!readOnly && (
                    <Box
                        component="button"
                        type="button"
                        onClick={() => setEditing((value) => !value)}
                        sx={quietButtonSx()}
                    >
                        {editing ? "Cerrar" : "Editar"}
                    </Box>
                )}
                </Box>
            </Box>
            {(noteOn || hoverTip === "note") && <Tip>{PERSONALITY_AI_NOTE}</Tip>}
            {editing && (
                <Box sx={{ mt: 0.5, p: "4px 10px 8px", borderRadius: "6px", border: `1px solid ${UI_COLORS.border}`, bgcolor: "rgba(7,7,12,0.92)" }}>
                    <Box sx={{ py: 0.6, fontFamily: TITLE, fontSize: "8.5px", letterSpacing: "0.14em", color: UI_COLORS.textSecondary }}>
                        ELEGIR
                    </Box>
                    {personaje && (
                        <>
                            <ChoiceRow label="Arquetipo" help={REACTION_ARCHETYPE_FIELD_HELP} choices={REACTION_CHOICES} value={row?.reaction_archetype || null} onPick={(next) => onPatch({ reaction_archetype: next })} readOnly={readOnly} tipOn={tipOn("reaction")} onTip={onTip("reaction")} />
                            <ChoiceRow label="Estrés" help={STRESS_RESPONSE_FIELD_HELP} choices={STRESS_CHOICES} value={row?.stress_response || null} onPick={(next) => onPatch({ stress_response: next })} readOnly={readOnly} tipOn={tipOn("stress")} onTip={onTip("stress")} />
                            <ChoiceRow label="Estado" help={NARRATIVE_STATE_FIELD_HELP} choices={STATE_CHOICES} value={row?.narrative_state || null} onPick={(next) => onPatch({ narrative_state: next })} readOnly={readOnly} tipOn={tipOn("state")} onTip={onTip("state")} />
                            <TraitsField value={row?.narrative_traits} onChange={(next) => onPatch({ narrative_traits: next })} readOnly={readOnly} tipOn={tipOn("traits")} onTip={onTip("traits")} />
                            <Box sx={{ py: 0.6, borderTop: `1px solid ${UI_COLORS.border}` }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                    <Box sx={{ width: 92, flex: "none", fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>Vínculos</Box>
                                    <Box sx={{ flex: 1 }} />
                                    <HelpMark label="Anclas y vínculos" open={tipOn("bond")} onEnter={() => onTip("bond")(true)} onLeave={() => onTip("bond")(false)} onClick={() => onTip("bond")()} />
                                </Box>
                                {tipOn("bond") && <Tip>{BOND_NOTES_FIELD_HELP}</Tip>}
                                <Box
                                    component="textarea"
                                    value={bond}
                                    readOnly={readOnly}
                                    aria-label="Anclas y vínculos"
                                    placeholder="Ej.: juró proteger a su hija."
                                    onChange={(event) => setBond(event.target.value)}
                                    sx={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        minHeight: 52,
                                        resize: "vertical",
                                        color: "#ffffff",
                                        bgcolor: "rgba(8,8,14,0.92)",
                                        border: `1px solid ${UI_COLORS.border}`,
                                        borderRadius: "4px",
                                        fontFamily: SANS,
                                        fontSize: "13px",
                                        lineHeight: 1.45,
                                        px: 1,
                                        py: 0.7,
                                        outline: "none",
                                        "&:focus": { borderColor: UI_COLORS.anomaly },
                                        "&::placeholder": { color: UI_COLORS.textSecondary },
                                    }}
                                />
                            </Box>
                        </>
                    )}
                    {collective && (
                        <>
                            <ChoiceRow label="Arquetipo" help={COLLECTIVE_FIELD_HELP} choices={COLLECTIVE_CHOICES} value={row?.collective_archetype || null} onPick={(next) => onPatch({ collective_archetype: next })} readOnly={readOnly} tipOn={tipOn("collective")} onTip={onTip("collective")} />
                            <Box
                                onMouseEnter={() => onTip("mood")(true)}
                                onMouseLeave={() => onTip("mood")(false)}
                                sx={{ py: 0.6, borderTop: `1px solid ${UI_COLORS.border}` }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Box sx={{ width: 92, flex: "none", fontFamily: SANS, fontSize: "11px", color: UI_COLORS.textSecondary }}>Ánimo</Box>
                                    <Box
                                        component="input"
                                        value={mood}
                                        readOnly={readOnly}
                                        aria-label="Ánimo colectivo"
                                        placeholder="Ej.: tenso, de luto"
                                        onChange={(event) => setMood(event.target.value)}
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            color: "#ffffff",
                                            bgcolor: "rgba(8,8,14,0.92)",
                                            border: `1px solid ${UI_COLORS.border}`,
                                            borderRadius: "4px",
                                            fontFamily: SANS,
                                            fontSize: "13px",
                                            px: 0.8,
                                            py: 0.45,
                                            outline: "none",
                                            "&:focus": { borderColor: UI_COLORS.anomaly },
                                            "&::placeholder": { color: UI_COLORS.textSecondary },
                                        }}
                                    />
                                    <HelpMark label="Ánimo colectivo" open={tipOn("mood")} onEnter={() => onTip("mood")(true)} onLeave={() => onTip("mood")(false)} onClick={() => onTip("mood")()} />
                                </Box>
                                {tipOn("mood") && <Tip>{COLLECTIVE_MOOD_FIELD_HELP}</Tip>}
                            </Box>
                        </>
                    )}
                </Box>
            )}
        </Box>
    );
}
