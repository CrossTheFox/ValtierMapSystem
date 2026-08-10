/**
 * Circuit PCB node card (Option 8 visual language).
 */

import { Box, IconButton } from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import { useLayoutEffect, useRef } from "react";
import { UI_COLORS } from "../../../constants/uiColors";
import { WIKI_ENTITY_TYPES } from "../../../constants/wikiEntityTypes";
import { syncMeterPct } from "../../../utils/syncRank";
import CharAvatar from "../CharAvatar";
import CyberTooltip from "../../customs/CyberTooltip";

const NAR_ACCENT = UI_COLORS.accentStrong;
const STRUCT_YELLOW = "#ffaa00";

function nodeActionBtnSx(accent, active = false) {
    return {
        position: "absolute",
        top: 2,
        right: 2,
        zIndex: 8,
        width: 26,
        height: 26,
        p: 0.25,
        color: accent,
        bgcolor: active ? `${accent}30` : "rgba(8,8,14,0.92)",
        border: `1px solid ${active ? accent : `${accent}88`}`,
        borderRadius: "4px",
        boxShadow: active ? `0 0 12px ${accent}55` : "none",
        "&:hover": {
            bgcolor: `${accent}28`,
            borderColor: accent,
            boxShadow: `0 0 12px ${accent}55`,
        },
        "& .MuiSvgIcon-root": {
            fontSize: "0.95rem",
        },
    };
}

function kindClass(node) {
    if (node.kind === "hub") return "self";
    if (node.kind === "structural") return "struct";
    if (node.kind === "secondary") return "neutral";
    if (node.kind === "cluster") {
        if (node.rankId === "hostile") return "hostile";
        if (node.rankId === "rival") return "rival";
        if (node.rankId === "bonded" || node.rankId === "allied") return "ally";
        return "neutral";
    }
    if (node.rankId === "hostile") return "hostile";
    if (node.rankId === "rival") return "rival";
    if (node.rankId === "bonded" || node.rankId === "allied") return "ally";
    return "neutral";
}

/**
 * @param {{
 *   node: object,
 *   selected?: boolean,
 *   dim?: boolean,
 *   waveClass?: string,
 *   dragging?: boolean,
 *   canDrag?: boolean,
 *   onSelect?: (node: object) => void,
 *   onDragStart?: (node: object, e: import('react').PointerEvent) => void,
 *   canFocusTravel?: boolean,
 *   canToggleStruct?: boolean,
 *   relationMode?: 'affinity'|'structural',
 *   onFocusEntity?: (entityId: string) => void,
 *   onToggleStruct?: () => void,
 * }} props
 */
function CircuitNode({
    node,
    selected = false,
    dim = false,
    waveClass = "",
    dragging = false,
    canDrag = false,
    onSelect,
    onDragStart,
    canFocusTravel = false,
    canToggleStruct = false,
    relationMode = "affinity",
    onFocusEntity,
    onToggleStruct,
}) {
    const cls = kindClass(node);
    const isHub = node.kind === "hub";
    const isCluster = node.kind === "cluster";
    const sync = Number.isFinite(node.sync) ? node.sync : 0;
    const syncLabel = sync > 0 ? `+${sync}` : String(sync);
    const meterLeft = `${syncMeterPct(sync)}%`;
    const entityId = node.entityId || node.id;
    const isPersonaje = node.entityType === WIKI_ENTITY_TYPES.PERSONAJE
        || (!node.entityType && node.kind === "affinity");
    const showFocusBtn = Boolean(
        canFocusTravel
        && !isHub
        && !isCluster
        && isPersonaje
        && entityId
        && onFocusEntity,
    );
    const showStructBtn = Boolean(canToggleStruct && isHub && onToggleStruct);
    const showDragHandle = Boolean(canDrag && !isHub && !isCluster && onDragStart);
    const structOn = relationMode === "structural";
    const rootRef = useRef(null);
    const className = [
        "ckt-node",
        cls,
        selected ? "selected" : "",
        dim ? "dim" : "",
        showDragHandle ? "has-drag-handle" : "",
        dragging ? "dragging" : "",
        waveClass,
    ].filter(Boolean).join(" ");

    // Packet cascade / Seal Grade toggle classes via dataset; React className rewrites would wipe them.
    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return;
        if (el.dataset.cktDim === "1") el.classList.add("dim");
        if (el.dataset.cktLit === "1") el.classList.add("ckt-pkt-lit");
        if (el.dataset.cktHit === "1") el.classList.add("ckt-pkt-hit");
        const seal = el.dataset.cktSeal;
        if (seal === "ok" || seal === "warn" || seal === "fail") {
            el.classList.add(`seal-${seal}`, "show-seal");
            const mark = el.querySelector("[data-ckt-seal]");
            if (mark && !mark.textContent) {
                const map = { ok: ["OK", "#3dd68c"], warn: ["WARN", "#f5c542"], fail: ["FAIL", "#ff3355"] };
                const [txt, col] = map[seal];
                mark.textContent = txt;
                mark.style.color = col;
                mark.style.borderColor = col;
            }
        }
    }, [className]);

    return (
        <Box
            ref={rootRef}
            className={className}
            onClick={(e) => {
                e.stopPropagation();
                onSelect?.(node);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
            sx={{
                left: node.x,
                top: node.y,
                width: node.w || 138,
            }}
            data-id={node.id}
            data-ckt-nid={node.id}
            data-ckt-eid={entityId || node.id}
            data-name={node.title}
            data-rank={node.rankLabel}
            data-sync={String(sync)}
            data-role={node.kind}
        >
            <span className="ckt-seal-mark" data-ckt-seal aria-hidden />
            {showDragHandle && (
                <Box
                    className="ckt-drag-handle"
                    role="button"
                    title="Arrastrar card (DM)"
                    aria-label="Arrastrar card"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDragStart?.(node, e);
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                />
            )}
            {showStructBtn && (
                <CyberTooltip title={structOn
                    ? "Volver a afinidad (Sync / \u00f3rbitas / impactos)"
                    : "Hechos estructurales: sin Sync, sin \u00f3rbitas, sin impactos IA"}
                >
                    <IconButton
                        size="small"
                        className={`ckt-node-action${structOn ? " on" : ""}`}
                        aria-label={structOn ? "Ver afinidad" : "Ver hechos estructurales"}
                        aria-pressed={structOn}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleStruct?.();
                        }}
                        sx={nodeActionBtnSx(STRUCT_YELLOW, structOn)}
                    >
                        <AccountTreeIcon />
                    </IconButton>
                </CyberTooltip>
            )}

            {showFocusBtn && (
                <CyberTooltip title="Viajar foco a este personaje">
                    <IconButton
                        size="small"
                        className="ckt-node-action"
                        aria-label="Viajar foco a este personaje"
                        onClick={(e) => {
                            e.stopPropagation();
                            onFocusEntity?.(entityId);
                        }}
                        sx={nodeActionBtnSx(NAR_ACCENT)}
                    >
                        <CenterFocusStrongIcon />
                    </IconButton>
                </CyberTooltip>
            )}

            {isHub ? (
                <>
                    <span className="ckt-port n" />
                    <span className="ckt-port e" />
                    <span className="ckt-port s" />
                    <span className="ckt-port w" />
                </>
            ) : node.x >= 800 ? (
                <span className="ckt-port w" />
            ) : (
                <span className="ckt-port e" />
            )}

            <Box
                className="av"
                sx={{
                    position: "relative",
                    width: isHub ? 80 : 64,
                    height: isHub ? 80 : 64,
                }}
            >
                {(isHub || cls === "ally" || cls === "hostile") && <span className="ring" />}
                {isCluster ? (
                    <Box
                        sx={{
                            fontFamily: '"Orbitron", sans-serif',
                            fontSize: "0.55rem",
                            letterSpacing: "0.06em",
                            color: node.rankColor || UI_COLORS.textPrimary,
                        }}
                    >
                        x{node.memberIds?.length || node.members?.length || "?"}
                    </Box>
                ) : (
                    <Box
                        sx={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            width: isHub ? 160 : 128,
                            height: isHub ? 160 : 128,
                            transform: "translate(-50%, -50%) scale(0.5)",
                            transformOrigin: "center center",
                            pointerEvents: "none",
                        }}
                    >
                        <CharAvatar
                            imagePath={node.imagePath}
                            name={node.title || "?"}
                            size={isHub ? 160 : 128}
                            status={node.avatarStatus || "alive"}
                            crop={node.avatarCrop || null}
                        />
                    </Box>
                )}
            </Box>

            <Box className="nm">{node.title || "-"}</Box>
            <Box className="rank" sx={{ color: `${node.rankColor || UI_COLORS.anomaly} !important` }}>
                {node.rankLabel || (isHub ? "ANCLA" : "-")}
            </Box>
            {!isHub && node.kind !== "structural" && node.kind !== "secondary" && (
                <>
                    <Box
                        className="sy"
                        sx={{
                            color:
                                sync > 0 ? UI_COLORS.boon
                                    : sync < 0 ? (sync <= -7 ? UI_COLORS.danger : UI_COLORS.loot)
                                        : UI_COLORS.textSecondary,
                        }}
                    >
                        {isCluster ? `${node.memberIds?.length || 0} nodos` : `SYNC ${syncLabel}`}
                    </Box>
                    {!isCluster && (
                        <Box className="mini-meter">
                            <Box
                                component="i"
                                className="thumb"
                                sx={{ left: meterLeft, borderColor: NAR_ACCENT }}
                            />
                        </Box>
                    )}
                </>
            )}
            {node.kind === "structural" && (
                <CyberTooltip
                    title="Hecho estructural: no genera impactos de IA y no cuenta para la profundidad de \u00f3rbitas. Solo contexto / pertenencia."
                >
                    <Box className="ckt-struct-meta" component="span">
                        <Box className="sy" sx={{ color: `${STRUCT_YELLOW} !important`, m: "0 !important" }}>
                            hecho
                        </Box>
                        <Box className="ckt-struct-flags">sin impacto · sin órbita</Box>
                    </Box>
                </CyberTooltip>
            )}
            {node.kind === "secondary" && (
                <Box className="sy" sx={{ color: UI_COLORS.textSecondary }}>
                    {"\u00f3rbita"}
                </Box>
            )}
            {isHub && (
                <Box className="sy" sx={{ color: UI_COLORS.textSecondary }}>
                    hub · sync 0
                </Box>
            )}
        </Box>
    );
}

export { CircuitNode };
export default CircuitNode;
