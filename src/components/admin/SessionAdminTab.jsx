import { useEffect, useState } from "react";
import { Box, Switch, FormControlLabel, Slider } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { CyberText } from "../customs/CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { setGridConfig, persistMapGridConfig } from "../../store/worldSlice";
import { subscribeToGameSession } from "../../../firebase/services/gameService";
import AdminSectionShell from "./AdminSectionShell";

export default function SessionAdminTab({ campaignId }) {
    const dispatch = useDispatch();
    const gridConfig = useSelector((s) => s.world.gridConfig);
    const activeMapId = useSelector((s) => s.world.activeMapId);
    const maps = useSelector((s) => s.world.maps);
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        if (!campaignId) return undefined;
        return subscribeToGameSession(campaignId, setGameState);
    }, [campaignId]);

    const mapName = (id) => maps.find((m) => m.id === id)?.name || id || "—";
    const mapId = activeMapId;

    const persistShared = (partial) => {
        if (!mapId) {
            dispatch(setGridConfig(partial));
            return;
        }
        dispatch(persistMapGridConfig({ mapId, partial }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", ...CYBER_SCROLL_STYLE }}>
            <AdminSectionShell
                title="GRILLA TÁCTICA"
                hint="Snap y tamaño de celda se guardan en el mapa activo (compartidos). Mostrar grilla es preferencia local."
            >
                <FormControlLabel
                    control={
                        <Switch
                            checked={Boolean(gridConfig?.visible)}
                            onChange={(e) => dispatch(setGridConfig({ visible: e.target.checked }))}
                            sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.accent },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: `${UI_COLORS.accent}88` },
                            }}
                        />
                    }
                    label={<CyberText sx={{ fontSize: "0.78rem" }}>Mostrar grilla (local)</CyberText>}
                />
                <FormControlLabel
                    control={
                        <Switch
                            checked={gridConfig?.snap !== false}
                            onChange={(e) => persistShared({ snap: e.target.checked })}
                            sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": { color: UI_COLORS.accent },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: `${UI_COLORS.accent}88` },
                            }}
                        />
                    }
                    label={<CyberText sx={{ fontSize: "0.78rem" }}>Snap a grilla (mapa)</CyberText>}
                />
                <Box sx={{ px: 0.5, mt: 1 }}>
                    <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, mb: 0.5 }}>
                        Tamaño de celda: {gridConfig?.cellSize ?? "auto"}{gridConfig?.cellSize ? "px" : ""}
                    </CyberText>
                    <Slider
                        value={gridConfig?.cellSize ?? 70}
                        min={20}
                        max={120}
                        step={5}
                        onChange={(_, v) => persistShared({ cellSize: v })}
                        sx={{
                            color: UI_COLORS.accent,
                            "& .MuiSlider-thumb": { border: `2px solid ${UI_COLORS.accent}` },
                        }}
                    />
                </Box>
            </AdminSectionShell>

            <AdminSectionShell title="ESTADO DE SESIÓN" hint="Documento game/{campaignId} en Firestore.">
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, minWidth: 160 }}>Mapa local (DJ)</CyberText>
                        <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.accent }}>{mapName(activeMapId)}</CyberText>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, minWidth: 160 }}>Mapa publicado (jugadores)</CyberText>
                        <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.anomaly }}>{mapName(gameState?.activeMapId)}</CyberText>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                        <CyberText sx={{ fontSize: "0.68rem", color: UI_COLORS.textSecondary, minWidth: 160 }}>Tokens en mapa</CyberText>
                        <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary }}>
                            {Object.keys(gameState?.tokenPositions?.[activeMapId] || {}).length} token(s) en mapa local
                        </CyberText>
                    </Box>
                </Box>
            </AdminSectionShell>
        </Box>
    );
}
