import { Box, Stack, IconButton, CircularProgress } from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { CyberButton } from "./customs/CyberInputs";
import { CyberText } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import { loadFirebaseAsset } from "../../firebase/services/assetLoader";
import DeleteIcon from '@mui/icons-material/Delete';

export const EntityImageManager = ({ 
    item, 
    onUpdate, 
    onMarkForDeletion, 
    uploadFn, // <--- Nueva Prop
    aspectRatio = '1/1' // <--- Opcional para diseño
}) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Usamos la función de subida que nos pasen por props
            console.log("Uploading file for item:", item);
            const { path } = await uploadFn(item.id, file);
            onUpdate({ ...item, imageUrl: path });
        } catch (error) {
            console.error("UPLOAD_ERROR", error);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!item.imageUrl) return;
        try {
            onMarkForDeletion(item.imageUrl);
            onUpdate({ ...item, imageUrl: null });
        } catch (error) {
            console.error("DELETE_ERROR", error);
        }
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <Box sx={{ 
            width: '100%', 
            height: '250px', // Aumentado un poco para mejor visibilidad
            border: `1px dashed ${UI_COLORS.accent}66`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'rgba(0,0,0,0.5)',
            transition: 'all 0.3s ease',
            '&:hover': {
                borderColor: UI_COLORS.accent,
                backgroundColor: 'rgba(0,0,0,0.7)',
            }
        }}>
            {/* Input oculto manejado por Ref */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
            />

            {item.imageUrl ? (
                <>
                    {/* Botón de eliminar arriba a la derecha */}
                    <IconButton 
                        onClick={handleDelete}
                        sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8, 
                            zIndex: 10,
                            color: UI_COLORS.accent,
                            bgcolor: 'rgba(0,0,0,0.6)',
                            '&:hover': {
                                bgcolor: '#ff005533',
                                color: '#ff0055'
                            }
                        }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>

                    <CharacterImagePreview path={item.imageUrl} />
                </>
            ) : (
                <Stack spacing={2} alignItems="center">
                    {uploading ? (
                        <CircularProgress size={24} sx={{ color: UI_COLORS.accent }} />
                    ) : (
                        <>
                            <CyberText variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '2px' }}>
                                NO_IMAGE_DETECTED
                            </CyberText>
                            <CyberButton 
                                onClick={triggerUpload}
                                loading={uploading}
                            >
                                UPLOAD_DATA
                            </CyberButton>
                        </>
                    )}
                </Stack>
            )}
        </Box>
    );
};

export const CharacterImagePreview = ({ path }) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (path) loadFirebaseAsset(path).then(setUrl);
    }, [path]);

    return url ? (
        <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    ) : <CyberText>LOADING...</CyberText>;
};