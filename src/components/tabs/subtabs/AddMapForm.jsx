import { useState, useEffect, useRef, useCallback } from "react";
import { Box, Stack, Grid } from "@mui/material";
import { useDispatch } from "react-redux";
import { CyberInput, CyberButton } from "../../customs/CyberInputs";
import { CyberText } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { createMapDoc } from "../../../../firebase/services/mapService";
import {
    uploadMapImage,
    deleteStorageFile,
} from "../../../../firebase/services/assetLoader";
import { showSnackbar } from "../../../store/uiSlice";
import WikiImageUpload from "../../wiki/WikiImageUpload";

const DEFAULT_MAP = {
    name: "",
    description: "",
    imageUrl: "",
    width: 2048,
    height: 2048,
    metersPerPixel: 1,
    unit: "m",
};

function readImageDimensions(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const width = img.naturalWidth || 2048;
            const height = img.naturalHeight || 2048;
            URL.revokeObjectURL(url);
            resolve({ width, height });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 2048, height: 2048 });
        };
        img.src = url;
    });
}

export default function AddMapForm({ campaignId, onCreated }) {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState(DEFAULT_MAP);

    const pendingPathRef = useRef(null);
    const committedRef = useRef(false);

    const discardPending = useCallback(async () => {
        const path = pendingPathRef.current;
        pendingPathRef.current = null;
        if (!path || committedRef.current) return;
        try {
            await deleteStorageFile(path);
        } catch (e) {
            console.warn("No se pudo borrar imagen de mapa pendiente:", e);
        }
    }, []);

    useEffect(() => () => {
        if (!committedRef.current) {
            discardPending();
        }
    }, [discardPending]);

    const handleChange = (field) => (e) => {
        const value = e.target.value;
        setFormData((prev) => ({
            ...prev,
            [field]: ["width", "height", "metersPerPixel"].includes(field) ? Number(value) : value,
        }));
    };

    const handleUpload = useCallback(
        async (file) => {
            if (!campaignId) throw new Error("Sin campaña");
            const dims = await readImageDimensions(file);
            const result = await uploadMapImage(campaignId, file);
            if (pendingPathRef.current && pendingPathRef.current !== result.path) {
                await deleteStorageFile(pendingPathRef.current).catch(() => {});
            }
            pendingPathRef.current = result.path;
            setFormData((prev) => ({
                ...prev,
                imageUrl: result.path,
                width: dims.width,
                height: dims.height,
            }));
            return result;
        },
        [campaignId]
    );

    const handleImageChange = useCallback(
        async (url) => {
            if (!url) {
                await discardPending();
                setFormData((prev) => ({ ...prev, imageUrl: "" }));
                return;
            }
            // Prefer Storage path (set in upload) over download URL from WikiImageUpload
            setFormData((prev) => ({
                ...prev,
                imageUrl: pendingPathRef.current || url,
            }));
        },
        [discardPending]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!campaignId) return;
        if (!formData.imageUrl?.trim()) {
            dispatch(showSnackbar({ message: "Sube una imagen del mapa.", severity: "warning" }));
            return;
        }
        if (!formData.name?.trim()) {
            dispatch(showSnackbar({ message: "Indica un nombre para el mapa.", severity: "warning" }));
            return;
        }
        setLoading(true);
        try {
            await createMapDoc({
                ...formData,
                campaignId,
                createdAt: new Date(),
            });
            committedRef.current = true;
            pendingPathRef.current = null;
            dispatch(showSnackbar({ message: "Mapa registrado correctamente.", severity: "success" }));
            setFormData(DEFAULT_MAP);
            onCreated?.();
        } catch (error) {
            console.error("Error adding map:", error);
            dispatch(showSnackbar({ message: "Error al crear el mapa.", severity: "error" }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 640, pt: 1.5 }}>
            <Stack spacing={2}>
                <CyberInput label="NOMBRE DEL MAPA" value={formData.name} onChange={handleChange("name")} required />
                <WikiImageUpload
                    value={formData.imageUrl || null}
                    onChange={handleImageChange}
                    uploadImage={handleUpload}
                    label="Imagen del mapa"
                    helperText="Arrastra o selecciona un archivo. Si cancelas sin crear el mapa, la imagen se elimina."
                    variant="banner"
                    maxMb={40}
                />
                <CyberInput
                    label="DESCRIPCIÓN"
                    value={formData.description}
                    onChange={handleChange("description")}
                    multiline
                    rows={2}
                />
                <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                        <CyberInput label="ANCHO (px)" type="number" value={formData.width} onChange={handleChange("width")} required />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <CyberInput label="ALTO (px)" type="number" value={formData.height} onChange={handleChange("height")} required />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <CyberInput label="METROS / PÍXEL" type="number" value={formData.metersPerPixel} onChange={handleChange("metersPerPixel")} required />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                        <CyberInput label="UNIDAD (m/km)" value={formData.unit} onChange={handleChange("unit")} required />
                    </Grid>
                </Grid>
                <CyberText sx={{ fontSize: "0.65rem", color: UI_COLORS.textSecondary }}>
                    Ancho/alto se rellenan al subir la imagen; puedes ajustarlos si hace falta.
                </CyberText>
                <Box>
                    <CyberButton loading={loading}>CREAR MAPA</CyberButton>
                </Box>
            </Stack>
        </Box>
    );
}
