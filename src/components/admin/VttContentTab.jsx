import { useState, useEffect } from "react";
import { Box, Button } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { setDialogMinimized } from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import AdminSidebarNav from "./AdminSidebarNav";
import LocationsSubTab from "../tabs/subtabs/LocationsSubTab";
import AbilityEditorPanel from "./AbilityEditorPanel";
import TagsEditorPanel from "./TagsEditorPanel";
import { DEFAULT_RULE_SYSTEM } from "../../constants/ruleSystems";

const SUB_ITEMS = [
    { id: "LOCATIONS", label: "LOCACIONES", hint: "Marcadores del mapa" },
    { id: "JOBS", label: "JOBS / ABILITIES", hint: "Combat stats + comandos" },
    { id: "TAGS", label: "TAGS", hint: "Pierce, statuses, efectos" },
    { id: "OBJECTS", label: "OBJETOS", hint: "Inventario / ítems (próx.)" },
];

function ObjectsPlaceholder() {
    return (
        <Box
            sx={{
                p: 3,
                border: `1px dashed ${UI_COLORS.border}`,
                borderRadius: 1.5,
                bgcolor: `${UI_COLORS.backgroundPrimary}88`,
                maxWidth: 480,
            }}
        >
            <CyberTitle sx={{ fontSize: "0.85rem", color: UI_COLORS.accent, letterSpacing: "0.12em", mb: 1 }}>
                OBJETOS
            </CyberTitle>
            <CyberText sx={{ fontSize: "0.78rem", color: UI_COLORS.textPrimary, mb: 1, lineHeight: 1.5 }}>
                Placeholder para el catálogo de objetos, ítems y equipo de campaña.
            </CyberText>
            <CyberText sx={{ fontSize: "0.7rem", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace" }}>
                // PENDING — inventario · loot · reliquias VTT
            </CyberText>
        </Box>
    );
}

/** Contendido VTT: Locaciones, Jobs/Abilities, Objetos (placeholder). */
export default function VttContentTab({ campaignId, initialSub = null, initialJobId = null }) {
    const dispatch = useDispatch();
    const rulesSystem = useSelector((s) => s.world.rulesSystem) || DEFAULT_RULE_SYSTEM;
    const [activeSub, setActiveSub] = useState(initialSub || "LOCATIONS");
    const [locations, setLocations] = useState([]);
    const [maps, setMaps] = useState([]);

    useEffect(() => {
        if (initialSub) setActiveSub(initialSub);
    }, [initialSub]);

    useEffect(() => {
        if (!campaignId) return undefined;

        let locUnsub = null;
        const qMaps = query(collection(db, "maps"), where("campaignId", "==", campaignId));
        const unsubMaps = onSnapshot(qMaps, (snap) => {
            const mapList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setMaps(mapList);

            if (locUnsub) {
                locUnsub();
                locUnsub = null;
            }

            if (mapList.length > 0) {
                const mapIds = mapList.map((m) => m.id);
                const qLoc = query(collection(db, "locations"), where("mapId", "in", mapIds));
                locUnsub = onSnapshot(qLoc, (s) => {
                    setLocations(s.docs.map((d) => ({ id: d.id, ...d.data() })));
                });
                return;
            }
            setLocations([]);
        });

        return () => {
            unsubMaps();
            if (locUnsub) locUnsub();
        };
    }, [campaignId]);

    const handleFocusMap = () => {
        dispatch(setDialogMinimized({ id: DIALOG_IDS.SETTINGS, value: true }));
    };

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, gap: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={handleFocusMap}
                    sx={{
                        fontSize: "0.62rem",
                        fontFamily: "'Orbitron', sans-serif",
                        color: UI_COLORS.anomaly,
                        borderColor: `${UI_COLORS.anomaly}66`,
                        "&:hover": { borderColor: UI_COLORS.anomaly, bgcolor: `${UI_COLORS.anomaly}10` },
                    }}
                >
                    MINIMIZAR Y VER MAPA
                </Button>
            </Box>
            <Box sx={{ display: "flex", flex: 1, minHeight: 0, gap: 2 }}>
                <AdminSidebarNav items={SUB_ITEMS} activeId={activeSub} onChange={setActiveSub} />
                <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", pr: 0.5, ...CYBER_SCROLL_STYLE }}>
                    {activeSub === "LOCATIONS" && (
                        <LocationsSubTab currentCampaignId={campaignId} locations={locations} maps={maps} />
                    )}
                    {activeSub === "JOBS" && (
                        <AbilityEditorPanel campaignId={campaignId} initialJobId={initialJobId} />
                    )}
                    {activeSub === "TAGS" && (
                        <TagsEditorPanel campaignId={campaignId} rulesSystem={rulesSystem} />
                    )}
                    {activeSub === "OBJECTS" && <ObjectsPlaceholder />}
                </Box>
            </Box>
        </Box>
    );
}
