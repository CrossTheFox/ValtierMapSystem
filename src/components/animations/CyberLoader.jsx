import { Box, styled } from "@mui/material";
import { UI_COLORS } from "../../constants/uiColors";
import { Square } from "../../assets/DecorativeSquare";

const LoaderContainer = styled(Box)({
    width: "100px", // Aumentado para contener las nuevas piezas
    height: "100px",
    position: "relative",
});

export default function CyberLoader() {
    return (
        <Box sx={{ 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center", 
            justifyContent: "center", 
            height: "100vh", 
            width: "100vw",
            bgcolor: UI_COLORS.backgroundPrimary,
            gap: 4
        }}>
            <LoaderContainer>
                {/* --- ESTRUCTURA ORIGINAL (3x3) --- */}
                {/* Fila 1 */}
                <Square mt="-25px" ml="-25px" delay={0} />
                <Square mt="-25px" ml="-5px" delay={75} />
                <Square mt="-25px" ml="15px" delay={150} />
                {/* Fila 2 */}
                <Square mt="-5px" ml="-25px" delay={225} />
                <Square mt="-5px" ml="-5px" delay={300} />
                <Square mt="-5px" ml="15px" delay={375} />
                {/* Fila 3 */}
                <Square mt="15px" ml="-25px" delay={450} />
                <Square mt="15px" ml="-5px" delay={525} />
                <Square mt="15px" ml="15px" delay={600} />

                {/* --- NUEVAS PIEZAS --- */}
                
                {/* 1. Cuadrado abajo de la 2da col, 3ra fila */}
                <Square mt="35px" ml="-5px" delay={675} />

                {/* 2. Lados de la 1ra fila */}
                <Square mt="-25px" ml="-45px" delay={750} /> {/* Izquierda */}
                <Square mt="-25px" ml="35px" delay={825} />  {/* Derecha */}

                {/* 3. Arriba de los nuevos (Fila superior a la 1) */}
                <Square mt="-45px" ml="-45px" delay={900} />
                <Square mt="-45px" ml="35px" delay={975} />

                {/* 4. El punto más alto (arriba de los últimos 2) */}
                <Square mt="-65px" ml="-45px" delay={1050} />
                <Square mt="-65px" ml="35px" delay={1125} />
            </LoaderContainer>

            <Box sx={{ 
                color: UI_COLORS.accent, 
                fontFamily: "monospace", 
                letterSpacing: 4,
                fontSize: "0.8rem",
                textShadow: `0 0 5px ${UI_COLORS.accentGlow}`,
                mt: 4 // Ajuste por la expansión del container
            }}>
                INITIALIZING_SYSTEM...
            </Box>
        </Box>
    );
}