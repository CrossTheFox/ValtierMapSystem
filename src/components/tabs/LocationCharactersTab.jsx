import {
    Box,
    Typography,
    Avatar,
    Paper,
    Divider,
    IconButton,
} from "@mui/material";
import { useState, useEffect, useRef } from "react";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import PersonIcon from "@mui/icons-material/Person";
import gsap from "gsap";

export default function LocationCharactersTab({ characters = [] }) {
    const [selected, setSelected] = useState(null);
    const carouselRef = useRef(null);

    const handleSelect = (char) => {
        if (selected?.id === char.id) {
            setSelected(null);
        } else {
            setSelected(char);
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
            el.style.cursor = "grabbing";
            startX = e.pageX;
            scrollLeft = el.scrollLeft;
        };

        const up = () => {
            isDown = false;
            el.style.cursor = "grab";
        };

        const move = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const walk = (e.pageX - startX) * 1.5;
            el.scrollLeft = scrollLeft - walk;
        };

        el.addEventListener("mousedown", down);
        window.addEventListener("mouseup", up);
        el.addEventListener("mousemove", move);

        return () => {
            el.removeEventListener("mousedown", down);
            window.removeEventListener("mouseup", up);
            el.removeEventListener("mousemove", move);
        };
    }, []);

    return (
        <Box
            sx={{
                display: "flex",
                height: "100%",
                overflow: "hidden",
                position: "relative",
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
                <ChevronLeftIcon sx={{ color: "#ff66ff" }} />
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
                <ChevronRightIcon sx={{ color: "#ff66ff" }} />
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
                    cursor: "grab",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    "&::-webkit-scrollbar": {
                        display: "none",
                    },
                    scrollbarWidth: "none",
                    alignItems: "center",
                    justifyContent: characters.length < 4 ? "center" : "flex-start",
                    height: "100%",
                }}
            >
                {characters.map((char, index) => {
                    const isSelected = selected?.id === char.id;

                    return (
                        <>
                            {/* CHARACTER CARD */}
                            <Box
                                key={char.id || index}
                                onClick={() => handleSelect(char)}
                                sx={{
                                    width: "clamp(220px, 14vw, 340px)",
                                    height: "clamp(320px, 60vh, 520px)",
                                    flexShrink: 0,
                                    cursor: "pointer",
                                    userSelect: "none",
                                    mr: isSelected ? 1 : 3,
                                }}
                            >
                                <Paper
                                    elevation={isSelected ? 16 : 6}
                                    sx={{
                                        height: "100%",
                                        backgroundColor: "#1a1a2a",
                                        overflow: "hidden",
                                        display: "flex",
                                        flexDirection: "column",
                                        border: isSelected
                                            ? "2px solid #ff66ff"
                                            : "1px solid #2a2a3d",
                                        transition: "all 0.3s ease",
                                        "&:hover": {
                                            transform: "scale(1.03)",
                                            boxShadow:
                                                "0 0 25px rgba(255,0,255,0.4)",
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            flex: "0 0 75%",
                                            overflow: "hidden",
                                            position: "relative",
                                        }}
                                    >
                                        {char.image ? (
                                            <img
                                                src={char.image || "/images/placeholder.png"}
                                                alt={char.name}
                                                draggable={false}
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    objectFit: "cover",
                                                    pointerEvents: "none",
                                                    userSelect: "none",
                                                }}
                                            />
                                        ) : (
                                            <Avatar
                                                sx={{
                                                    width: "100%",
                                                    height: "100%",
                                                    backgroundColor: "#2a2a3d",
                                                }}
                                            >
                                                <PersonIcon />
                                            </Avatar>
                                        )}
                                    </Box>

                                    <Box
                                        sx={{
                                            flex: 1,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            px: 2,
                                        }}
                                    >
                                        <Typography
                                            variant="h6"
                                            align="center"
                                            sx={{
                                                color: "#ff66ff",
                                                fontWeight: 500,
                                            }}
                                        >
                                            {char.name}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Box>

                            {/* 🔥 INLINE DETAILS PANEL */}
                            <Box
                                sx={{
                                    width: isSelected ? "clamp(320px, 25vw, 500px)" : 0,
                                    minHeight: "clamp(320px, 50vh, 520px)",
                                    flexShrink: 0,
                                    background: "radial-gradient(circle at top, #2a1524 0%, #141016 100%)",
                                    border: isSelected ? "1px solid #5a3a5f" : "none",
                                    borderRadius: 2,
                                    px: isSelected ? 3 : 0,
                                    py: isSelected ? 3 : 0,
                                    overflow: "hidden",
                                    position: "relative",
                                    transition: "all 0.45s cubic-bezier(0.4,0,0.2,1)",
                                    opacity: isSelected ? 1 : 0,
                                }}
                            >
                                {isSelected && (
                                    <>
                                        <Typography
                                            variant="h5"
                                            sx={{ color: "#ff66ff", mb: 2 }}
                                        >
                                            {selected.name}
                                        </Typography>

                                        <Divider
                                            sx={{
                                                mb: 2,
                                                backgroundColor: "#2a2a3d",
                                            }}
                                        />

                                        <Typography sx={{ mb: 2 }}>
                                            Age: {selected.age || "Unknown"}
                                        </Typography>

                                        <Typography
                                            sx={{
                                                whiteSpace: "pre-wrap",
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            {selected.bio || "No biography available."}
                                        </Typography>
                                    </>
                                )}
                            </Box>
                        </>
                    );
                })}
            </Box>
        </Box>
    );
}
