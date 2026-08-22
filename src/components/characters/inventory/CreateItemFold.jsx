import { useEffect, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import { useSelector } from "react-redux";
import { CyberText, CyberTitle } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";
import { ITEM_TYPES } from "../../../utils/campaignItems";
import { deleteStorageFile, uploadItemImage } from "../../../../firebase/services/assetLoader";
import ItemDraftPanel from "./ItemDraftPanel";

const GOLD = UI_COLORS.loot;

const emptyDraft = () => ({
    name: "",
    type: ITEM_TYPES.WEAPON,
    rarity: "common",
    description: "",
    qty: null,
    effect: null,
    equipable: false,
    equipSlots: [],
    imageUrl: null,
    _imageFile: null,
    _imagePath: null,
});

async function discardPath(path) {
    if (!path) return;
    try {
        await deleteStorageFile(path);
    } catch (err) {
        console.warn("[CreateItemFold] discard draft image", err?.code || err?.message || err);
    }
}

/**
 * Local draft state so typing does not re-render the briefcase grid.
 * Parent only learns about the draft on create.
 */
export default function CreateItemFold({
    open,
    paintCount = 0,
    busy = false,
    onCreate,
    createLabel = "CREAR",
    showEquip = true,
    abilityOptions = [],
    traitOptions = [],
}) {
    const uid = useSelector((s) => s.player.profile?.uid);
    const [draft, setDraft] = useState(emptyDraft);
    const [uploading, setUploading] = useState(false);
    const pendingPathRef = useRef(null);
    const committedRef = useRef(false);

    pendingPathRef.current = draft._imagePath || null;

    useEffect(() => {
        if (open) {
            committedRef.current = false;
            setDraft(emptyDraft());
            return undefined;
        }
        if (!committedRef.current) {
            const path = pendingPathRef.current;
            pendingPathRef.current = null;
            void discardPath(path);
        }
        setDraft(emptyDraft());
        return undefined;
    }, [open]);

    useEffect(() => () => {
        if (!committedRef.current) void discardPath(pendingPathRef.current);
    }, []);

    const patchDraft = async (partial) => {
        if (Object.prototype.hasOwnProperty.call(partial, "_imageFile")) {
            const file = partial._imageFile;
            if (!file) {
                const old = pendingPathRef.current;
                pendingPathRef.current = null;
                void discardPath(old);
                setDraft((d) => ({ ...d, ...partial, imageUrl: null, _imagePath: null, _imageFile: null }));
                return;
            }
            setUploading(true);
            try {
                const old = pendingPathRef.current;
                const up = await uploadItemImage(`_drafts/${uid || "anon"}`, file);
                pendingPathRef.current = up.path;
                if (old && old !== up.path) void discardPath(old);
                setDraft((d) => ({
                    ...d,
                    ...partial,
                    _imageFile: file,
                    _imagePath: up.path,
                    imageUrl: up.path,
                }));
            } catch (err) {
                console.warn("[CreateItemFold] upload draft image", err?.code || err?.message || err);
            } finally {
                setUploading(false);
            }
            return;
        }
        setDraft((d) => ({ ...d, ...partial }));
    };

    if (!open) return null;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                flex: 1,
                gap: 0.8,
            }}
        >
            <CyberTitle sx={{ fontSize: "10px", letterSpacing: "0.14em", color: GOLD }}>
                NUEVO OBJETO
            </CyberTitle>
            <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, lineHeight: 1.4 }}>
                Arrastra en la grilla para pintar la forma. Celdas: {paintCount}.
            </CyberText>
            <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", ...CYBER_SCROLL_STYLE }}>
                <ItemDraftPanel
                    draft={draft}
                    onChange={patchDraft}
                    uploadingImage={uploading}
                    showEquip={showEquip}
                    abilityOptions={abilityOptions}
                    traitOptions={traitOptions}
                />
            </Box>
            <Button
                disabled={busy || uploading || paintCount === 0}
                onClick={async () => {
                    committedRef.current = true;
                    const ok = await onCreate?.(draft);
                    if (!ok) committedRef.current = false;
                }}
                sx={{
                    fontFamily: "'Orbitron', sans-serif",
                    fontSize: "10px",
                    color: GOLD,
                    border: `1px solid ${GOLD}`,
                    "&:hover": { bgcolor: `${GOLD}18` },
                    "&.Mui-disabled": { color: `${GOLD}55`, borderColor: `${GOLD}33` },
                }}
            >
                {createLabel}
            </Button>
        </Box>
    );
}
