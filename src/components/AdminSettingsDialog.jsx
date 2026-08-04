import { useState, useEffect } from "react";
import { Box } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PeopleIcon from "@mui/icons-material/People";
import MapIcon from "@mui/icons-material/Map";
import CategoryIcon from "@mui/icons-material/Category";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TuneIcon from "@mui/icons-material/Tune";
import { useSelector } from "react-redux";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import BaseTabbedDialog, { TabPanel } from "./BaseTabbedDialog";
import { CyberText } from "./customs/CustomTexts";
import { UI_COLORS } from "../constants/uiColors";
import usePopout from "../hooks/usePopout";
import AdminEmptyCampaign from "./admin/AdminEmptyCampaign";
import CharactersAdminTab from "./admin/CharactersAdminTab";
import PlayersAdminTab from "./admin/PlayersAdminTab";
import MapsAdminTab from "./admin/MapsAdminTab";
import VttContentTab from "./admin/VttContentTab";
import WikiAdminTab from "./admin/WikiAdminTab";
import SessionAdminTab from "./admin/SessionAdminTab";
import WikiAiConfigDialog from "./wiki/WikiAiConfigDialog";

function useAdminStats(campaignId) {
    const [stats, setStats] = useState({ players: 0, maps: 0, locations: 0, wiki: 0, characters: 0 });

    useEffect(() => {
        if (!campaignId) {
            setStats({ players: 0, maps: 0, locations: 0, wiki: 0, characters: 0 });
            return undefined;
        }

        const unsubs = [];

        unsubs.push(
            onSnapshot(
                query(collection(db, "players"), where("campaignIds", "array-contains", campaignId)),
                (snap) => setStats((s) => ({ ...s, players: snap.size })),
            ),
        );

        unsubs.push(
            onSnapshot(
                query(collection(db, "characters"), where("campaignId", "==", campaignId)),
                (snap) => setStats((s) => ({ ...s, characters: snap.size })),
            ),
        );

        let locUnsub = null;
        unsubs.push(
            onSnapshot(
                query(collection(db, "maps"), where("campaignId", "==", campaignId)),
                (snap) => {
                    setStats((s) => ({ ...s, maps: snap.size }));
                    if (locUnsub) locUnsub();
                    const mapIds = snap.docs.map((d) => d.id);
                    if (!mapIds.length) {
                        setStats((s) => ({ ...s, locations: 0 }));
                        return;
                    }
                    locUnsub = onSnapshot(
                        query(collection(db, "locations"), where("mapId", "in", mapIds)),
                        (locSnap) => setStats((s) => ({ ...s, locations: locSnap.size })),
                    );
                },
            ),
        );

        unsubs.push(
            onSnapshot(collection(db, "campaigns", campaignId, "wikiEntities"), (snap) => {
                setStats((s) => ({ ...s, wiki: snap.size }));
            }),
        );

        return () => {
            unsubs.forEach((u) => u());
            if (locUnsub) locUnsub();
        };
    }, [campaignId]);

    return stats;
}

function CampaignStatsBar({ stats }) {
    const items = [
        { label: "PERSONAJES", value: stats.characters },
        { label: "JUGADORES", value: stats.players },
        { label: "MAPAS", value: stats.maps },
        { label: "LOCACIONES", value: stats.locations },
        { label: "WIKI", value: stats.wiki },
    ];
    return (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 0.5, pb: 0.5 }}>
            {items.map(({ label, value }) => (
                <Box
                    key={label}
                    sx={{
                        px: 1,
                        py: 0.35,
                        border: `1px solid ${UI_COLORS.border}`,
                        borderRadius: 0.75,
                        bgcolor: `${UI_COLORS.backgroundPrimary}88`,
                    }}
                >
                    <CyberText sx={{ fontSize: "0.55rem", color: UI_COLORS.textSecondary, letterSpacing: 0.8 }}>
                        {label}
                    </CyberText>
                    <CyberText sx={{ fontSize: "0.72rem", color: UI_COLORS.anomaly, fontWeight: 700, lineHeight: 1.2 }}>
                        {value}
                    </CyberText>
                </Box>
            ))}
        </Box>
    );
}

/** Panel DM unificado: roster, jugadores, mapas, contenido, wiki y sesión. */
export default function AdminSettingsDialog({ open, onClose, popupMode = false }) {
    const [tab, setTab] = useState(0);
    const [contentSub, setContentSub] = useState(null);
    const [focusJobId, setFocusJobId] = useState(null);
    const [aiConfigOpen, setAiConfigOpen] = useState(false);
    const { isPopped, popout } = usePopout("admin");

    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const campaignName = useSelector((s) => s.world.selectedCampaignName);
    const narrativeSettings = useSelector((s) => s.wiki.narrativeSettings);
    const uid = useSelector((s) => s.player.profile?.uid);
    const settingsFocus = useSelector((s) => s.ui.settingsFocus);

    const stats = useAdminStats(campaignId);

    useEffect(() => {
        if (!open || !settingsFocus?.nonce) return;
        if (Number.isFinite(settingsFocus.tab)) setTab(settingsFocus.tab);
        setContentSub(settingsFocus.contentSub || null);
        setFocusJobId(settingsFocus.jobId || null);
    }, [open, settingsFocus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

    const adminTabs = [
        { label: "PERSONAJES", icon: <PersonIcon /> },
        { label: "JUGADORES", icon: <PeopleIcon /> },
        { label: "MAPAS", icon: <MapIcon /> },
        { label: "CONTENIDO", icon: <CategoryIcon /> },
        { label: "WIKI", icon: <MenuBookIcon /> },
        { label: "SESIÓN", icon: <TuneIcon /> },
    ];

    const subtitle = campaignName
        ? `// ${campaignName.toUpperCase()}`
        : campaignId
            ? `// ${campaignId.slice(0, 8)}…`
            : "// SIN CAMPAÑA";

    const handlePopout = () => {
        popout();
        onClose();
    };

    const tabContent = !campaignId ? (
        <AdminEmptyCampaign />
    ) : (
        <>
            <TabPanel isSelected={tab === 0} pValue={0}>
                <CharactersAdminTab campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 1} pValue={2}>
                <PlayersAdminTab campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 2} pValue={2}>
                <MapsAdminTab campaignId={campaignId} />
            </TabPanel>
            <TabPanel isSelected={tab === 3} pValue={1}>
                <VttContentTab
                    campaignId={campaignId}
                    initialSub={contentSub}
                    initialJobId={focusJobId}
                />
            </TabPanel>
            <TabPanel isSelected={tab === 4} pValue={2}>
                <WikiAdminTab campaignId={campaignId} onOpenAiConfig={() => setAiConfigOpen(true)} />
            </TabPanel>
            <TabPanel isSelected={tab === 5} pValue={2}>
                <SessionAdminTab campaignId={campaignId} />
            </TabPanel>
        </>
    );

    return (
        <>
            <BaseTabbedDialog
                open={open}
                onClose={onClose}
                title="VTT CONFIGS"
                subtitle={subtitle}
                tabs={adminTabs}
                activeTab={tab}
                setActiveTab={setTab}
                popupMode={popupMode}
                isPopped={isPopped}
                onPopout={handlePopout}
                dialogId="settings"
                sizePreset="xl"
            >
                {campaignId && (
                    <Box sx={{ px: 2, pt: 1, flexShrink: 0 }}>
                        <CampaignStatsBar stats={stats} />
                    </Box>
                )}
                {tabContent}
            </BaseTabbedDialog>

            <WikiAiConfigDialog
                open={aiConfigOpen}
                onClose={() => setAiConfigOpen(false)}
                narrativeSettings={narrativeSettings}
                campaignId={campaignId}
                uid={uid}
            />
        </>
    );
}
