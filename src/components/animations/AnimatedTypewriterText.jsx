import { useEffect, useState } from "react";
import { Typography, Fade } from "@mui/material";

export default function AnimatedTypewriterText({
    text = "",
    duration = 1500, // tiempo total en ms
}) {
    const [displayedText, setDisplayedText] = useState("");
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!text) return;

        let index = 0;
        setDisplayedText("");
        setVisible(true);

        const intervalTime = duration / text.length;

        const interval = setInterval(() => {
            index++;
            setDisplayedText(text.slice(0, index));

            if (index >= text.length) {
                clearInterval(interval);
            }
        }, intervalTime);

        return () => {
            clearInterval(interval);
            setVisible(false);
        };
    }, [text, duration]);

    return (
        <Fade in={visible} timeout={400}>
            <Typography sx={{ whiteSpace: "pre-wrap" }}>
                {displayedText}
            </Typography>
        </Fade>
    );
}
