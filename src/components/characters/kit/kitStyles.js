import { UI_COLORS } from "../../../constants/uiColors";
import { CYBER_SCROLL_STYLE } from "../../../constants/cyberScrollStyle";

/** Shared textarea chrome for ability/trait/job/mech description editors in the KIT dossier. */
export const ABILITY_TEXTAREA_SX = {
    width: "100%",
    boxSizing: "border-box",
    background: "#12121a",
    border: "1px solid rgba(0,242,234,0.35)",
    borderRadius: "2px",
    color: "#ffffff",
    fontSize: "0.9rem",
    lineHeight: 1.5,
    p: "8px",
    resize: "vertical",
    outline: "none",
    fontFamily: '"Fira Sans", sans-serif',
    "&:focus": { borderColor: UI_COLORS.anomaly },
    ...CYBER_SCROLL_STYLE,
};
