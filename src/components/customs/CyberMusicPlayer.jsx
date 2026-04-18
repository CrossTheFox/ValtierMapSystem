import React, { useState, useRef, useEffect } from "react";
import { Box, IconButton, Slider, Typography, Stack, Paper } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { UI_COLORS } from "../../constants/uiColors";
import { loadFirebaseAsset, getCachedUrl } from "../../../firebase/services/assetLoader";

// --- SUB-COMPONENTE DE LA ONDA ---
const SoundWave = ({ isPlaying, audioRef }) => {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const sourceRef = useRef(null);

    useEffect(() => {
        if (!audioRef.current) return;

        // Inicializar Web Audio API solo una vez
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Cantidad de barras (menor = más gruesas)
        
        // Conectar el audio al analizador
        if (!sourceRef.current) {
            sourceRef.current = audioContext.createMediaElementSource(audioRef.current);
            sourceRef.current.connect(analyser);
            analyser.connect(audioContext.destination);
        }

        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        analyserRef.current = analyser;

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;

            analyserRef.current.getByteFrequencyData(dataArrayRef.current);
            ctx.clearRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArrayRef.current[i] / 255) * height;
                
                // Color con el accent de Valtier
                ctx.fillStyle = UI_COLORS.accent;
                // Dibujar barra centrada verticalmente
                ctx.fillRect(x, (height - barHeight) / 2, barWidth - 2, barHeight);
                x += barWidth;
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        if (isPlaying) {
            if (audioContext.state === 'suspended') audioContext.resume();
            draw();
        } else {
            cancelAnimationFrame(animationRef.current);
        }

        return () => cancelAnimationFrame(animationRef.current);
    }, [isPlaying, audioRef]);

    return (
        <canvas 
            ref={canvasRef} 
            width={120} 
            height={40} 
            style={{ opacity: isPlaying ? 1 : 0.3, transition: '0.5s' }} 
        />
    );
};

// --- COMPONENTE PRINCIPAL ---
export default function CyberMusicPlayer({ audioPath, title = "UNKNOWN_TRACK" }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState(() => getCachedUrl(audioPath) || null);
    const audioRef = useRef(null);

    useEffect(() => {
        if (!audioUrl && audioPath) {
            loadFirebaseAsset(audioPath).then(setAudioUrl);
        }
    }, [audioPath, audioUrl]);

    const togglePlay = () => {
        if (isPlaying) audioRef.current.pause();
        else audioRef.current.play();
        setIsPlaying(!isPlaying);
    };

    const formatTime = (t) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s < 10 ? "0" : ""}${s}`;
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                background: "linear-gradient(135deg, #0a0a14 0%, #121221 100%)",
                border: `1px solid ${UI_COLORS.accent}44`,
                borderRadius: "16px",
                boxShadow: `0 0 15px ${UI_COLORS.accentGlow}22`,
                width: "380px",
                pointerEvents: "auto",
            }}
        >
            <audio
                ref={audioRef}
                src={audioUrl}
                crossOrigin="anonymous" // 🔥 CRÍTICO PARA EL ANALIZADOR
                onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
                onLoadedMetadata={() => setDuration(audioRef.current.duration)}
                onEnded={() => setIsPlaying(false)}
            />

            <Stack direction="column" spacing={1}>
                {/* Cabecera con Nombre y Onda */}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="caption" sx={{ color: UI_COLORS.accent, fontFamily: "Orbitron", display: "flex", alignItems: "center", gap: 1 }}>
                            <MusicNoteIcon sx={{ fontSize: 14 }} /> {title.toUpperCase()}
                        </Typography>
                    </Box>
                    <SoundWave isPlaying={isPlaying} audioRef={audioRef} />
                </Stack>

                {/* Controles principales */}
                <Stack direction="row" spacing={2} alignItems="center">
                    <IconButton onClick={togglePlay} sx={{ color: UI_COLORS.accent, border: `1px solid ${UI_COLORS.accent}33` }}>
                        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                    </IconButton>

                    <Box sx={{ flexGrow: 1 }}>
                        <Slider
                            size="small"
                            value={currentTime}
                            max={duration || 100}
                            onChange={(e, v) => { audioRef.current.currentTime = v; setCurrentTime(v); }}
                            sx={{ color: UI_COLORS.accent }}
                        />
                        <Stack direction="row" justifyContent="space-between">
                            <Typography sx={{ fontSize: "0.6rem", color: "gray" }}>{formatTime(currentTime)}</Typography>
                            <Typography sx={{ fontSize: "0.6rem", color: "gray" }}>{formatTime(duration)}</Typography>
                        </Stack>
                    </Box>
                </Stack>
            </Stack>
        </Paper>
    );
}