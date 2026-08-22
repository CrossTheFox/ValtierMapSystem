import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import RemoveIcon from "@mui/icons-material/Remove";
import { useDispatch, useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { HUD_SURFACE } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { isDmRole, canControlToken } from "../../utils/tokenControl";
import {
    BRIEFCASE_SIZE,
    DEFAULT_BRIEFCASE,
    canPlace,
    compactMaskFromCells,
    isPlaced,
    liveMask,
    maskCells,
    occupancyMap,
    placedFitsBriefcase,
} from "../../utils/briefcaseGrid";
import {
    ITEM_OWNER,
    emptyItem,
} from "../../utils/campaignItems";
import { formatItemEffectChip } from "../../utils/characterItemEffects";
import {
    createCampaignItem,
    deleteCampaignItem,
    subscribeCharacterItems,
    updateCampaignItem,
} from "../../../firebase/services/itemService";
import { callItemInChat } from "../../../firebase/services/chatService";
import { updateCharacterFields } from "../../../firebase/services/characterService";
import { updateCharacterInList } from "../../store/characterSlice";
import { updateCharacterInState } from "../../store/worldSlice";
import { useCharacterJobData } from "../../hooks/useCharacterJobData";
import BriefcaseGrid from "./inventory/BriefcaseGrid";
import CreateItemFold from "./inventory/CreateItemFold";
import ItemCatalogList from "./inventory/ItemCatalogList";
import ItemInspectPanel from "./inventory/ItemInspectPanel";

const GOLD = UI_COLORS.loot;

const railBtn = (active, color) => ({
    color: active ? "#000" : color,
    bgcolor: active ? color : "rgba(8,8,14,0.88)",
    border: `1px solid ${color}`,
    borderRadius: "4px",
    width: 34,
    height: 34,
    "&:hover": { bgcolor: active ? color : `${color}22` },
    "&.Mui-disabled": {
        opacity: 0.28,
        color,
        borderColor: `${color}55`,
        bgcolor: "rgba(8,8,14,0.88)",
    },
});

const stepperBtn = {
    color: GOLD,
    border: `1px solid ${GOLD}66`,
    borderRadius: "4px",
    width: 26,
    height: 26,
    "&:hover": { bgcolor: `${GOLD}18` },
};

export default function DossierInventoryView({
    character,
    open = true,
    onClose,
}) {
    const dispatch = useDispatch();
    const profile = useSelector((s) => s.player.profile);
    const campaignId = useSelector((s) => s.world.selectedCampaignId) || character?.campaignId;
    const uid = profile?.uid;
    const isDM = isDmRole(profile?.role);
    const canDrag = canControlToken(character, profile) || isDM;
    const cols = character?.briefcase?.cols || DEFAULT_BRIEFCASE.cols;
    const rows = character?.briefcase?.rows || DEFAULT_BRIEFCASE.rows;

    const [items, setItems] = useState([]);
    const [drawing, setDrawing] = useState(false);
    const [paintCells, setPaintCells] = useState([]);
    const [seedHeld, setSeedHeld] = useState(null);
    const [busy, setBusy] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [calling, setCalling] = useState(false);
    const [sizeHint, setSizeHint] = useState("");
    const [panel, setPanel] = useState("list");
    const gridHostRef = useRef(null);
    const [cellSize, setCellSize] = useState(48);

    const { jobList } = useCharacterJobData(character);
    const abilityOptions = useMemo(
        () => (jobList || []).flatMap((j) => (j.abilities || []).map((a) => ({
            id: a.key || a.id,
            label: a.label || a.key,
        }))),
        [jobList],
    );
    const traitOptions = useMemo(
        () => (jobList || []).flatMap((j) => (j.traits || []).map((a) => ({
            id: a.key || a.id,
            label: a.label || a.key,
        }))),
        [jobList],
    );

    useEffect(() => {
        setItems([]);
        setSelectedId(null);
        setDrawing(false);
        setPaintCells([]);
        setPanel("list");
        if (!campaignId || !character?.id) return undefined;
        return subscribeCharacterItems(campaignId, character.id, setItems);
    }, [campaignId, character?.id]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        const el = gridHostRef.current;
        if (!el || !open) return undefined;
        const fit = () => {
            const next = Math.floor(Math.min(el.clientWidth / cols, el.clientHeight / rows));
            setCellSize(Math.max(28, Math.min(72, next || 28)));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [cols, rows, open]);

    const stash = useMemo(
        () => items.filter((it) => !isPlaced(it)),
        [items],
    );
    const selected = items.find((it) => it.id === selectedId) || null;
    const usedCells = useMemo(
        () => items.filter(isPlaced).reduce((n, it) => n + maskCells(liveMask(it)).length, 0),
        [items],
    );
    const cap = cols * rows;
    const fillPct = cap ? Math.min(100, Math.round((usedCells / cap) * 100)) : 0;
    const creating = panel === "create";
    const listing = panel === "list" && !selectedId;

    const persistPlace = useCallback(async (id, pos) => {
        if (!campaignId || !id) return;
        await updateCampaignItem(campaignId, id, {
            gx: pos.gx,
            gy: pos.gy,
            rot: pos.rot || 0,
            equippedSlot: null,
        }, uid);
    }, [campaignId, uid]);

    const persistStash = useCallback(async (id) => {
        if (!campaignId || !id) return;
        await updateCampaignItem(campaignId, id, {
            gx: null,
            gy: null,
            equippedSlot: null,
        }, uid);
    }, [campaignId, uid]);

    const handleHeldChange = useCallback(() => {
        setSeedHeld(null);
    }, []);

    const applyPaint = useCallback(({ x, y, add }) => {
        setPaintCells((prev) => {
            const has = prev.some((c) => c.x === x && c.y === y);
            if (add && !has) return [...prev, { x, y }];
            if (!add && has) return prev.filter((c) => !(c.x === x && c.y === y));
            return prev;
        });
    }, []);

    const closeCreate = () => {
        setDrawing(false);
        setPaintCells([]);
        setPanel("list");
    };

    const toggleCreate = () => {
        if (panel === "create") {
            closeCreate();
            return;
        }
        setSelectedId(null);
        setPanel("create");
        setDrawing(true);
        setPaintCells([]);
    };

    const showList = () => {
        setSelectedId(null);
        closeCreate();
    };

    const createFromPaint = async (draft) => {
        const packed = compactMaskFromCells(paintCells);
        if (!packed || !campaignId || !character?.id) return false;
        const probe = { id: "__draft", mask: packed.mask, rot: 0 };
        if (!canPlace(probe, packed.gx, packed.gy, cols, rows, occupancyMap(items))) return false;
        setBusy(true);
        try {
            const created = await createCampaignItem(campaignId, emptyItem({
                ...draft,
                name: draft.name || "Objeto",
                mask: packed.mask,
                gx: packed.gx,
                gy: packed.gy,
                rot: 0,
                ownerType: ITEM_OWNER.CHARACTER,
                ownerCharacterId: character.id,
                campaignId,
                imageUrl: draft.imageUrl || null,
            }), uid);
            setPaintCells([]);
            setDrawing(false);
            setPanel("list");
            if (created?.id) setSelectedId(created.id);
            return true;
        } catch (err) {
            console.warn("[DossierInventory] create item", err?.code || err?.message || err);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const pickupStash = (it) => {
        setSelectedId(it.id);
        const cells = maskCells(liveMask(it));
        const maxX = Math.max(0, ...cells.map((c) => c.x));
        const maxY = Math.max(0, ...cells.map((c) => c.y));
        setSeedHeld({
            ...it,
            _grab: { dx: Math.floor(maxX / 2), dy: Math.floor(maxY / 2) },
        });
    };

    const resizeBriefcase = async (nextCols, nextRows) => {
        if (!isDM || !character?.id) return;
        const next = {
            cols: Math.max(BRIEFCASE_SIZE.minCols, Math.min(BRIEFCASE_SIZE.maxCols, nextCols)),
            rows: Math.max(BRIEFCASE_SIZE.minRows, Math.min(BRIEFCASE_SIZE.maxRows, nextRows)),
        };
        if (!placedFitsBriefcase(items, next.cols, next.rows)) {
            setSizeHint("Hay objetos fuera de ese tamaño. Muévelos antes de encoger.");
            return;
        }
        setSizeHint("");
        const briefcase = next;
        await updateCharacterFields(character.id, { briefcase });
        dispatch(updateCharacterInList({ id: character.id, data: { briefcase } }));
        dispatch(updateCharacterInState({
            id: character.id,
            locationId: character.locationId,
            data: { briefcase },
        }));
    };

    const callSelected = async (it) => {
        if (!campaignId || !it) return;
        setCalling(true);
        try {
            await callItemInChat(campaignId, profile, it, {
                character,
                effectLabel: formatItemEffectChip(it.effect),
            });
        } catch (err) {
            console.warn("[DossierInventory] call item", err);
        } finally {
            setCalling(false);
        }
    };

    const selectItem = (id) => {
        setSelectedId(id);
        if (id && panel === "create") closeCreate();
        else if (id) setPanel("list");
    };

    const deleteSelected = () => {
        if (!campaignId || !selected || !isDM) return;
        deleteCampaignItem(campaignId, selected.id, selected.imageUrl);
        setSelectedId(null);
    };

    if (!open) return null;

    return (
        <Box
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 12,
                display: "flex",
                pointerEvents: "none",
            }}
        >
            <Box
                onClick={() => onClose?.()}
                sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: "rgba(4,4,10,0.55)",
                    pointerEvents: "auto",
                }}
            />
            <Box
                sx={{
                    ...HUD_SURFACE,
                    pointerEvents: "auto",
                    position: "absolute",
                    top: "10%",
                    right: "10%",
                    bottom: "10%",
                    left: "10%",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    bgcolor: "rgba(10,10,20,0.96)",
                    border: `1px solid ${GOLD}66`,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
                    "@media (prefers-reduced-motion: no-preference)": {
                        animation: "maletinDrawerIn 180ms ease-out",
                    },
                    "@keyframes maletinDrawerIn": {
                        from: { opacity: 0, transform: "translateY(8px)" },
                        to: { opacity: 1, transform: "none" },
                    },
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 8fr) minmax(240px, 4fr) 52px",
                        gap: 1.25,
                        p: "12px 10px 12px 14px",
                        "@media (max-width: 900px)": {
                            gridTemplateColumns: "1fr 52px",
                            gridTemplateRows: "minmax(0, 1fr) minmax(180px, 40%)",
                        },
                    }}
                >
                    <Box
                        sx={{
                            minWidth: 0,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            "@media (max-width: 900px)": { gridColumn: "1", gridRow: "1" },
                        }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.7, gap: 1, flexShrink: 0 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <CyberTitle sx={{ fontSize: "11px", letterSpacing: "0.18em", color: GOLD }}>
                                    MALETÍN · {cols}×{rows}
                                </CyberTitle>
                                <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                                    {usedCells}/{cap} CELDAS · {items.length} OBJ · {stash.length} STASH
                                </CyberText>
                            </Box>
                            {isDM ? (
                                <Box sx={{ display: "flex", gap: 1.2, alignItems: "center", flexWrap: "wrap" }}>
                                    <SizeStepper
                                        label="COL"
                                        value={cols}
                                        min={BRIEFCASE_SIZE.minCols}
                                        max={BRIEFCASE_SIZE.maxCols}
                                        onChange={(v) => resizeBriefcase(v, rows)}
                                    />
                                    <SizeStepper
                                        label="FIL"
                                        value={rows}
                                        min={BRIEFCASE_SIZE.minRows}
                                        max={BRIEFCASE_SIZE.maxRows}
                                        onChange={(v) => resizeBriefcase(cols, v)}
                                    />
                                    {sizeHint ? (
                                        <CyberText sx={{ fontSize: "10px", color: UI_COLORS.danger }}>{sizeHint}</CyberText>
                                    ) : null}
                                </Box>
                            ) : null}
                        </Box>

                        <Box
                            sx={{
                                height: 5,
                                mb: 0.8,
                                flexShrink: 0,
                                border: `1px solid ${UI_COLORS.border}`,
                                bgcolor: "rgba(0,0,0,0.4)",
                            }}
                        >
                            <Box sx={{ width: `${fillPct}%`, height: "100%", bgcolor: GOLD, boxShadow: `0 0 8px ${GOLD}66` }} />
                        </Box>

                        <Box
                            ref={gridHostRef}
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <BriefcaseGrid
                                cols={cols}
                                rows={rows}
                                items={items}
                                cellSize={cellSize}
                                canDrag={canDrag && !drawing}
                                canDraw={isDM}
                                drawing={drawing}
                                paintCells={paintCells}
                                onPaintApply={applyPaint}
                                onCommitPlace={persistPlace}
                                onUnplace={persistStash}
                                seedHeld={seedHeld}
                                onHeldChange={handleHeldChange}
                                selectedId={selectedId}
                                onSelect={selectItem}
                            />
                        </Box>
                        <CyberText sx={{ mt: 0.7, fontSize: "11px", color: UI_COLORS.textSecondary, flexShrink: 0 }}>
                            Click selecciona · arrastra para mover · R rota
                            {drawing ? " · arrastra en la grilla para pintar la forma" : ""}
                        </CyberText>
                    </Box>

                    <Box
                        sx={{
                            minWidth: 0,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                            border: `1px solid ${UI_COLORS.border}`,
                            borderRadius: "6px",
                            bgcolor: "rgba(0,0,0,0.28)",
                            p: 1.2,
                            ...CYBER_SCROLL_STYLE,
                            "@media (max-width: 900px)": { gridColumn: "1", gridRow: "2" },
                        }}
                    >
                        {creating ? (
                            <CreateItemFold
                                open
                                showEquip={false}
                                paintCount={paintCells.length}
                                busy={busy}
                                onCreate={createFromPaint}
                                createLabel="CREAR EN MALETÍN"
                                abilityOptions={abilityOptions}
                                traitOptions={traitOptions}
                            />
                        ) : selected ? (
                            <ItemInspectPanel
                                item={selected}
                                hideActions
                                canCall={Boolean(canDrag && selected)}
                                canDelete={Boolean(isDM && selected)}
                                calling={calling}
                                onCall={callSelected}
                                onDelete={deleteSelected}
                            />
                        ) : (
                            <ItemCatalogList
                                items={items}
                                selectedId={selectedId}
                                onSelect={selectItem}
                                onPickup={canDrag ? pickupStash : undefined}
                                canDrag={canDrag}
                                emptyHint="Este maletín está vacío."
                            />
                        )}
                    </Box>

                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.7,
                            pt: 0.2,
                            "@media (max-width: 900px)": {
                                gridColumn: "2",
                                gridRow: "1 / span 2",
                            },
                        }}
                    >
                        <CyberTooltip title="Cerrar" placement="left">
                            <IconButton size="small" onClick={() => onClose?.()} sx={railBtn(false, UI_COLORS.textSecondary)} aria-label="Cerrar">
                                <CloseIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </CyberTooltip>
                        <CyberTooltip title="Lista" placement="left">
                            <IconButton size="small" onClick={showList} sx={railBtn(listing, UI_COLORS.anomaly)} aria-label="Lista">
                                <FormatListBulletedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </CyberTooltip>
                        {isDM ? (
                            <CyberTooltip title={creating ? "Cerrar creación" : "Crear objeto"} placement="left">
                                <IconButton size="small" onClick={toggleCreate} sx={railBtn(creating, GOLD)} aria-label="Crear objeto">
                                    {creating ? <CloseIcon sx={{ fontSize: 18 }} /> : <AddIcon sx={{ fontSize: 18 }} />}
                                </IconButton>
                            </CyberTooltip>
                        ) : null}
                        <CyberTooltip title="Call en chat" placement="left">
                            <span>
                                <IconButton
                                    size="small"
                                    disabled={!selected || creating || calling}
                                    onClick={() => callSelected(selected)}
                                    sx={railBtn(false, GOLD)}
                                    aria-label="Call en chat"
                                >
                                    <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </span>
                        </CyberTooltip>
                        {isDM ? (
                            <CyberTooltip title="Borrar" placement="left">
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={!selected || creating}
                                        onClick={deleteSelected}
                                        sx={railBtn(false, UI_COLORS.danger)}
                                        aria-label="Borrar"
                                    >
                                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                                    </IconButton>
                                </span>
                            </CyberTooltip>
                        ) : null}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

function SizeStepper({ label, value, min, max, onChange }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
            <IconButton size="small" disabled={value <= min} onClick={() => onChange(value - 1)} sx={stepperBtn}>
                <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <CyberText sx={{ fontFamily: "'Fira Code', monospace", fontSize: "11px", color: UI_COLORS.textPrimary, minWidth: 52, textAlign: "center" }}>
                {value} {label}
            </CyberText>
            <IconButton size="small" disabled={value >= max} onClick={() => onChange(value + 1)} sx={stepperBtn}>
                <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
        </Box>
    );
}
