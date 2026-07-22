import { useState, useEffect } from "react";
import { Box, Button } from "@mui/material";
import { useDispatch } from "react-redux";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { UI_COLORS } from "../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import { setDialogMinimized } from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import AdminSidebarNav from "./AdminSidebarNav";
import LocationsSubTab from "../tabs/subtabs/LocationsSubTab";
import CharactersSubTab from "../tabs/subtabs/CharactersSubTab";

const SUB_ITEMS = [
    { id: "LOCATIONS", label: "LOCACIONES", hint: "Marcadores del mapa" },
    { id: "CHARACTERS", label: "PERSONAJES", hint: "Fichas VTT / ICON" },
];

export default function VttContentTab({ campaignId }) {
    const dispatch = useDispatch();
    const [activeSub, setActiveSub] = useState("LOCATIONS");
    const [locations, setLocations] = useState([]);
    const [maps, setMaps] = useState([]);

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
                    {activeSub === "CHARACTERS" && (
                        <CharactersSubTab currentCampaignId={campaignId} locations={locations} />
                    )}
                </Box>
            </Box>
        </Box>
    );
}
