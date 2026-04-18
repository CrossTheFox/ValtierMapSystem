import React, { useState, useEffect, useMemo } from "react";
import { Box, Stack, CircularProgress, Divider, Tooltip, Paper, Grid } from "@mui/material";
import { getAbilitiesByIds } from "../../../../firebase/services/characterService";
import { CyberTitle, CyberText } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";

const NODE_SIZE = 60;

// --- COMPONENTES DE APOYO ---

const SectionHeader = ({ title, color = UI_COLORS.accent, textColor = "#fff" }) => (
    <Box sx={{ width: '100%', mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ 
            px: 2, py: 0.5, bgcolor: color, 
            clipPath: 'polygon(0 0, 90% 0, 100% 100%, 10% 100%)',
            minWidth: 120 
        }}>
            <CyberTitle sx={{ color: textColor, fontSize: '0.8rem', fontWeight: 'bold' }}>{title}</CyberTitle>
        </Box>
        <Box sx={{ flexGrow: 1, height: '1px', bgcolor: `${color}44` }} />
    </Box>
);

const TraitCard = ({ trait, isUnlocked }) => (
    <Paper elevation={0} sx={{
        p: 1.5, width: '100%',
        background: isUnlocked ? 'rgba(255, 0, 255, 0.05)' : 'rgba(42, 42, 61, 0.2)',
        border: `1px solid ${isUnlocked ? '#ff00ff88' : '#2a2a3d'}`,
        borderLeft: `4px solid ${isUnlocked ? '#ff00ff' : '#2a2a3d'}`,
        opacity: isUnlocked ? 1 : 0.6,
        position: 'relative',
        transition: 'all 0.3s ease',
        '&::before': {
            content: '""', position: 'absolute', top: 0, right: 0,
            width: 10, height: 10, bgcolor: isUnlocked ? '#ff00ff' : '#2a2a3d',
            clipPath: 'polygon(100% 0, 0 0, 100% 100%)'
        }
    }}>
        <CyberTitle sx={{ fontSize: '0.75rem', color: isUnlocked ? '#ff00ff' : '#666', mb: 0.5 }}>
            {trait.label?.toUpperCase()}
        </CyberTitle>
        <CyberTitle sx={{ fontSize: '0.7rem', lineHeight: 1.2, color: isUnlocked ? '#ffffff' : '#666', fontWeight: 'normal' }}>
            {trait.content}
        </CyberTitle>
    </Paper>
);

const CyberTooltipContent = ({ ability, accentColor }) => (
    <Paper elevation={0} sx={{
        p: 1.5, minWidth: 200, maxWidth: 280,
        background: 'rgba(10, 10, 15, 0.95)',
        borderLeft: `4px solid ${accentColor}`,
        border: `1px solid ${accentColor}44`,
        color: "#fff",
        clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
    }}>
        <Stack spacing={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <CyberTitle sx={{ color: accentColor, fontSize: '0.85rem' }}>{ability.label}</CyberTitle>
                {ability.cost && <CyberText sx={{ fontSize: '0.65rem', color: accentColor }}>[{ability.cost.toUpperCase()}]</CyberText>}
            </Box>
            <CyberText sx={{ fontSize: '0.75rem', opacity: 0.9 }}>{ability.content}</CyberText>
        </Stack>
    </Paper>
);

const TreeNode = ({ ability, isUnlocked, isUpgrade = false, isLimit = false, isMastery = false }) => {
    let mainColor = isUnlocked ? UI_COLORS.accent : "#2a2a3d";
    if (isLimit) mainColor = isUnlocked ? "#ff0055" : "#2a2a3d";
    if (isMastery) mainColor = isUnlocked ? "#ffaa00" : "#2a2a3d";

    const shapeStyles = {
        width: isUpgrade || isMastery ? NODE_SIZE * 0.7 : (isLimit ? NODE_SIZE * 1.1 : NODE_SIZE),
        height: isUpgrade || isMastery ? NODE_SIZE * 0.7 : (isLimit ? NODE_SIZE * 1.1 : NODE_SIZE),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: isMastery ? `2px double ${mainColor}` : `2px solid ${mainColor}`,
        background: isUnlocked ? `${mainColor}22` : "rgba(0,0,0,0.4)",
        boxShadow: isUnlocked ? `0 0 15px ${mainColor}44` : "none",
        borderRadius: isUpgrade ? '50%' : (isMastery ? '0px' : '4px'),
        transform: !isUpgrade && !isLimit && !isMastery ? 'rotate(45deg)' : 'none',
        transition: '0.3s', cursor: 'help',
        '&:hover': { transform: !isUpgrade && !isLimit && !isMastery ? 'rotate(45deg) scale(1.1)' : 'scale(1.1)' }
    };

    return (
        <Tooltip title={<CyberTooltipContent ability={ability} accentColor={mainColor} />} arrow followCursor 
                 slotProps={{ tooltip: { sx: { bgcolor: 'transparent', padding: 0 } } }}>
            <Stack alignItems="center" spacing={1} sx={{ opacity: isUnlocked ? 1 : 0.5 }}>
                <Box sx={shapeStyles}>
                    <Box sx={{ transform: !isUpgrade && !isLimit && !isMastery ? 'rotate(-45deg)' : 'none' }}>
                        <CyberTitle sx={{ fontSize: isUpgrade ? '0.5rem' : '0.6rem' }}>
                            {ability.label?.substring(0, 3).toUpperCase()}
                        </CyberTitle>
                    </Box>
                </Box>
                {!isUpgrade && !isMastery && (
                    <CyberTitle sx={{ fontSize: '0.6rem', textAlign: 'center', width: 70 }}>{ability.label}</CyberTitle>
                )}
            </Stack>
        </Tooltip>
    );
};

export default function CharTreeTab({ character }) {
    const [allAbilities, setAllAbilities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (character?.allAbilities) {
            getAbilitiesByIds(character.allAbilities).then(res => {
                setAllAbilities(res);
                setLoading(false);
            });
        }
    }, [character]);

    // Lógica de ordenamiento y filtrado
    const treeData = useMemo(() => {
        if (!allAbilities.length) return null;

        const check = (key) => character.unlockedAbilities?.includes(key);
        
        // Función para ordenar: unlocked (true) va primero
        const sortByUnlock = (a, b) => (check(b.key) === check(a.key)) ? 0 : check(b.key) ? 1 : -1;

        return {
            traits: allAbilities.filter(a => a.type === 'trait').sort(sortByUnlock),
            abilities: allAbilities.filter(a => a.type === 'ability').sort(sortByUnlock),
            upgrades: allAbilities.filter(a => a.type === 'upgrade'),
            masteries: allAbilities.filter(a => a.type === 'mastery'),
            limitBreak: allAbilities.find(a => a.type === 'ultimate')
        };
    }, [allAbilities, character.unlockedAbilities]);

    const checkUnlocked = (key) => character.unlockedAbilities?.includes(key);

    if (loading) return <CircularProgress sx={{ display: 'block', m: 'auto', color: UI_COLORS.accent }} />;

    return (
        <Box sx={{ maxWidth: "100%" }}>
            
            {/* SECCIÓN SUPERIOR: TRAITS Y LIMIT BREAK LADO A LADO */}
            <Grid container spacing={6} sx={{ mb: 4 }}>
                {/* COLUMNA TRAITS */}
                <Grid size={6}>
                    <SectionHeader title="PASSIVE TRAITS" color="#ff00ff" textColor="#fff" />
                    <Stack spacing={2}>
                        {treeData.traits.map(trait => (
                            <TraitCard key={trait.id} trait={trait} isUnlocked={checkUnlocked(trait.key)} />
                        ))}
                    </Stack>
                </Grid>

                {/* COLUMNA LIMIT BREAK */}
                <Grid size={6}>
                    <SectionHeader title="LIMIT BREAK" color="#ff0055" textColor="#fff" />
                    {treeData.limitBreak && (
                        <Stack direction="row" spacing={3} alignItems="center" sx={{ 
                            bgcolor: 'rgba(255,0,85,0.03)', p: 3, borderRadius: 2, border: '1px solid rgba(255,0,85,0.1)' 
                        }}>
                            <TreeNode ability={treeData.limitBreak} isUnlocked={checkUnlocked(treeData.limitBreak.key)} isLimit />
                            
                            <Box sx={{ width: 30, height: '2px', bgcolor: '#ff005544' }} />
                            
                            <Stack direction="row" spacing={1.5}>
                                {treeData.upgrades.filter(u => u.parentId === treeData.limitBreak.key).map(upg => (
                                    <TreeNode key={upg.id} ability={upg} isUnlocked={checkUnlocked(upg.key)} isUpgrade />
                                ))}
                            </Stack>

                            <Divider orientation="vertical" flexItem sx={{ borderColor: '#ff005522', mx: 1 }} />

                            <Stack direction="row" spacing={1.5}>
                                {treeData.masteries.filter(m => m.parentId === treeData.limitBreak.key).map(m => (
                                    <TreeNode key={m.id} ability={m} isUnlocked={checkUnlocked(m.key)} isMastery />
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </Grid>
            </Grid>

            {/* SECCIÓN INFERIOR: ABILITIES */}
            <SectionHeader title="ACTIVE ABILITIES" color={UI_COLORS.accent} textColor="#fff" />
            <Stack direction="row" spacing={6} alignItems="flex-start" justifyContent="center" sx={{ flexWrap: 'wrap', gap: 6, mt: 4 }}>
                {treeData.abilities.map(ability => (
                    <Stack key={ability.id} spacing={3} alignItems="center">
                        <TreeNode ability={ability} isUnlocked={checkUnlocked(ability.key)} />
                        
                        <Box sx={{ width: '2px', height: 30, background: `linear-gradient(to bottom, ${UI_COLORS.accent}, transparent)` }} />

                        <Stack direction="row" spacing={2}>
                            {treeData.upgrades.filter(u => u.parentId === ability.key).map(upg => (
                                <TreeNode key={upg.id} ability={upg} isUnlocked={checkUnlocked(upg.key)} isUpgrade />
                            ))}
                        </Stack>

                        {treeData.masteries.some(m => m.parentId === ability.key) && (
                            <>
                                <Box sx={{ width: '2px', height: 20, bgcolor: 'rgba(255,255,255,0.1)' }} />
                                <Stack direction="row" spacing={2}>
                                    {treeData.masteries.filter(m => m.parentId === ability.key).map(m => (
                                        <TreeNode key={m.id} ability={m} isUnlocked={checkUnlocked(m.key)} isMastery />
                                    ))}
                                </Stack>
                            </>
                        )}
                    </Stack>
                ))}
            </Stack>
        </Box>
    );
}