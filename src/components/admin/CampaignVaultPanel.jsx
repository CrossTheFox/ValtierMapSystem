import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, IconButton, MenuItem, Select } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { useSelector } from "react-redux";

import { CyberText, CyberTitle } from "../customs/CustomTexts";
import CyberTooltip from "../customs/CyberTooltip";
import { UI_COLORS } from "../../constants/uiColors";
import { HUD_SURFACE, cyberMenuItemSx, cyberMenuPaperSx } from "../../constants/designSystem";
import { isDmRole } from "../../utils/tokenControl";
import { buildCampaignCharacterMap } from "../../utils/characterCombat";
import {
    DEFAULT_BRIEFCASE,
    VAULT_WORLD,
    canPlace,
    compactMaskFromCells,
    occupancyMap,
} from "../../utils/briefcaseGrid";
import {
    ITEM_OWNER,
    emptyItem,
} from "../../utils/campaignItems";
import { formatItemEffectChip } from "../../utils/characterItemEffects";
import {
    createCampaignItem,
    deleteCampaignItem,
    saveCampaignItem,
    subscribeVaultItems,
    updateCampaignItem,
} from "../../../firebase/services/itemService";
import { deleteStorageFile, uploadItemImage } from "../../../firebase/services/assetLoader";
import { callItemInChat } from "../../../firebase/services/chatService";
import BriefcaseGrid from "../characters/inventory/BriefcaseGrid";
import CreateItemFold from "../characters/inventory/CreateItemFold";
import ItemCatalogList from "../characters/inventory/ItemCatalogList";
import ItemInspectPanel from "../characters/inventory/ItemInspectPanel";
import PanZoomBoard from "../characters/inventory/PanZoomBoard";

const GOLD = UI_COLORS.loot;

const railBtn = (active, color) => ({
    color: active ? "#000" : color,
    bgcolor: active ? color : "rgba(8,8,14,0.88)",
    border: `1px solid ${color}`,
    borderRadius: "4px",
    width: 34,
    height: 34,
    "&:hover": { bgcolor: active ? color : `${color}22` },
});

export default function CampaignVaultPanel({ campaignId }) {
    const profile = useSelector((s) => s.player.profile);
    const uid = profile?.uid;
    const isDM = isDmRole(profile?.role);
    const charactersById = useSelector((s) => s.world.charactersById);
    const locations = useSelector((s) => s.world.locations);
    const sheetCharacters = useSelector((s) => s.characters.list);
    const roster = useMemo(
        () => [...buildCampaignCharacterMap(charactersById, locations, sheetCharacters, campaignId).values()],
        [charactersById, locations, sheetCharacters, campaignId],
    );

    const cols = VAULT_WORLD.cols;
    const rows = VAULT_WORLD.rows;
    const [items, setItems] = useState([]);
    const [drawing, setDrawing] = useState(false);
    const [paintCells, setPaintCells] = useState([]);
    const [targetId, setTargetId] = useState("");
    const [busy, setBusy] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [calling, setCalling] = useState(false);
    const [panel, setPanel] = useState(null);

    useEffect(() => {
        if (!campaignId || !isDM) {
            setItems([]);
            return undefined;
        }
        return subscribeVaultItems(campaignId, setItems);
    }, [campaignId, isDM]);

    const selected = items.find((it) => it.id === selectedId) || null;

    const persistPlace = useCallback(async (id, pos) => {
        if (!campaignId) return;
        await updateCampaignItem(campaignId, id, { gx: pos.gx, gy: pos.gy, rot: pos.rot || 0 }, uid);
    }, [campaignId, uid]);

    const persistUnplace = useCallback(async (id) => {
        const it = items.find((i) => i.id === id);
        if (!it || !campaignId) return;
        await saveCampaignItem(campaignId, { ...it, gx: null, gy: null }, uid);
    }, [campaignId, uid, items]);

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
        setPanel((p) => (p === "create" ? null : p));
    };

    const toggleCreate = () => {
        if (panel === "create") {
            closeCreate();
            return;
        }
        setPanel("create");
        setDrawing(true);
        setPaintCells([]);
    };

    const toggleList = () => {
        if (panel === "list") {
            setPanel(null);
            return;
        }
        closeCreate();
        setPanel("list");
    };

    const createFromPaint = async (draft) => {
        const packed = compactMaskFromCells(paintCells);
        if (!packed || !campaignId) return false;
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
                ownerType: ITEM_OWNER.VAULT,
                campaignId,
                imageUrl: draft.imageUrl || null,
            }), uid);
            setPaintCells([]);
            setDrawing(false);
            setPanel("list");
            if (created?.id) setSelectedId(created.id);
            return true;
        } catch (err) {
            console.warn("[CampaignVaultPanel] create item", err?.code || err?.message || err);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const sendToCharacter = async (item) => {
        if (!targetId || !campaignId || !item) return;
        await saveCampaignItem(campaignId, {
            ...item,
            ownerType: ITEM_OWNER.CHARACTER,
            ownerCharacterId: targetId,
            gx: null,
            gy: null,
            equippedSlot: null,
        }, uid);
        setSelectedId(null);
    };

    const patchSelectedEquip = async (partial) => {
        if (!campaignId || !selected) return;
        let imageUrl = selected.imageUrl;
        const { _imageFile, _imagePath: _p, ...rest } = partial;
        if (_imageFile) {
            const up = await uploadItemImage(selected.id, _imageFile);
            if (imageUrl && imageUrl !== up.path) {
                try { await deleteStorageFile(imageUrl); } catch { /* ignore */ }
            }
            imageUrl = up.path;
        } else if (Object.prototype.hasOwnProperty.call(partial, "imageUrl") && !partial.imageUrl) {
            if (imageUrl) {
                try { await deleteStorageFile(imageUrl); } catch { /* ignore */ }
            }
            imageUrl = null;
        }
        await saveCampaignItem(campaignId, { ...selected, ...rest, imageUrl }, uid);
    };

    const callSelected = async (it) => {
        if (!campaignId || !it) return;
        setCalling(true);
        try {
            await callItemInChat(campaignId, profile, it, {
                effectLabel: formatItemEffectChip(it.effect),
            });
        } catch (err) {
            console.warn("[CampaignVaultPanel] call item", err);
        } finally {
            setCalling(false);
        }
    };

    if (!isDM) {
        return (
            <CyberText sx={{ color: UI_COLORS.textSecondary, p: 2 }}>
                Solo el DM puede ver la bóveda de campaña.
            </CyberText>
        );
    }

    const selectItem = (id) => {
        setSelectedId(id);
        if (id && panel !== "create") setPanel("list");
    };

    return (
        <Box sx={{ position: "relative", display: "flex", minHeight: 0, height: "100%" }}>
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, pr: 5 }}>
                <Box sx={{ mb: 1 }}>
                    <CyberTitle sx={{ fontSize: "12px", letterSpacing: "0.16em", color: GOLD }}>
                        BÓVEDA · MUNDO {cols}×{rows}
                    </CyberTitle>
                    <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary }}>
                        Rueda = zoom · Alt+arrastre o clic vacío = pan · marco {DEFAULT_BRIEFCASE.cols}×{DEFAULT_BRIEFCASE.rows} = maletín estándar
                        {drawing ? " · arrastra para pintar la forma" : ""}
                    </CyberText>
                </Box>
                <PanZoomBoard panOnEmpty={!drawing}>
                    <BriefcaseGrid
                        cols={cols}
                        rows={rows}
                        items={items}
                        cellSize={28}
                        canDrag={!drawing}
                        canDraw
                        drawing={drawing}
                        paintCells={paintCells}
                        onPaintApply={applyPaint}
                        onCommitPlace={persistPlace}
                        onUnplace={persistUnplace}
                        selectedId={selectedId}
                        onSelect={selectItem}
                        frame={{
                            cols: DEFAULT_BRIEFCASE.cols,
                            rows: DEFAULT_BRIEFCASE.rows,
                            label: `MALETÍN ESTÁNDAR ${DEFAULT_BRIEFCASE.cols}×${DEFAULT_BRIEFCASE.rows}`,
                        }}
                    />
                </PanZoomBoard>
            </Box>

            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    zIndex: 5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.6,
                }}
            >
                <CyberTooltip title="Lista de objetos" placement="left">
                    <IconButton size="small" onClick={toggleList} sx={railBtn(panel === "list", UI_COLORS.anomaly)}>
                        <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </CyberTooltip>
                <CyberTooltip title={panel === "create" ? "Cerrar creación" : "Crear objeto"} placement="left">
                    <IconButton size="small" onClick={toggleCreate} sx={railBtn(panel === "create", GOLD)}>
                        {panel === "create" ? <CloseIcon sx={{ fontSize: 18 }} /> : <AddIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                </CyberTooltip>
            </Box>

            {panel ? (
                <Box
                    sx={{
                        ...HUD_SURFACE,
                        position: "absolute",
                        top: 0,
                        right: 42,
                        bottom: 0,
                        width: 300,
                        zIndex: 4,
                        p: 1.2,
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0,
                        overflow: "hidden",
                    }}
                >
                    {panel === "create" ? (
                        <CreateItemFold
                            open
                            paintCount={paintCells.length}
                            busy={busy}
                            onCreate={createFromPaint}
                            createLabel="CREAR EN BÓVEDA"
                        />
                    ) : selected ? (
                        <ItemInspectPanel
                            item={selected}
                            canCall={Boolean(selected)}
                            canDelete={Boolean(selected)}
                            canEditEquip
                            onPatchEquip={patchSelectedEquip}
                            calling={calling}
                            onCall={callSelected}
                            onBack={() => setSelectedId(null)}
                            onDelete={(it) => {
                                if (!campaignId) return;
                                deleteCampaignItem(campaignId, it.id, it.imageUrl);
                                setSelectedId(null);
                            }}
                        >
                            <CyberTitle sx={{ fontSize: "11px", color: UI_COLORS.anomaly, letterSpacing: "0.12em", mt: 1.2, mb: 0.8 }}>
                                ENVIAR A PJ
                            </CyberTitle>
                            <Select
                                size="small"
                                displayEmpty
                                value={targetId}
                                onChange={(e) => setTargetId(e.target.value)}
                                sx={{
                                    mb: 1,
                                    color: UI_COLORS.textPrimary,
                                    "& .MuiSelect-select": { color: UI_COLORS.textPrimary },
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: UI_COLORS.border },
                                    "& .MuiSvgIcon-root": { color: UI_COLORS.textSecondary },
                                }}
                                MenuProps={{ PaperProps: { sx: cyberMenuPaperSx } }}
                            >
                                <MenuItem value="" sx={cyberMenuItemSx}>Personaje…</MenuItem>
                                {roster.map((c) => (
                                    <MenuItem key={c.id} value={c.id} sx={cyberMenuItemSx}>
                                        {c.name || c.id}
                                    </MenuItem>
                                ))}
                            </Select>
                            <Button
                                size="small"
                                disabled={!targetId}
                                onClick={() => sendToCharacter(selected)}
                                sx={{
                                    color: GOLD,
                                    border: `1px solid ${GOLD}66`,
                                    fontFamily: "'Orbitron', sans-serif",
                                    fontSize: "10px",
                                    "&:hover": { bgcolor: `${GOLD}18` },
                                    "&.Mui-disabled": { color: `${GOLD}55`, borderColor: `${GOLD}33` },
                                }}
                            >
                                ENVIAR SELECCIONADO
                            </Button>
                        </ItemInspectPanel>
                    ) : (
                        <ItemCatalogList
                            items={items}
                            selectedId={selectedId}
                            onSelect={selectItem}
                            emptyHint="La bóveda está vacía. Crea un objeto y píntalo en el mundo."
                        />
                    )}
                </Box>
            ) : null}
        </Box>
    );
}
