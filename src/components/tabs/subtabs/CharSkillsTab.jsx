import React, { useState, useEffect, useMemo } from "react";
import { Box, Stack, CircularProgress, Paper, Grid, Collapse } from "@mui/material";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import { getAbilitiesByIds } from "../../../../firebase/services/characterService";
import { CyberTitle, CyberText } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";
import { formatClassLabel } from "../../../constants/characterSheetTokens";

function CostBadge({ cost }) {
    if (!cost) return null;
    const c = String(cost).toLowerCase();
    let sx = { color: UI_COLORS.accent, borderColor: "rgba(255,102,255,0.4)", bgcolor: "rgba(255,102,255,0.08)" };
    if (c.includes("round") || c.includes("ronda")) {
        sx = { color: "#f97316", borderColor: "rgba(249,115,22,0.4)", bgcolor: "rgba(249,115,22,0.08)" };
    } else if (c.includes("free") || c.includes("gratis") || c === "0") {
        sx = { color: "#22c55e", borderColor: "rgba(34,197,94,0.4)", bgcolor: "rgba(34,197,94,0.08)" };
    }
    return (
        <CyberText
            sx={{
                fontFamily: "monospace",
                fontSize: "0.58rem",
                px: 0.9,
                py: 0.2,
                borderRadius: 0.5,
                border: "1px solid",
                whiteSpace: "nowrap",
                ...sx,
            }}
        >
            {String(cost).toUpperCase()}
        </CyberText>
    );
}

const SkillCard = ({ ability, upgrades = [], accentColor = UI_COLORS.accent, listMode = false }) => (
    <Paper
        elevation={0}
        sx={{
            p: listMode ? 1.5 : 2,
            height: listMode ? "auto" : "100%",
            background: "rgba(255, 255, 255, 0.03)",
            borderLeft: `3px solid ${accentColor}`,
            border: `1px solid ${UI_COLORS.border}`,
            borderLeftWidth: 3,
            color: "#fff",
            clipPath: listMode ? "none" : "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)",
            display: "flex",
            flexDirection: "column",
        }}
    >
        <Stack spacing={1} sx={{ flexGrow: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                <CyberTitle sx={{ color: accentColor, fontSize: listMode ? "0.8rem" : "0.95rem", lineHeight: 1.2, textTransform: "uppercase" }}>
                    {ability.label}
                </CyberTitle>
                <CostBadge cost={ability.cost} />
            </Box>
            {ability.tags?.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {ability.tags.map((tag, index) => (
                        <Box
                            key={index}
                            sx={{
                                px: 0.75,
                                py: 0.15,
                                fontSize: "0.58rem",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "rgba(255,255,255,0.45)",
                                borderRadius: 0.5,
                                fontFamily: "monospace",
                                textTransform: "uppercase",
                            }}
                        >
                            {tag}
                        </Box>
                    ))}
                </Box>
            )}
            {ability.content && (
                <CyberText sx={{ fontSize: listMode ? "0.78rem" : "0.85rem", lineHeight: 1.5, color: "#fff", opacity: 0.9 }}>
                    {ability.content}
                </CyberText>
            )}
            {upgrades.length > 0 && (
                <Stack spacing={0.75} sx={{ mt: "auto", pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {upgrades.map((upg) => (
                        <Box key={upg.id} sx={{ pl: 1, borderLeft: "2px solid #f59e0b" }}>
                            <CyberText sx={{ color: "#f59e0b", fontSize: "0.72rem", fontWeight: "bold" }}>
                                MOD: {upg.label?.toUpperCase()}
                            </CyberText>
                            {upg.content && (
                                <CyberText sx={{ fontSize: "0.76rem", opacity: 0.8, color: "#fff" }}>{upg.content}</CyberText>
                            )}
                        </Box>
                    ))}
                </Stack>
            )}
        </Stack>
    </Paper>
);

const GenericSkillSection = ({ group, upgrades, listMode }) => {
    const [isOpen, setIsOpen] = useState(true);

    const cards = group.items.map((item) => (
        <SkillCard
            key={item.id}
            ability={item}
            upgrades={upgrades.filter((u) => u.parentId === item.key)}
            accentColor={group.color}
            listMode={listMode}
        />
    ));

    return (
        <Box sx={{ mb: 4 }}>
            {group.isCollapsible ? (
                <Box
                    onClick={() => setIsOpen(!isOpen)}
                    sx={{ display: "flex", alignItems: "center", cursor: "pointer", mb: 1.5, userSelect: "none" }}
                >
                    <CyberText sx={{ color: group.color, transform: isOpen ? "rotate(90deg)" : "none", mr: 1 }}>{`>`}</CyberText>
                    <CyberText sx={{ color: group.color, letterSpacing: 2, fontSize: "0.68rem" }}>{group.title}</CyberText>
                </Box>
            ) : (
                <CyberText sx={{ color: group.color, opacity: 0.8, letterSpacing: 2, fontSize: "0.68rem", mb: 1.5, display: "block" }}>
                    {group.title}
                </CyberText>
            )}
            {group.isCollapsible ? (
                <Collapse in={isOpen}>{listMode ? <Stack spacing={1.25}>{cards}</Stack> : (
                    <Grid container spacing={2}>{group.items.map((item, i) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>{cards[i]}</Grid>
                    ))}</Grid>
                )}</Collapse>
            ) : listMode ? (
                <Stack spacing={1.25}>{cards}</Stack>
            ) : (
                <Grid container spacing={2}>{group.items.map((item, i) => (
                    <Grid size={group.gridSize || 4} key={item.id}>{cards[i]}</Grid>
                ))}</Grid>
            )}
        </Box>
    );
};

function abilityMatchesJob(ability, jobId) {
    if (!jobId || jobId === "ALL") return true;
    const key = (ability.key || "").toLowerCase();
    const id = jobId.toLowerCase();
    if (key.includes(id)) return true;
    return (ability.tags || []).some((t) => String(t).toLowerCase().includes(id));
}

export default function CharSkillsTab({ character, playerMode = false }) {
    const [abilities, setAbilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [jobFilter, setJobFilter] = useState("ALL");
    const [listMode, setListMode] = useState(false);

    const jobOptions = useMemo(() => {
        const ids = character?.assignedClassIds || [];
        return ["ALL", ...ids];
    }, [character?.assignedClassIds]);

    useEffect(() => {
        if (character?.unlockedAbilities?.length) {
            setLoading(true);
            getAbilitiesByIds(character.unlockedAbilities).then((res) => {
                setAbilities(res);
                setLoading(false);
            });
        } else {
            setAbilities([]);
            setLoading(false);
        }
    }, [character]);

    useEffect(() => {
        setJobFilter("ALL");
    }, [character?.id]);

    const { groups, mods } = useMemo(() => {
        const filtered = abilities.filter((a) => abilityMatchesJob(a, jobFilter));
        if (!filtered.length) return { groups: [], mods: [] };

        const groupsMap = {};
        const modsList = filtered.filter((a) => a.type === "upgrade");
        const mainsList = filtered.filter((a) => a.type !== "upgrade");

        mainsList.forEach((ability) => {
            const type = ability.type || "uncategorized";
            if (!groupsMap[type]) {
                let defaultOrder = 10;
                let defaultColor = UI_COLORS.accent;
                let defaultGridSize = 4;
                let defaultTitle = `> ${type.toUpperCase()}_MATRIX`;
                if (type === "class_root") { defaultOrder = 0; defaultColor = "#ffff00"; defaultGridSize = 12; defaultTitle = "> CORE_CLASS_MATRIX"; }
                else if (type === "trait") { defaultOrder = 1; defaultColor = "#ff00ff"; defaultGridSize = 3; defaultTitle = "> PASSIVE_TRAIT_MODULES"; }
                else if (type === "ability") { defaultOrder = 2; defaultColor = UI_COLORS.accent; defaultGridSize = 4; defaultTitle = "> ACTIVE_SKILL_MATRIX"; }
                groupsMap[type] = {
                    id: type,
                    order: ability.displayOrder ?? defaultOrder,
                    title: ability.displayTitle || defaultTitle,
                    color: ability.displayColor ?? defaultColor,
                    gridSize: ability.gridSize ?? defaultGridSize,
                    items: [],
                };
            }
            groupsMap[type].items.push(ability);
        });

        const sortedGroups = Object.values(groupsMap)
            .sort((a, b) => a.order - b.order)
            .map((group) => ({
                ...group,
                isCollapsible: !(group.id === "class_root" && group.items.length === 1),
            }));

        return { groups: sortedGroups, mods: modsList };
    }, [abilities, jobFilter]);

    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 5 }}>
                <CircularProgress sx={{ color: UI_COLORS.accent }} />
            </Box>
        );
    }

    return (
        <Box>
            {playerMode && (
                <Box
                    sx={{
                        flexShrink: 0,
                        px: 2,
                        py: 1.25,
                        borderBottom: `1px solid ${UI_COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        flexWrap: "wrap",
                        bgcolor: "rgba(255,255,255,0.015)",
                    }}
                >
                    <CyberText sx={{ fontFamily: "monospace", fontSize: "0.58rem", color: UI_COLORS.textSecondary, letterSpacing: "0.08em", mr: 0.5 }}>
                        FILTRAR JOB
                    </CyberText>
                    {jobOptions.map((id) => (
                        <Box
                            key={id}
                            component="button"
                            type="button"
                            onClick={() => setJobFilter(id)}
                            sx={{
                                fontFamily: "monospace",
                                fontSize: "0.58rem",
                                px: 1.25,
                                py: 0.5,
                                borderRadius: 0.5,
                                border: `1px solid ${jobFilter === id ? "rgba(0,242,234,0.5)" : UI_COLORS.border}`,
                                bgcolor: jobFilter === id ? "rgba(0,242,234,0.08)" : "transparent",
                                color: jobFilter === id ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {id === "ALL" ? "TODO" : formatClassLabel(id)}
                        </Box>
                    ))}
                    <Box sx={{ flex: 1 }} />
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setListMode(false)}
                            title="Grid"
                            sx={{
                                width: 28,
                                height: 28,
                                border: `1px solid ${!listMode ? "rgba(0,242,234,0.5)" : UI_COLORS.border}`,
                                borderRadius: 0.5,
                                bgcolor: !listMode ? "rgba(0,242,234,0.08)" : "transparent",
                                color: !listMode ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            <ViewModuleIcon sx={{ fontSize: "1rem" }} />
                        </Box>
                        <Box
                            component="button"
                            type="button"
                            onClick={() => setListMode(true)}
                            title="Lista"
                            sx={{
                                width: 28,
                                height: 28,
                                border: `1px solid ${listMode ? "rgba(0,242,234,0.5)" : UI_COLORS.border}`,
                                borderRadius: 0.5,
                                bgcolor: listMode ? "rgba(0,242,234,0.08)" : "transparent",
                                color: listMode ? UI_COLORS.anomaly : UI_COLORS.textSecondary,
                                cursor: "pointer",
                                display: "grid",
                                placeItems: "center",
                            }}
                        >
                            <ViewListIcon sx={{ fontSize: "1rem" }} />
                        </Box>
                    </Box>
                </Box>
            )}
            <Box sx={{ p: playerMode ? 2.5 : 0, pr: playerMode ? 2.5 : 2, pb: 4 }}>
                {playerMode && listMode === false ? (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 1.75,
                        }}
                    >
                        {groups.flatMap((group) =>
                            group.items.map((item) => (
                                <SkillCard
                                    key={item.id}
                                    ability={item}
                                    upgrades={mods.filter((u) => u.parentId === item.key)}
                                    accentColor={group.color}
                                />
                            ))
                        )}
                    </Box>
                ) : (
                    groups.map((group) => (
                        <GenericSkillSection key={group.id} group={group} upgrades={mods} listMode={playerMode && listMode} />
                    ))
                )}
                {groups.length === 0 && (
                    <CyberText sx={{ color: UI_COLORS.textSecondary, fontSize: "0.85rem" }}>No skills for this filter.</CyberText>
                )}
            </Box>
        </Box>
    );
}
