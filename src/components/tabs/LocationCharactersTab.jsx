import {
    Box,
    Typography,
    Avatar,
    Paper,
    Divider,
    IconButton,
} from "@mui/material";
import {
    CyberText,
    CyberTitle,
} from "../customs/CustomTexts";
import { useState, useEffect, useRef, Fragment, memo } from "react";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from "@mui/icons-material/Person";
import gsap from "gsap";

import { UI_COLORS } from "../../constants/uiColors";
import { STAT_SYSTEM } from "../../constants/stat_system";

const CUSTOM_SCROLLBAR = {
    '&::-webkit-scrollbar': { width: '8px', height: '8px' },
    '&::-webkit-scrollbar-track': { background: '#0d0d14' },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: UI_COLORS.accent || "#00f2ea",
        borderRadius: '4px'
    },
    scrollbarWidth: "thin",
    scrollbarColor: `${UI_COLORS.accent || "#00f2ea"} #0d0d14`,
};

const StatDots = ({ label, value }) => {
    const dots = [0, 1, 2, 3]; 
    const isMax = value >= 5; 
    const isUnknown = value < 0; // Identificamos si el stat es una anomalía

    // Gestión de colores basada en el estado
    const getActiveColor = () => {
        if (isUnknown) return UI_COLORS.anomaly || "#ff00ff"; // Color de error/misterio
        if (isMax) return "#ff0055";
        return UI_COLORS.accent;
    };

    const activeColor = getActiveColor();
    const glowColor = isMax ? "rgba(255, 0, 85, 0.6)" : (isUnknown ? "rgba(255, 0, 255, 0.4)" : UI_COLORS.accentGlow);

    return (
        <Box sx={{ mb: 1.2, opacity: isUnknown ? 0.9 : 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3, alignItems: 'center' }}>
                <CyberTitle sx={{ 
                    fontSize: "0.6rem", 
                    color: isUnknown ? activeColor : (isMax ? "#ff0055" : "#aaa"), 
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    fontWeight: (isMax || isUnknown) ? "bold" : "normal",
                    // Efecto de parpadeo suave si es desconocido
                    animation: isUnknown ? "pulse 2s infinite" : "none",
                    "@keyframes pulse": {
                        "0%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                        "100%": { opacity: 1 },
                    }
                }}>
                    {label}
                </CyberTitle>
                <CyberTitle sx={{ 
                    fontSize: isUnknown ? "0.65rem" : "0.75rem", 
                    color: activeColor,
                    textShadow: (isMax || isUnknown) ? `0 0 8px ${activeColor}` : "none",
                    fontFamily: 'monospace'
                }}>
                    {isUnknown ? "???" : value}
                </CyberTitle>
            </Box>
            
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                {dots.map((dot) => (
                    <Box
                        key={dot}
                        sx={{
                            height: 5,
                            flex: 1,
                            // Si es unknown, los puntos se ven "vacíos" o con un color apagado de anomalía
                            bgcolor: !isUnknown && value > dot ? activeColor : "rgba(42, 42, 61, 0.2)",
                            border: `1px solid ${!isUnknown && value > dot ? activeColor : (isUnknown ? "rgba(255,0,255,0.2)" : "#2a2a3d")}`,
                            boxShadow: !isUnknown && value > dot ? `0 0 6px ${glowColor}` : "none",
                            borderRadius: "1px",
                            transition: "all 0.3s ease",
                            position: 'relative',
                            overflow: 'hidden',
                            // Rayas diagonales si es unknown para dar sensación de "corrupto"
                            "&::after": isUnknown ? {
                                content: '""',
                                position: 'absolute',
                                top: 0, left: 0, right: 0, bottom: 0,
                                background: `linear-gradient(45deg, transparent 45%, ${activeColor} 50%, transparent 55%)`,
                                backgroundSize: '8px 8px',
                                opacity: 0.3
                            } : {}
                        }}
                    />
                ))}
                
                {/* Diamante de Nivel 5 / Especial */}
                <Box
                    sx={{
                        height: 8,
                        width: 8,
                        rotate: "45deg",
                        bgcolor: isMax ? "#ff0055" : "rgba(42, 42, 61, 0.3)",
                        border: `1px solid ${isMax ? "#ff0055" : (isUnknown ? "rgba(255,0,255,0.1)" : "#2a2a3d")}`,
                        boxShadow: isMax ? "0 0 12px #ff0055" : "none",
                        ml: 0.5,
                        transition: "all 0.4s ease",
                        flexShrink: 0,
                        opacity: isUnknown ? 0.2 : 1
                    }}
                />
            </Box>
        </Box>
    );
};

const CharacterCard = memo(function CharacterCard({ char, isSelected, onClick }) {
    const [url, setUrl] = useState(() => getCachedUrl(char.imageUrl) || null);
    const [showHint, setShowHint] = useState(false); // Estado para el feedback de bloqueo
    const isLocked = char.isLocked;

    useEffect(() => {
        // Por si acaso no se precargó (puedes mantener esto como respaldo)
        if (!url && char.imageUrl) {
            loadFirebaseAsset(char.imageUrl).then(setUrl);
        }
    }, [char.imageUrl, url]);

    const handleCardClick = () => {
        if (isLocked) {
            setShowHint(!showHint);
            return;
        }
        onClick(char);
    };

    const cornerCircle = {
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: UI_COLORS.accent,
        boxShadow: `0 0 12px ${UI_COLORS.accentGlow}`,
    };

    return (
        <Box
            onClick={handleCardClick}
            sx={{
                width: "clamp(220px, 14vw, 340px)",
                height: "clamp(320px, 60vh, 520px)",
                flexShrink: 0,
                cursor: isLocked ? "help" : "pointer",
                transition: "transform 0.3s ease",
                "&:hover": { transform: isLocked ? "none" : "scale(1.02)" }
            }}
        >
            <Paper
                elevation={isSelected ? 20 : 6}
                sx={{
                    height: "100%",
                    backgroundColor: "#0f0f1a",
                    overflow: "hidden",
                    position: "relative",
                    border: isSelected ? `2px solid ${UI_COLORS.accent}` : "1px solid #2a2a3d",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* OVERLAY DE BLOQUEO (CANDADITO + BLUR) */}
                {isLocked && (
                    <Box sx={{
                        position: "absolute",
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 10,
                        backdropFilter: showHint ? "blur(24px)" : "blur(18px)",
                        backgroundColor: showHint ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.4s ease",
                        px: 3,
                        textAlign: "center"
                    }}>
                        <LockIcon sx={{ 
                            color: UI_COLORS.accent, 
                            fontSize: "3rem",
                            filter: `drop-shadow(0 0 10px ${UI_COLORS.accent})`,
                            mb: 2,
                            opacity: showHint ? 1 : 0.7
                        }} />
                        
                        {showHint && (
                            <CyberText sx={{ 
                                color: UI_COLORS.accent, 
                                fontSize: "0.8rem",
                                animation: "fadeIn 0.5s ease-out" 
                            }}>
                                REQUISITO: {char.unlockGoal || "Identidad encriptada"}
                            </CyberText>
                        )}
                    </Box>
                )}

                <Box sx={{ 
                    flex: 1, 
                    position: "relative", 
                    overflow: "hidden",
                    filter: isLocked ? "grayscale(100%) opacity(0.5)" : "none" 
                }}>
                    {url ? (
                        <img 
                            src={url} 
                            alt={char.name}
                            draggable={false}
                            style={{ 
                                width: "100%", 
                                height: "100%", 
                                objectFit: "cover",
                                userSelect: "none",
                            }}
                        />
                    ) : (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#1a1a2a" }}>
                            <PersonIcon sx={{ fontSize: 60, color: "#3a3a4d" }} />
                        </Box>
                    )}
                    
                    {/* Overlay Nombre */}
                    <Box sx={{
                        position: "absolute",
                        bottom: 0, left: 0, right: 0,
                        pt: 6, pb: 3,
                        background: "linear-gradient(to top, #0f0f1a 10%, transparent)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}>
                        <CyberTitle 
                            sx={{ 
                                color: isLocked ? "#666" : UI_COLORS.accent, 
                                fontSize: "1rem", 
                                textShadow: isLocked ? "none" : `0 0 10px ${UI_COLORS.accentGlow}`,
                                textAlign: "center",
                                width: "100%",
                            }}
                        >
                            {isLocked ? "????????????" : char.name}
                        </CyberTitle>
                        
                        <Box sx={{ display: "flex", alignItems: "center", width: "60%", mt: 1 }}>
                            <Box sx={cornerCircle} />
                            <Box sx={{ flex: 1, height: "1px", bgcolor: isLocked ? "rgba(255,255,255,0.1)" : UI_COLORS.accent, mx: 0.5 }} />
                            <Box sx={cornerCircle} />
                        </Box>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
});

export default function LocationCharactersTab({ characters = [] }) {
    const [selected, setSelected] = useState(null);
    const carouselRef = useRef(null);
    const isDraggingRef = useRef(false);

    const handleSelect = (char) => {
        if (isDraggingRef.current) return; // Evita seleccionar si se estaba arrastrando

        setSelected(prev => (prev?.id === char.id ? null : char));

        // Centrar la carta seleccionada en el carrusel
        const el = carouselRef.current;
        if (!el) return;
        const card = el.children[characters.findIndex(c => c.id === char.id) * 2]; // Cada carta ocupa 2 elementos (card + details)
        if (card) {
            const cardRect = card.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const offset = cardRect.left - elRect.left - (elRect.width / 2) + (cardRect.width / 2);
            gsap.to(el, {
                scrollLeft: el.scrollLeft + offset,
                duration: 0.6,
                ease: "power3.out",
            });
        }
    };

    /* =========================
       SCROLL WITH ARROWS
    ========================= */
    const scroll = (dir) => {
        const el = carouselRef.current;
        if (!el) return;

        const amount = el.clientWidth * 0.7;

        gsap.to(el, {
            scrollLeft: el.scrollLeft + dir * amount,
            duration: 0.6,
            ease: "power3.out",
        });
    };

    /* =========================
       DRAG SCROLL
    ========================= */
    useEffect(() => {
        const el = carouselRef.current;
        if (!el) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        const down = (e) => {
            isDown = true;
            isDraggingRef.current = false; // Reset al iniciar
            el.style.cursor = "grabbing";
            startX = e.pageX;
            scrollLeft = el.scrollLeft;
        };

        const up = () => {
            isDown = false;
            el.style.cursor = "grab";
            // Pequeño timeout para asegurar que el evento click ocurra 
            // después de que isDraggingRef sea procesado
            setTimeout(() => {
                if (!isDown) el.style.pointerEvents = "auto";
            }, 50);
        };

        const move = (e) => {
            if (!isDown) return;
            
            // Calculamos la distancia movida
            const x = e.pageX;
            const dist = Math.abs(x - startX);

            // Si se mueve más de 5px, confirmamos que es un DRAG
            if (dist > 5) {
                isDraggingRef.current = true;
            }

            e.preventDefault();
            const walk = (x - startX) * 1.5;
            el.scrollLeft = scrollLeft - walk;
        };

        const handleWheel = (e) => {
            // DETECTAR SI EL MOUSE ESTÁ SOBRE UN ÁREA CON SCROLL INTERNO
            // Buscamos si el target es o está dentro de algo con overflow-y: auto/scroll
            const isInsideScrollable = e.target.closest('.inner-scroll');
            
            if (isInsideScrollable) {
                // Si el elemento interno tiene scroll disponible, dejamos que ocurra el scroll vertical
                if (isInsideScrollable.scrollHeight > isInsideScrollable.clientHeight) {
                    return; // No ejecutamos el preventDefault ni el scrollLeft manual
                }
            }

            if (e.deltaY === 0) return;
            
            e.preventDefault(); // Bloqueamos el scroll de la página
            el.scrollLeft += e.deltaY * 1.5; // Movemos el carrusel horizontalmente
        };

        el.addEventListener("mousedown", down);
        window.addEventListener("mouseup", up);
        el.addEventListener("mousemove", move);
        el.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            el.removeEventListener("mousedown", down);
            window.removeEventListener("mouseup", up);
            el.removeEventListener("mousemove", move);
            el.removeEventListener("wheel", handleWheel, { passive: false });
        };
    }, []);

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                overflow: "hidden",
                position: "relative",
                alignItems: "center",
            }}
        >
            {/* =========================
               LEFT ARROW
            ========================= */}
            <IconButton
                onClick={() => scroll(-1)}
                sx={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 5,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    "&:hover": { backgroundColor: "rgba(0,0,0,0.8)" },
                }}
            >
                <ChevronLeftIcon sx={{ color: UI_COLORS.accent }} />
            </IconButton>

            {/* =========================
               RIGHT ARROW
            ========================= */}
            <IconButton
                onClick={() => scroll(1)}
                sx={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 5,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    "&:hover": { backgroundColor: "rgba(0,0,0,0.8)" },
                }}
            >
                <ChevronRightIcon sx={{ color: UI_COLORS.accent }} />
            </IconButton>

            {/* =========================
               CAROUSEL
            ========================= */}
            <Box
                ref={carouselRef}
                sx={{
                    transition: "all 0.4s ease",
                    display: "flex",
                    overflow: "hidden",
                    overflowX: "auto",
                    cursor: "grab",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    "&::-webkit-scrollbar": {
                        display: "none",
                    },
                    scrollbarWidth: "none",
                    alignItems: "center",
                    justifyContent: `characters.length < 4 ? "center" : "flex-start"`,
                    gap: 1,
                    px: "15px",
                }}
            >
                {characters.map((char, index) => {
                    const isSelected = selected?.id === char.id;
                    const cardHeight = "clamp(320px, 60vh, 520px)";

                    return (
                        <Fragment key={char.id}>
                            {/* CHARACTER CARD */}
                            <CharacterCard
                                char={char}
                                isSelected={isSelected}
                                onClick={handleSelect}
                            />

                            {/* INLINE DETAILS PANEL */}
                            <Box
                                className="inner-scroll"
                                sx={{
                                    width: isSelected ? "clamp(350px, 30vw, 600px)" : 0,
                                    height: cardHeight, 
                                    flexShrink: 0,
                                    background: "linear-gradient(135deg, #161625 0%, #0a0a12 100%)",
                                    border: isSelected ? "1px solid #5a3a5f" : "none",
                                    borderLeft: `3px solid ${UI_COLORS.accent}`,
                                    borderRadius: "0 12px 12px 0",
                                    overflowY: "auto",
                                    overflowX: "hidden",
                                    transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                                    opacity: isSelected ? 1 : 0,
                                    position: "relative",
                                    alignSelf: "center",
                                    ...CUSTOM_SCROLLBAR,
                                }}
                            >
                                {/* Contenedor INTERNO*/}
                                <Box sx={{
                                    height: "100%",
                                    width: "85%",
                                    p: 4,
                                    opacity: isSelected ? 1 : 0,
                                    transform: isSelected ? "translateX(0)" : "translateX(20px)",
                                    transition: "all 0.4s ease",
                                    transitionDelay: isSelected ? "0.2s" : "0s", // Aparece justo después de expandirse
                                    
                                }}>
                                    {isSelected && (
                                        <>
                                            <CyberTitle sx={{ 
                                                color: UI_COLORS.accent,
                                                fontSize: "1.2rem",
                                                fontWeight: "bold",
                                            }}>
                                                {selected.name}
                                            </CyberTitle>
                                            
                                            <CyberText sx={{ 
                                                color: UI_COLORS.textSecondary,
                                                mb: 3, 
                                                letterSpacing: 3,
                                                fontSize: "0.6rem" 
                                            }}>
                                                {selected.callname || "Placeholder of the Void"}
                                            </CyberText>

                                            <Box sx={{ 
                                                mb: 2, 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(2, 1fr)', // 2 columnas
                                                columnGap: 3, 
                                                rowGap: 1,
                                                maxHeight: '280px', // Un poco más de espacio para los 10 stats
                                                overflowY: 'auto',
                                                pr: 1,
                                            }}>
                                                {Object.entries(selected.stats || {}).map(([key, val]) => {
                                                    // Buscamos el label en español (esto luego vendrá de tu stat_system doc)
                                                    const statInfo = STAT_SYSTEM.find(s => s.key === key);
                                                    return (
                                                        <StatDots 
                                                            key={key} 
                                                            label={statInfo?.label || key} 
                                                            value={val} 
                                                        />
                                                    );
                                                })}
                                            </Box>

                                            <Divider sx={{ bgcolor: "rgba(255,102,255,0.1)", mb: 2 }} />

                                            <CyberText sx={{ 
                                                fontSize: "0.8rem", 
                                                lineHeight: 1.6,
                                                color: "#ccc",
                                            }}>
                                                {selected.bio}
                                            </CyberText>
                                        </>
                                    )}
                                </Box>
                            </Box>
                        </Fragment>
                    );
                })}
            </Box>
        </Box>
    );
}
