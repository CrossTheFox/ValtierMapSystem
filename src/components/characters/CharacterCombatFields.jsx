import { Box } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";
import { CyberInput } from "../customs/CyberInputs";
import { UI_COLORS } from "../../constants/uiColors";
import { COMBAT_STAT_KEYS, DAMAGE_DIE_OPTIONS } from "../../constants/combatStats";
import { resolveCombatStats } from "../../utils/resolveCombatStats";

const FIELD_META = {
    vit: { label: "VIT", hint: "Segmentos de vida" },
    defense: { label: "DEFENSE", hint: "AC a superar" },
    speed: { label: "SPEED", hint: "Casillas de movimiento" },
    fray: { label: "FRAY", hint: "Daño mínimo fijo" },
    damageDie: { label: "DAMAGE DIE", hint: "Caras del dado de daño" },
    armor: { label: "ARMOR", hint: "Reducción de daño" },
    vigor: { label: "VIGOR", hint: "Extra HP máx. (sobre HP)" },
};

/**
 * Job picker + combat override fields. Empty override = inherit from job/archetype.
 */
export default function CharacterCombatFields({ character, claseDoc, jobOptions = [], onChange }) {
    const overrides = character?.combatOverrides && typeof character.combatOverrides === "object"
        ? character.combatOverrides
        : {};
    const resolved = resolveCombatStats(character, claseDoc);
    const activeId = character?.activeClassId || character?.assignedClassIds?.[0] || "";

    const setOverride = (key, raw) => {
        const next = { ...overrides };
        if (raw === "" || raw == null) {
            delete next[key];
        } else {
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            next[key] = Math.floor(n);
        }
        const vitResolved = resolveCombatStats(
            { ...character, combatOverrides: next },
            claseDoc,
        ).vit;
        onChange({ combatOverrides: next, vit: vitResolved });
    };

    const setJob = (jobId) => {
        if (!jobId) {
            onChange({ assignedClassIds: [], activeClassId: null });
            return;
        }
        onChange({
            assignedClassIds: [jobId],
            activeClassId: jobId,
        });
    };

    return (
        <Box sx={{ width: "100%" }}>
            <CyberText sx={{ mb: 1.5, color: UI_COLORS.anomaly, fontSize: "0.8rem" }}>
                TACTICAL_COMBAT (job defaults + overrides)
            </CyberText>

            <CyberInput
                select
                label="PRIMARY_JOB"
                value={activeId}
                onChange={(e) => setJob(e.target.value || null)}
            >
                <option value="" style={{ backgroundColor: "#000", color: "#fff" }}>— sin job —</option>
                {jobOptions.map((j) => (
                    <option key={j.id} value={j.id} style={{ backgroundColor: "#000", color: "#fff" }}>
                        {(j.displayName || j.id).toUpperCase()}
                        {j.classArchetype ? ` · ${String(j.classArchetype).toUpperCase()}` : ""}
                    </option>
                ))}
            </CyberInput>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                    gap: 1.5,
                    mb: 1.5,
                }}
            >
                {COMBAT_STAT_KEYS.map((key) => {
                    const meta = FIELD_META[key];
                    const overrideVal = overrides[key];
                    const hasOverride = overrideVal != null && overrideVal !== "";
                    const displayResolved = resolved[key];

                    if (key === "damageDie") {
                        return (
                            <Box key={key}>
                                <CyberInput
                                    select
                                    label={`${meta.label}${hasOverride ? " *" : ""}`}
                                    value={hasOverride ? String(overrideVal) : ""}
                                    onChange={(e) => setOverride(key, e.target.value)}
                                >
                                    <option value="" style={{ backgroundColor: "#000", color: "#fff" }}>
                                        Heredar (d{displayResolved})
                                    </option>
                                    {DAMAGE_DIE_OPTIONS.map((d) => (
                                        <option key={d} value={String(d)} style={{ backgroundColor: "#000", color: "#fff" }}>
                                            d{d}
                                        </option>
                                    ))}
                                </CyberInput>
                                <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, mt: -2 }}>
                                    resuelto: d{displayResolved}
                                </CyberText>
                            </Box>
                        );
                    }

                    return (
                        <Box key={key}>
                            <CyberInput
                                type="number"
                                label={`${meta.label}${hasOverride ? " *" : ""}`}
                                placeholder={String(displayResolved)}
                                value={hasOverride ? overrideVal : ""}
                                onChange={(e) => setOverride(key, e.target.value)}
                            />
                            <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, mt: -2 }}>
                                resuelto: {displayResolved} · {meta.hint}
                            </CyberText>
                        </Box>
                    );
                })}
            </Box>

            <CyberText sx={{ fontSize: "0.72rem", color: "#ffffff" }}>
                HP máx. {resolved.hpMax} (VIT×4) · Dash {resolved.dash} (Speed/2)
                {claseDoc?.displayName ? ` · Job: ${claseDoc.displayName}` : ""}
            </CyberText>
        </Box>
    );
}
