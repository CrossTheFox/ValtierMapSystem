import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import { CyberText } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { useAssetUrl } from "../../../hooks/useAssetUrl";
import {
    ITEM_EQUIP_KIND_META,
    ITEM_EQUIP_KINDS,
    sanitizeEquipSlots,
} from "../../../utils/campaignItems";

const GOLD = UI_COLORS.loot;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const chipSx = (on, color = GOLD) => ({
    fontFamily: "'Orbitron', sans-serif",
    fontSize: "9px",
    letterSpacing: "0.1em",
    minHeight: 26,
    color: on ? "#000" : UI_COLORS.textPrimary,
    bgcolor: on ? color : "transparent",
    border: `1px solid ${on ? color : UI_COLORS.border}`,
    "&:hover": { bgcolor: on ? color : `${color}22` },
});

function usePreviewUrl(file, remotePath) {
    const remote = useAssetUrl(remotePath);
    const [blob, setBlob] = useState(null);
    useEffect(() => {
        if (!file) {
            setBlob(null);
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setBlob(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return blob || remote;
}

export default function ItemEquipFields({
    equipable = false,
    equipSlots = [],
    imageFile = null,
    imageUrl = null,
    uploading = false,
    onChange,
}) {
    const slots = sanitizeEquipSlots(equipSlots);
    const patch = (partial) => onChange?.(partial);
    const [localFile, setLocalFile] = useState(null);
    const preview = usePreviewUrl(imageFile || localFile, imageUrl);
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        setLocalFile(null);
    }, [imageUrl]);

    const toggleKind = (kind) => {
        const next = slots.includes(kind)
            ? slots.filter((k) => k !== kind)
            : [...slots, kind];
        patch({ equipSlots: next, equipable: true });
    };

    const takeFile = (file) => {
        if (!file) return;
        if (!ACCEPTED.includes(file.type)) {
            setError("Usa JPG, PNG, WEBP o GIF.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("La imagen no puede superar 5 MB.");
            return;
        }
        setError("");
        setLocalFile(file);
        patch({ _imageFile: file });
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
            <Button
                onClick={() => patch({
                    equipable: !equipable,
                    equipSlots: !equipable ? slots : [],
                })}
                sx={chipSx(equipable)}
            >
                {equipable ? "EQUIPABLE · SÍ" : "EQUIPABLE · NO"}
            </Button>
            {equipable ? (
                <>
                    <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary }}>
                        Nodos donde el DM permite encajarlo.
                    </CyberText>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {Object.values(ITEM_EQUIP_KINDS).map((kind) => {
                            const meta = ITEM_EQUIP_KIND_META[kind];
                            return (
                                <Button
                                    key={kind}
                                    onClick={() => toggleKind(kind)}
                                    sx={{ ...chipSx(slots.includes(kind), meta.color), px: 0.8 }}
                                >
                                    {meta.label}
                                </Button>
                            );
                        })}
                    </Box>
                </>
            ) : null}

            <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary }}>
                Imagen del nodo · arrastra o click. No se ve en el maletín.
            </CyberText>
            <Box
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    takeFile(e.dataTransfer.files?.[0] || null);
                }}
                sx={{
                    position: "relative",
                    height: 96,
                    border: `1.5px dashed ${dragging ? UI_COLORS.accent : preview ? `${GOLD}88` : UI_COLORS.border}`,
                    borderRadius: "6px",
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: dragging ? `${UI_COLORS.accent}14` : "rgba(6,6,10,0.7)",
                    boxShadow: dragging ? `0 0 12px ${UI_COLORS.accentGlow}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    hidden
                    accept={ACCEPTED.join(",")}
                    onChange={(e) => {
                        takeFile(e.target.files?.[0] || null);
                        e.target.value = "";
                    }}
                />
                {uploading ? (
                    <CircularProgress size={22} sx={{ color: GOLD }} />
                ) : preview ? (
                    <Box
                        component="img"
                        src={preview}
                        alt="Nodo"
                        sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                ) : (
                    <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary, letterSpacing: "0.08em" }}>
                        {dragging ? "SOLTAR IMAGEN" : "ARRASTRAR IMAGEN"}
                    </CyberText>
                )}
            </Box>
            {preview ? (
                <Button
                    onClick={() => {
                        setLocalFile(null);
                        patch({ _imageFile: null, imageUrl: null });
                    }}
                    sx={{ ...chipSx(false, UI_COLORS.danger), alignSelf: "flex-start" }}
                >
                    QUITAR IMAGEN
                </Button>
            ) : null}
            {error ? (
                <CyberText sx={{ fontSize: "10px", color: UI_COLORS.danger }}>{error}</CyberText>
            ) : null}
        </Box>
    );
}
