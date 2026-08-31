import { Box } from "@mui/material";
import CyberSelect from "../../customs/CyberSelect";
import { UI_COLORS } from "../../../constants/uiColors";
import { KitSvgAoeByKey, KitSvgAoeAura, KitSvgCost, KitSvgRange } from "../../../constants/kitSvg";
import {
    TRAIT_MODE_LIST,
    TRAIT_MODE_LABELS,
    TRAIT_MODE_COLORS,
    normalizeTraitMode,
} from "../../../constants/abilityKinds";
import { canUnlockNode, isKitNodeUnlocked } from "../../../utils/kitProgression";
import { aoeTone, aoeVchipLabel } from "../../../utils/parseAoe";
import { COST_SEL, RANGE_SEL, AOE_SEL, RES_SEL, costChipLabel, rangeChipLabel } from "./kitChipOptions";

/**
 * Header CORE chips — mockup `.vchip` (icon + value). Cost/range/AoE/traitMode/RES
 * are always `CyberSelect` in EDIT (never native `<select>`, never cycle-on-click).
 */

const VCHIP_SX = {
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    minHeight: 26,
    px: "6px",
    py: "3px",
    borderRadius: "2px",
    border: "1px solid",
    flexShrink: 0,
    bgcolor: "rgba(0,0,0,0.45)",
    lineHeight: 1,
};

function VChip({ label, color, borderColor, icon, small, ghost, editable, onClick, title, sx: sxExtra }) {
    return (
        <Box
            component={editable ? "button" : "span"}
            type={editable ? "button" : undefined}
            onClick={onClick}
            title={title}
            sx={{
                ...VCHIP_SX,
                color,
                borderColor: borderColor || `${color}b3`,
                cursor: editable ? "pointer" : "default",
                opacity: ghost ? 0.45 : 1,
                "&:hover": editable ? { bgcolor: "rgba(0,242,234,0.08)", boxShadow: "0 0 0 1px rgba(0,242,234,0.55)" } : undefined,
                ...sxExtra,
            }}
        >
            {icon ? (
                <Box sx={{ width: 16, height: 16, display: "grid", placeItems: "center", flexShrink: 0, color }}>
                    {icon}
                </Box>
            ) : null}
            <Box
                component="span"
                sx={{
                    fontFamily: small ? "Orbitron, sans-serif" : "'Fira Code', monospace",
                    fontSize: small ? "0.52rem" : "0.82rem",
                    fontWeight: small ? 500 : 600,
                    letterSpacing: small ? "0.04em" : 0,
                    lineHeight: 1,
                    color: ghost ? color : "#ffffff",
                }}
            >
                {label}
            </Box>
        </Box>
    );
}

export function Tchip({ mode }) {
    const m = normalizeTraitMode(mode);
    const color = TRAIT_MODE_COLORS[m];
    const border = {
        passive: "rgba(125,211,252,0.5)",
        active: "rgba(255,138,61,0.55)",
        trigger: "rgba(255,102,255,0.55)",
        interrupt: "rgba(255,51,85,0.55)",
    }[m];
    const bg = {
        passive: "rgba(125,211,252,0.1)",
        active: "rgba(255,138,61,0.1)",
        trigger: "rgba(255,102,255,0.1)",
        interrupt: "rgba(255,51,85,0.12)",
    }[m];
    return (
        <Box
            component="span"
            sx={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "0.38rem",
                letterSpacing: "0.1em",
                px: "5px",
                py: "2px",
                borderRadius: "2px",
                border: `1px solid ${border}`,
                bgcolor: bg,
                color,
                flexShrink: 0,
                whiteSpace: "nowrap",
            }}
        >
            {TRAIT_MODE_LABELS[m].toUpperCase()}
        </Box>
    );
}

function Pill({ label, color, editable, onClick, title }) {
    return (
        <Box
            component={editable ? "button" : "span"}
            type={editable ? "button" : undefined}
            onClick={onClick}
            title={title}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 18,
                px: "5px",
                borderRadius: "3px",
                fontFamily: "'Fira Code', monospace",
                fontSize: "0.5rem",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                color,
                border: `1px solid ${color}66`,
                bgcolor: `${color}14`,
                cursor: editable ? "pointer" : "default",
                "&:hover": editable ? { bgcolor: `${color}28`, borderColor: color } : undefined,
            }}
        >
            {label}
        </Box>
    );
}

function costVChip(value, { ghost = false, editable = false, onClick } = {}) {
    if (ghost) {
        return (
            <VChip
                label="+"
                color="#ff8a3d"
                borderColor="rgba(255,138,61,0.75)"
                icon={<KitSvgCost size={16} />}
                small
                ghost
                editable={editable}
                onClick={onClick}
                title="Action cost"
            />
        );
    }
    const label = costChipLabel(value);
    const isSh = String(value) === "superheavy" || label === "SH";
    const tip = label === "F"
        ? "Free"
        : label === "I"
            ? "Interrupt"
            : isSh
                ? "S.H. Action — 2 actions, cannot move this turn"
                : `${label} Action`;
    return (
        <VChip
            label={label}
            color={isSh ? "#ff3355" : "#ff8a3d"}
            borderColor={isSh ? "rgba(255,51,85,0.85)" : "rgba(255,138,61,0.75)"}
            icon={<KitSvgCost size={16} />}
            editable={editable}
            onClick={onClick}
            title={tip}
            sx={isSh ? {
                bgcolor: "rgba(255,51,85,0.14)",
                boxShadow: "0 0 10px rgba(255,51,85,0.25)",
            } : undefined}
        />
    );
}

function rangeVChip(value, { ghost = false, editable = false, onClick } = {}) {
    if (ghost) {
        return (
            <VChip
                label="+"
                color={UI_COLORS.anomaly}
                borderColor="rgba(0,242,234,0.7)"
                icon={<KitSvgRange size={16} />}
                small
                ghost
                editable={editable}
                onClick={onClick}
                title="Range"
            />
        );
    }
    const label = rangeChipLabel(value);
    return (
        <VChip
            label={label === "—" ? "—" : String(label).replace(/^R/, "")}
            color={UI_COLORS.anomaly}
            borderColor="rgba(0,242,234,0.7)"
            icon={<KitSvgRange size={16} />}
            editable={editable}
            onClick={onClick}
            title={label === "—" ? "Range" : `Range ${label}`}
        />
    );
}

function aoeVChip(value, { ghost = false, editable = false, onClick } = {}) {
    if (ghost) {
        return (
            <VChip
                label="+"
                color="#ff66ff"
                borderColor="rgba(255,102,255,0.75)"
                icon={<KitSvgAoeAura size={16} />}
                small
                ghost
                editable={editable}
                onClick={onClick}
                title="AoE"
            />
        );
    }
    const tone = aoeTone(value);
    const label = aoeVchipLabel(value);
    return (
        <VChip
            label={label}
            color={tone.color}
            borderColor={tone.border}
            icon={<KitSvgAoeByKey aoeKey={tone.key} size={16} />}
            small={String(label).length > 2}
            editable={editable}
            onClick={onClick}
            title={label ? `AoE ${label}` : "AoE"}
        />
    );
}

const TRAIT_COST_SEL = [{ value: "", label: "—" }, ...COST_SEL];

export function CostChip({ value, kitEdit, onChange, allowEmpty = false }) {
    const empty = allowEmpty && (value == null || value === "");
    const options = allowEmpty ? TRAIT_COST_SEL : COST_SEL;
    if (!kitEdit) {
        if (empty) return null;
        return costVChip(value);
    }
    const curVal = empty ? "" : (value == null || value === "" ? "1" : String(value));
    return (
        <CyberSelect
            value={curVal}
            options={options}
            menuVariant="vchip"
            onChange={onChange}
            renderOption={(opt) => (
                opt.value === "" && allowEmpty
                    ? costVChip(null, { ghost: true })
                    : costVChip(opt.value === "free" || opt.value === "interrupt" || opt.value === "superheavy" ? opt.value : Number(opt.value))
            )}
            renderTrigger={(current, { onOpen }) => (
                costVChip(
                    current?.value === "" ? null : (current?.value ?? value),
                    { ghost: current?.value === "" && allowEmpty, editable: true, onClick: onOpen },
                )
            )}
        />
    );
}

export function RangeChip({ value, kitEdit, onChange }) {
    if (!kitEdit) {
        if (!value) return null;
        return rangeVChip(value);
    }
    return (
        <CyberSelect
            value={value ? String(value) : ""}
            options={RANGE_SEL}
            menuVariant="vchip"
            onChange={onChange}
            renderOption={(opt) => (
                opt.value ? rangeVChip(opt.value) : rangeVChip(null, { ghost: true })
            )}
            renderTrigger={(current, { onOpen }) => (
                rangeVChip(
                    current?.value || null,
                    { ghost: !current?.value, editable: true, onClick: onOpen },
                )
            )}
        />
    );
}

export function AoeChip({ value, kitEdit, onChange }) {
    if (!kitEdit) {
        if (!value) return null;
        return aoeVChip(value);
    }
    return (
        <CyberSelect
            value={value ? String(value) : ""}
            options={AOE_SEL}
            menuVariant="vchip"
            onChange={onChange}
            renderOption={(opt) => (
                opt.value ? aoeVChip(opt.value) : aoeVChip(null, { ghost: true })
            )}
            renderTrigger={(current, { onOpen }) => (
                aoeVChip(
                    current?.value || null,
                    { ghost: !current?.value, editable: true, onClick: onOpen },
                )
            )}
        />
    );
}

export function ResolveChip({ value, kitEdit, onChange }) {
    const color = "#ffcc33";
    const n = value != null ? value : 1;
    if (!kitEdit) return <Pill label={`RES ${n}`} color={color} title="Resolve cost" />;
    return (
        <CyberSelect
            value={String(n)}
            options={RES_SEL}
            onChange={onChange}
            renderTrigger={(current, { onOpen }) => (
                <Pill label={current ? current.label : `RES ${n}`} color={color} editable title="Resolve cost" onClick={onOpen} />
            )}
        />
    );
}

export function TraitModeChip({ value, kitEdit, onChange, openRef }) {
    const mode = normalizeTraitMode(value);
    if (!kitEdit) return <Tchip mode={mode} />;
    return (
        <CyberSelect
            value={mode}
            options={TRAIT_MODE_LIST.map((m) => ({ value: m, label: TRAIT_MODE_LABELS[m] }))}
            menuVariant="vchip"
            openRef={openRef}
            onChange={onChange}
            renderOption={(opt) => <Tchip mode={opt.value} />}
            renderTrigger={(current, { onOpen, triggerRef: tRef }) => (
                <Box
                    ref={tRef}
                    component="button"
                    type="button"
                    onClick={onOpen}
                    title="Trait mode"
                    sx={{
                        display: "inline-flex",
                        p: 0,
                        border: 0,
                        bgcolor: "transparent",
                        cursor: "pointer",
                    }}
                >
                    <Tchip mode={current?.value ?? mode} />
                </Box>
            )}
        />
    );
}

/** ATK/STD — binary toggle mark, not a cyber-sel (per plan). */
export function AtkToggleMark({ hasAttack, kitEdit, onToggle }) {
    const color = hasAttack ? "#ff3355" : UI_COLORS.anomaly;
    const label = hasAttack ? "ATK" : "STD";
    return (
        <Pill
            label={label}
            color={color}
            editable={kitEdit}
            title={kitEdit ? "Alternar Attack / Standard" : undefined}
            onClick={kitEdit ? onToggle : undefined}
        />
    );
}

/** G11 — unlockCostAP display (top-right, read-only when locked) + spend action. */
export function UnlockBadge({ node, character, ctx, onUnlock }) {
    const cost = Number(node?.unlockCostAP) || 0;
    if (cost <= 0) return null;
    const unlocked = isKitNodeUnlocked(character, node, ctx);
    if (unlocked) {
        return <Pill label={`L${cost}`} color="#7dd3fc" title={`Desbloqueado (costó ${cost} AP)`} />;
    }
    const check = canUnlockNode(character, node, ctx);
    return (
        <Box
            component="button"
            type="button"
            onClick={() => { if (check.ok) onUnlock?.(node); }}
            disabled={!check.ok}
            title={check.ok ? `Gastar ${cost} AP para desbloquear` : "AP insuficiente"}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 18,
                px: "5px",
                borderRadius: "3px",
                fontFamily: "'Fira Code', monospace",
                fontSize: "0.5rem",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                color: check.ok ? "#ffcc33" : "rgba(255,255,255,0.4)",
                border: `1px solid ${check.ok ? "#ffcc33" : "rgba(255,255,255,0.25)"}`,
                bgcolor: check.ok ? "rgba(255,204,51,0.12)" : "transparent",
                cursor: check.ok ? "pointer" : "not-allowed",
            }}
        >
            🔒{cost}AP
        </Box>
    );
}
