import { useState, useMemo } from "react";
import { Box, Chip, IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { useSelector, useDispatch } from "react-redux";
import { openWikiOverlay } from "../../store/uiSlice";
import { UI_COLORS } from "../../constants/uiColors";
import { CyberTitle, CyberText } from "../customs/CustomTexts";
import { useCampaignWikiEntities } from "../../hooks/useCampaignWikiEntities";
import { buildWikiVttLinkIndex, getWikiEntityForCharacter } from "../../utils/wikiVttLinkLookup";
import { VttToWikiLinkBadge } from "../wiki/VttWikiLinkBadge";
import CharAvatar from "../characters/CharAvatar";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";
import {
    CharacterStatusBadge,
    CharacterTypeBadge,
    statusLineColor,
} from "../characters/characterBadges";
import { listCampaignCharactersWithLocation } from "../../utils/characterCombat";

const TYPE_FILTERS = ["ALL", "PC", "NPC", "DEAD", "DEITY", "UNASSIGNED"];
const SORT_OPTIONS = [
    { id: "name", label: "Nombre" },
    { id: "type", label: "Tipo" },
    { id: "status", label: "Status" },
    { id: "location", label: "Locación" },
];

function CharCard({ char, locationName, isSelected, onClick, showLocation, wikiEntity }) {
    const status = char.status || "alive";
    return (
        <Box
            onClick={onClick}
            sx={{
                position: "relative",
                p: "12px 14px",
                minHeight: 84,
                borderRadius: 1.25,
                border: `1px solid ${isSelected ? UI_COLORS.anomaly : UI_COLORS.border}`,
                bgcolor: UI_COLORS.backgroundSecondary,
                cursor: "pointer",
                boxShadow: isSelected ? `0 0 18px rgba(0,242,234,0.2)` : "none",
                transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
                "&:hover": {
                    borderColor: UI_COLORS.accent,
                    boxShadow: `0 0 20px rgba(255,102,255,0.15)`,
                    transform: "translateY(-2px)",
                },
                "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    bgcolor: statusLineColor(status),
                    borderRadius: "10px 10px 0 0",
                },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box sx={{ flexShrink: 0, pt: 0.5 }}>
                    <CharAvatar imagePath={char.imageUrl} name={char.name} size={48} status={status} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <CyberTitle
                        sx={{
                            fontSize: "clamp(10px, 0.8vw, 13px)",
                            letterSpacing: "0.08em",
                            color: status === "dead" ? UI_COLORS.textSecondary : UI_COLORS.textPrimary,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            mb: 0.5,
                        }}
                    >
                        {char.name || "???"}
                    </CyberTitle>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
                        <CharacterTypeBadge type={char.type} />
                        <CharacterStatusBadge status={status} />
                        <VttToWikiLinkBadge wikiEntity={wikiEntity} compact />
                    </Box>
                </Box>
            </Box>
            {showLocation && (
                <CyberText sx={{ fontSize: "10px", color: UI_COLORS.textSecondary, display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, pl: 0.25 }}>
                    ◎ {locationName || "SIN LOC"}
                </CyberText>
            )}
        </Box>
    );
}

function DetailPanel({ char, locationName, onClose, onWiki, onEdit, wikiEntity }) {
    if (!char) {
        return (
            <Box
                sx={{
                    width: 280,
                    flexShrink: 0,
                    borderLeft: `1px solid ${UI_COLORS.border}`,
                    bgcolor: UI_COLORS.backgroundSecondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 2,
                }}
            >
                <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary, textAlign: "center", opacity: 0.6 }}>
                    // SELECCIONA UN PERSONAJE
                </CyberText>
            </Box>
        );
    }

    const status = char.status || "alive";

    return (
        <Box
            sx={{
                width: 300,
                flexShrink: 0,
                borderLeft: `1px solid ${UI_COLORS.border}`,
                bgcolor: UI_COLORS.backgroundSecondary,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "auto",
                ...CYBER_SCROLL_STYLE,
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1, borderBottom: `1px solid ${UI_COLORS.border}` }}>
                <CyberText sx={{ fontSize: "9px", color: UI_COLORS.anomaly, letterSpacing: "0.12em" }}>
                    // DETALLE
                </CyberText>
                <IconButton size="small" onClick={onClose} sx={{ color: UI_COLORS.textSecondary }}>
                    <CloseIcon sx={{ fontSize: "1rem" }} />
                </IconButton>
            </Box>

            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, alignItems: "center" }}>
                <CharAvatar imagePath={char.imageUrl} name={char.name} size={72} status={status} />
                <CyberTitle sx={{ fontSize: "14px", letterSpacing: "0.08em", textAlign: "center", color: UI_COLORS.textPrimary }}>
                    {char.name || "???"}
                </CyberTitle>
                <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
                    <CharacterTypeBadge type={char.type} />
                    <CharacterStatusBadge status={status} />
                    <VttToWikiLinkBadge wikiEntity={wikiEntity} />
                </Box>
                <CyberText sx={{ fontSize: "11px", color: UI_COLORS.textSecondary }}>
                    ◎ {locationName || "SIN LOCACIÓN"}
                </CyberText>
            </Box>

            <Box sx={{ px: 1.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 0.75, mt: "auto" }}>
                <Box
                    component="button"
                    type="button"
                    onClick={() => onEdit?.(char)}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        width: "100%",
                        p: 1,
                        borderRadius: 0.75,
                        border: `1px solid ${UI_COLORS.accent}`,
                        bgcolor: `${UI_COLORS.accent}14`,
                        color: UI_COLORS.accent,
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: "10px",
                        letterSpacing: "0.1em",
                        cursor: "pointer",
                        "&:hover": { bgcolor: `${UI_COLORS.accent}28` },
                    }}
                >
                    <EditIcon sx={{ fontSize: "0.95rem" }} />
                    EDITAR FICHA
                </Box>
                <Box
                    component="button"
                    type="button"
                    onClick={onWiki}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        width: "100%",
                        p: 1,
                        borderRadius: 0.75,
                        border: `1px solid ${UI_COLORS.border}`,
                        bgcolor: "transparent",
                        color: UI_COLORS.textPrimary,
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "10px",
                        letterSpacing: "0.08em",
                        cursor: "pointer",
                        "&:hover": { borderColor: UI_COLORS.anomaly, color: UI_COLORS.anomaly },
                    }}
                >
                    <OpenInNewIcon sx={{ fontSize: "0.9rem" }} />
                    {wikiEntity ? "VER FICHA ANEXADA" : "VER EN ARCHIVE"}
                </Box>
            </Box>
        </Box>
    );
}

function SidebarItem({ label, active, color, onClick }) {
    const activeColor = color || UI_COLORS.anomaly;
    return (
        <Box
            onClick={onClick}
            sx={{
                px: 1.75,
                py: 1.1,
                cursor: "pointer",
                borderLeft: `3px solid ${active ? activeColor : "transparent"}`,
                bgcolor: active ? `${activeColor}12` : "transparent",
                color: active ? activeColor : UI_COLORS.textSecondary,
                fontFamily: "'Fira Code', monospace",
                fontSize: "11px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "background-color 0.15s, color 0.15s",
                "&:hover": { bgcolor: "rgba(255,255,255,0.04)", color: "#fff" },
            }}
        >
            {label}
        </Box>
    );
}

/**
 * Roster de campaña por locación (vista principal de PERSONAJES en VTT Configs).
 * @param {{ onCreate?: () => void, onEdit?: (char: object) => void, onMinimizeForWiki?: () => void }} props
 */
export default function CharactersRosterPanel({ onCreate, onEdit, onMinimizeForWiki }) {
    const dispatch = useDispatch();
    const locations = useSelector((s) => s.world.locations);
    const charactersById = useSelector((s) => s.world.charactersById ?? {});
    const campaignId = useSelector((s) => s.world.selectedCampaignId);
    const wikiEntities = useCampaignWikiEntities(campaignId);
    const wikiLinkIndex = useMemo(() => buildWikiVttLinkIndex(wikiEntities), [wikiEntities]);

    const [selectedLocId, setSelectedLocId] = useState("GLOBAL");
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [selectedCharId, setSelectedCharId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("name");

    const allCharsWithLoc = useMemo(
        () => listCampaignCharactersWithLocation(charactersById, locations),
        [charactersById, locations],
    );

    const unassigned = useMemo(
        () => allCharsWithLoc.filter((c) => !c._locationId),
        [allCharsWithLoc],
    );

    const charsByLocationId = useMemo(() => {
        const map = {};
        for (const c of allCharsWithLoc) {
            if (!c._locationId) continue;
            if (!map[c._locationId]) map[c._locationId] = [];
            map[c._locationId].push(c);
        }
        return map;
    }, [allCharsWithLoc]);

    const locFilteredChars = useMemo(() => {
        if (selectedLocId === "GLOBAL") return allCharsWithLoc;
        if (selectedLocId === "UNASSIGNED") return unassigned;
        return allCharsWithLoc.filter((c) => c._locationId === selectedLocId);
    }, [selectedLocId, allCharsWithLoc, unassigned]);

    const filteredChars = useMemo(() => {
        let list = locFilteredChars;
        if (activeFilter === "PC") {
            list = list.filter((c) => {
                const t = (c.type || "").toLowerCase();
                return t === "pc" || t === "player" || Boolean(c.ownerPlayerId);
            });
        } else if (activeFilter === "NPC") {
            list = list.filter((c) => {
                const t = (c.type || "").toLowerCase();
                return !t || t === "npc" || c.isNpc || c.isEnemy;
            });
        } else if (activeFilter === "DEAD") list = list.filter((c) => c.status === "dead");
        else if (activeFilter === "DEITY") list = list.filter((c) => c.status === "deity");
        else if (activeFilter === "UNASSIGNED") list = list.filter((c) => !c._locationId);

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((c) =>
                (c.name || "").toLowerCase().includes(q)
                || (c._locationName || "").toLowerCase().includes(q),
            );
        }

        return [...list].sort((a, b) => {
            if (sortBy === "type") return (a.type || "").localeCompare(b.type || "");
            if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
            if (sortBy === "location") return (a._locationName || "").localeCompare(b._locationName || "");
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [locFilteredChars, activeFilter, searchQuery, sortBy]);

    const selectedChar = filteredChars.find((c) => c.id === selectedCharId) || null;
    const selectedWikiEntity = selectedChar
        ? getWikiEntityForCharacter(wikiLinkIndex, selectedChar.id)
        : null;
    const locList = useMemo(() => Object.values(locations), [locations]);
    const showLocationOnCards = selectedLocId === "GLOBAL" || selectedLocId === "UNASSIGNED";

    const handleWiki = () => {
        if (!selectedChar) return;
        dispatch(openWikiOverlay({
            mode: selectedWikiEntity ? "detail" : "list",
            entityId: selectedWikiEntity?.id || null,
            vttContext: { linkedVttCharacterId: selectedChar.id },
        }));
        onMinimizeForWiki?.();
    };

    return (
        <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            <Box
                sx={{
                    width: 220,
                    flexShrink: 0,
                    borderRight: `1px solid ${UI_COLORS.border}`,
                    bgcolor: `${UI_COLORS.backgroundPrimary}aa`,
                    overflow: "auto",
                    minHeight: 0,
                    ...CYBER_SCROLL_STYLE,
                }}
            >
                <CyberText sx={{ px: 1.75, py: 1.25, fontSize: "9px", color: UI_COLORS.anomaly, letterSpacing: "0.12em", borderBottom: `1px solid ${UI_COLORS.border}` }}>
                    // LOCACIONES
                </CyberText>
                <SidebarItem
                    label={`◈ GLOBAL — ${allCharsWithLoc.length}`}
                    active={selectedLocId === "GLOBAL"}
                    color={UI_COLORS.accent}
                    onClick={() => { setSelectedLocId("GLOBAL"); setSelectedCharId(null); }}
                />
                {locList.map((loc) => (
                    <SidebarItem
                        key={loc.id}
                        label={`${loc.name} · ${charsByLocationId[loc.id]?.length ?? 0}`}
                        active={selectedLocId === loc.id}
                        onClick={() => { setSelectedLocId(loc.id); setSelectedCharId(null); }}
                    />
                ))}
                <SidebarItem
                    label={`◎ Sin asignar · ${unassigned.length}`}
                    active={selectedLocId === "UNASSIGNED"}
                    color="#f97316"
                    onClick={() => { setSelectedLocId("UNASSIGNED"); setSelectedCharId(null); }}
                />
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <Box
                    sx={{
                        px: 2,
                        py: 1,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.75,
                        alignItems: "center",
                        flexShrink: 0,
                    }}
                >
                    <CyberText sx={{ fontSize: "9px", color: UI_COLORS.textSecondary, letterSpacing: "0.1em", mr: 0.5 }}>
                        FILTRAR
                    </CyberText>
                    {TYPE_FILTERS.map((f) => (
                        <Chip
                            key={f}
                            label={f}
                            size="small"
                            onClick={() => setActiveFilter(f)}
                            sx={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "9px",
                                height: 22,
                                bgcolor: activeFilter === f ? `${UI_COLORS.anomaly}14` : "transparent",
                                border: `1px solid ${activeFilter === f ? UI_COLORS.anomaly : UI_COLORS.border}`,
                                color: activeFilter === f ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                "& .MuiChip-label": { px: 1 },
                            }}
                        />
                    ))}
                    <Box
                        component="input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar personaje…"
                        sx={{
                            ml: "auto",
                            width: 180,
                            height: 28,
                            px: 1.25,
                            borderRadius: 0.75,
                            border: `1px solid ${UI_COLORS.border}`,
                            bgcolor: UI_COLORS.backgroundPrimary,
                            color: UI_COLORS.textPrimary,
                            fontSize: "12px",
                            outline: "none",
                            "&:focus": { borderColor: UI_COLORS.anomaly },
                        }}
                    />
                    <Tooltip title="Crear personaje">
                        <IconButton
                            size="small"
                            onClick={() => onCreate?.()}
                            sx={{
                                width: 30,
                                height: 30,
                                borderRadius: 0.75,
                                border: `1px solid ${UI_COLORS.accent}`,
                                color: UI_COLORS.accent,
                                bgcolor: `${UI_COLORS.accent}12`,
                                "&:hover": { bgcolor: `${UI_COLORS.accent}28` },
                            }}
                        >
                            <AddIcon sx={{ fontSize: "1.05rem" }} />
                        </IconButton>
                    </Tooltip>
                </Box>

                <Box sx={{ px: 2, py: 0.5, borderBottom: `1px solid ${UI_COLORS.border}`, display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>
                    <CyberText sx={{ fontSize: "9px", color: UI_COLORS.textSecondary }}>ORDENAR</CyberText>
                    {SORT_OPTIONS.map((opt) => (
                        <Box
                            key={opt.id}
                            component="button"
                            type="button"
                            onClick={() => setSortBy(opt.id)}
                            sx={{
                                background: "none",
                                border: "none",
                                fontFamily: "'Fira Code', monospace",
                                fontSize: "9px",
                                color: sortBy === opt.id ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                p: 0,
                                borderBottom: sortBy === opt.id ? `1px solid ${UI_COLORS.anomaly}` : "1px solid transparent",
                            }}
                        >
                            {opt.label}
                        </Box>
                    ))}
                    <CyberText sx={{ ml: "auto", fontSize: "9px", color: UI_COLORS.textSecondary }}>
                        {filteredChars.length} resultado{filteredChars.length !== 1 ? "s" : ""}
                    </CyberText>
                </Box>

                <Box sx={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
                    <Box
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "auto",
                            p: 2,
                            display: "grid",
                            gridTemplateColumns: selectedChar
                                ? "repeat(auto-fill, minmax(200px, 1fr))"
                                : "repeat(auto-fill, minmax(200px, 1fr))",
                            gridAutoRows: "minmax(84px, auto)",
                            gap: 1.5,
                            alignContent: "start",
                            ...CYBER_SCROLL_STYLE,
                        }}
                    >
                        {filteredChars.length === 0 ? (
                            <Box sx={{ gridColumn: "1 / -1", py: 6, textAlign: "center", color: UI_COLORS.textSecondary, fontFamily: "'Fira Code', monospace", fontSize: "11px", opacity: 0.5 }}>
                                // NO HAY PERSONAJES EN ESTA VISTA
                            </Box>
                        ) : (
                            filteredChars.map((char) => (
                                <CharCard
                                    key={char.id}
                                    char={char}
                                    locationName={char._locationName}
                                    showLocation={showLocationOnCards}
                                    isSelected={char.id === selectedCharId}
                                    wikiEntity={getWikiEntityForCharacter(wikiLinkIndex, char.id)}
                                    onClick={() => setSelectedCharId((prev) => (prev === char.id ? null : char.id))}
                                />
                            ))
                        )}
                    </Box>

                    {selectedChar && (
                        <DetailPanel
                            char={selectedChar}
                            locationName={selectedChar._locationName}
                            wikiEntity={selectedWikiEntity}
                            onClose={() => setSelectedCharId(null)}
                            onWiki={handleWiki}
                            onEdit={onEdit}
                        />
                    )}
                </Box>
            </Box>
        </Box>
    );
}
