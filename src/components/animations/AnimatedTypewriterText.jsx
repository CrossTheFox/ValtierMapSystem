import { useEffect, useState } from "react";
import { Box, Fade } from "@mui/material";
import { CyberText } from "../customs/CustomTexts";

/** Flatten ReactMarkdown children / arrays into plain text for the typewriter. */
function toPlainText(value) {
    if (value == null || value === false) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(toPlainText).join("");
    if (typeof value === "object" && value.props?.children != null) {
        return toPlainText(value.props.children);
    }
    return "";
}

export default function AnimatedTypewriterText({
    text = "",
    duration = 1500,
}) {
    const safeText = toPlainText(text);
    const [displayedText, setDisplayedText] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!safeText) {
            setDisplayedText("");
            setVisible(false);
            return undefined;
        }

        let index = 0;
        setDisplayedText("");
        setVisible(true);

        const intervalTime = Math.max(12, duration / safeText.length);

        const interval = setInterval(() => {
            index += 1;
            setDisplayedText(safeText.slice(0, index));
            if (index >= safeText.length) clearInterval(interval);
        }, intervalTime);

        return () => {
            clearInterval(interval);
            setVisible(false);
        };
    }, [safeText, duration]);

    // Fade requires a DOM node that accepts a ref — CyberText alone does not.
    return (
        <Fade in={visible} timeout={400}>
            <Box component="div">
                <CyberText>{displayedText}</CyberText>
            </Box>
        </Fade>
    );
}
