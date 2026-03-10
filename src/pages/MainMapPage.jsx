import { useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import { Box } from "@mui/material";
import gsap from "gsap";
import PixiRoot from "../layers/PixiRoot";
import UIOverlay from "../layers/UIOverlay";
import CyberLoader from "../components/animations/CyberLoader";
import { UI_COLORS } from "../constants/uiColors";

export default function MainMapPage() {
    const mainContainerRef = useRef(null);
    const { worldStatus, assetsStatus } = useSelector((state) => state.world);

    const isReady = worldStatus === "succeeded" && assetsStatus === "succeeded";

    useEffect(() => {
        if (isReady && mainContainerRef.current) {
            const tl = gsap.timeline();

            // Animación de materialización (Tu lógica original de GSAP)
            tl.fromTo(mainContainerRef.current, 
                { 
                    filter: "brightness(0) contrast(3) blur(20px) hue-rotate(90deg)",
                    scale: 1.1,
                    WebkitMaskImage: "radial-gradient(circle, black 0%, transparent 5%)",
                    maskImage: "radial-gradient(circle, black 0%, transparent 5%)",
                }, 
                { 
                    filter: "brightness(1) contrast(1) blur(0px) hue-rotate(0deg)",
                    scale: 1,
                    duration: 2, 
                    ease: "power3.inOut" 
                }
            );

            tl.fromTo(mainContainerRef.current,
                {
                    WebkitMaskImage: "radial-gradient(circle, black 10%, transparent 15%, black 20%, transparent 25%, black 30%, transparent 35%)",
                    WebkitMaskSize: "400% 400%",
                },
                {
                    WebkitMaskImage: "radial-gradient(circle, black 100%, black 100%)",
                    WebkitMaskSize: "100% 100%",
                    duration: 2.2,
                    ease: "rough({ template: power2.inOut, strength: 2, points: 20, taper: 'none', randomize: true, clamp: true })",
                    delay: -2
                }
            );
        }
    }, [isReady]);

    return (
        <Box sx={{ 
            position: "relative", 
            width: "100vw", 
            height: "100vh", 
            bgcolor: UI_COLORS.backgroundPrimary || "#0e0e14", 
            overflow: "hidden" 
        }}>
            {!isReady && <CyberLoader />}

            <Box 
                ref={mainContainerRef} 
                sx={{ 
                    width: "100%", 
                    height: "100%",
                    visibility: isReady ? "visible" : "hidden",
                    position: "relative",
                    zIndex: 1,
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                }}
            >
                <PixiRoot />
                <UIOverlay />
            </Box>
        </Box>
    );
}