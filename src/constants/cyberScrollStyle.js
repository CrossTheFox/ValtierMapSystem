import { UI_COLORS } from "./uiColors";

export const CYBER_SCROLL_STYLE = {
    '&::-webkit-scrollbar': { width: '10px' },
    '&::-webkit-scrollbar-track': { background: '#0d0d14' },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: 'transparent',
        backgroundImage: `linear-gradient(180deg, ${UI_COLORS.accent} 0%, rgba(0, 242, 234, 0.2) 50%, ${UI_COLORS.accent} 100%)`,
        border: `1px solid ${UI_COLORS.accent}`,
    }
};