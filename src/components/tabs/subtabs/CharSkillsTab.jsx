import React, { useState, useEffect, useMemo } from "react";
import { Box, Stack, CircularProgress, Paper, Grid, Collapse } from "@mui/material";
import { getAbilitiesByIds } from "../../../../firebase/services/characterService";
import { CyberTitle, CyberText } from "../../customs/CustomTexts";
import { UI_COLORS } from "../../../constants/uiColors";

// --- SKILL CARD (Sin cambios mayores, mantenemos la estructura) ---
const SkillCard = ({ ability, upgrades = [], accentColor = UI_COLORS.accent }) => {
    return (
        <Paper elevation={0} sx={{
            p: 2,
            height: '100%',
            background: 'rgba(255, 255, 255, 0.03)',
            borderLeft: `4px solid ${accentColor}`,
            color: "#fff",
            clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Stack spacing={1.5} sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <CyberTitle sx={{ color: accentColor, fontSize: '0.95rem', lineHeight: 1.2, textTransform: 'uppercase' }}>
                        {ability.label}
                    </CyberTitle>
                    {ability.cost && (
                        <CyberText sx={{ fontSize: '0.7rem', color: accentColor, fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            [ {ability.cost.toUpperCase()} ]
                        </CyberText>
                    )}
                </Box>

                {ability.tags && ability.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {ability.tags.map((tag, index) => (
                            <Box 
                                key={index}
                                sx={{ 
                                    px: 0.8, py: 0.2, 
                                    fontSize: '0.65rem', 
                                    border: `1px solid ${accentColor}44`,
                                    bgcolor: `${accentColor}11`,
                                    color: "#fff",
                                    borderRadius: '2px',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {tag}
                            </Box>
                        ))}
                    </Box>
                )}
                
                {ability.content && (
                    <CyberText sx={{ fontSize: '0.85rem', lineHeight: 1.4, color: "#fff", opacity: 0.9 }}>
                        {ability.content}
                    </CyberText>
                )}

                {upgrades.length > 0 && (
                    <Stack spacing={1} sx={{ mt: 'auto', pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {upgrades.map(upg => (
                            <Box key={upg.id} sx={{ pl: 1, borderLeft: '2px solid #f59e0b' }}>
                                <CyberText sx={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    MOD: {upg.label?.toUpperCase()}
                                </CyberText>
                                {upg.content && (
                                    <CyberText sx={{ fontSize: '0.8rem', opacity: 0.8, color: "#fff" }}>
                                        {upg.content}
                                    </CyberText>
                                )}
                            </Box>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};

// --- COMPONENTE DE SECCIÓN GENÉRICA (Ahora maneja estado isCollapsible) ---
const GenericSkillSection = ({ group, upgrades }) => {
    const [isOpen, setIsOpen] = useState(true);

    const sectionHeaderStyle = {
        display: 'flex',
        alignItems: 'center',
        cursor: group.isCollapsible ? 'pointer' : 'default',
        mb: 2,
        userSelect: 'none',
        transition: 'opacity 0.2s',
        '&:hover': { opacity: group.isCollapsible ? 1 : 0.8 },
        '& span': { 
            color: group.color, 
            opacity: 0.7, 
            letterSpacing: 2,
            mr: 1,
            transition: 'transform 0.3s ease',
        }
    };

    const RenderCards = () => (
        <Grid container spacing={3}>
            {group.items.map(item => (
                <Grid size={group.gridSize || 4} key={item.id}>
                    <SkillCard 
                        ability={item} 
                        upgrades={upgrades.filter(u => u.parentId === item.key)} 
                        accentColor={group.color}
                    />
                </Grid>
            ))}
        </Grid>
    );

    return (
        <Box sx={{ mb: 6 }}>
            {/* Si es colapsable, mostramos el header con interacción y el ícono ">" rotatorio */}
            {group.isCollapsible ? (
                <Box onClick={() => setIsOpen(!isOpen)} sx={sectionHeaderStyle}>
                    <CyberText sx={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        {`>`}
                    </CyberText>
                    <CyberText sx={{ color: group.color }}>
                        {group.title}
                    </CyberText>
                </Box>
            ) : (
                /* Si NO es colapsable (ej. Main Class Root), mostramos un título estático (opcional) */
                <Box sx={{ mb: 2 }}>
                    <CyberText sx={{ color: group.color, opacity: 0.7, letterSpacing: 2 }}>
                        {group.title}
                    </CyberText>
                </Box>
            )}

            {/* Renderizado condicional del Collapse */}
            {group.isCollapsible ? (
                <Collapse in={isOpen} timeout="auto">
                    <RenderCards />
                </Collapse>
            ) : (
                <RenderCards />
            )}
        </Box>
    );
};

// --- TAB PRINCIPAL ---
export default function CharSkillsTab({ character }) {
    const [abilities, setAbilities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log("Character in CharSkillsTab:", character);
        if (character?.unlockedAbilities) {
            getAbilitiesByIds(character.unlockedAbilities).then(res => {
                setAbilities(res);
                setLoading(false);
            });
        } else {
            setAbilities([]);
            setLoading(false);
        }
    }, [character]);

    const { groups, mods } = useMemo(() => {
        if (!abilities.length) return { groups: [], mods: [] };

        const groupsMap = {};
        
        // CORRECCIÓN CRÍTICA: Solo anidamos como MODS los que tienen explícitamente el type "upgrade".
        // Así las "abilities" y "traits" que pertenecen a la clase base no se comprimen dentro de ella.
        const modsList = abilities.filter(a => a.type === 'upgrade');
        const mainsList = abilities.filter(a => a.type !== 'upgrade');

        mainsList.forEach(ability => {
            const type = ability.type || 'uncategorized';
            
            if (!groupsMap[type]) {
                // Configuración por defecto basada en tipos conocidos
                let defaultOrder = 10;
                let defaultColor = UI_COLORS.accent;
                let defaultGridSize = 4; // 3 columnas
                let defaultTitle = `> ${type.toUpperCase()}_MATRIX`;

                if (type === 'class_root') { defaultOrder = 0; defaultColor = '#ffff00'; defaultGridSize = 12; defaultTitle = '> CORE_CLASS_MATRIX'; }
                else if (type === 'trait') { defaultOrder = 1; defaultColor = '#ff00ff'; defaultGridSize = 3; defaultTitle = '> PASSIVE_TRAIT_MODULES'; } // 4 columnas para traits
                else if (type === 'ability') { defaultOrder = 2; defaultColor = UI_COLORS.accent; defaultGridSize = 4; defaultTitle = '> ACTIVE_SKILL_MATRIX'; }

                groupsMap[type] = {
                    id: type,
                    order: ability.displayOrder ?? defaultOrder, 
                    title: ability.displayTitle || defaultTitle,
                    color: ability.displayColor ?? defaultColor,
                    gridSize: ability.gridSize ?? defaultGridSize,
                    items: []
                };
            }
            groupsMap[type].items.push(ability);
        });

        // Convertir a Array, ordenar y determinar si deben ser colapsables
        const sortedGroups = Object.values(groupsMap)
            .sort((a, b) => a.order - b.order)
            .map(group => {
                // LÓGICA DE COLAPSABLE: Es colapsable siempre y cuando NO sea el único "class_root"
                const isSingleRoot = group.id === 'class_root' && group.items.length === 1;
                return {
                    ...group,
                    isCollapsible: !isSingleRoot 
                };
            });

        return { groups: sortedGroups, mods: modsList };
    }, [abilities]);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress sx={{ color: UI_COLORS.accent }} />
        </Box>
    );

    return (
        <Box sx={{ pr: 2, pb: 4 }}>
            {groups.map(group => (
                <GenericSkillSection 
                    key={group.id} 
                    group={group} 
                    upgrades={mods} 
                />
            ))}
        </Box>
    );
}