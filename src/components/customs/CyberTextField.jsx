import { TextField, styled } from '@mui/material';
import { UI_COLORS } from '../../constants/uiColors';

export const CyberTextField = styled(TextField)({
    '& .MuiOutlinedInput-root': {
        borderRadius: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        fontFamily: 'Michroma, sans-serif',
        color: '#fff',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderLeft: `4px solid ${UI_COLORS.accent || "#00f2ea"}`,
        },
        '&:hover fieldset': {
            borderColor: UI_COLORS.accent || "#00f2ea",
        },
        '&.Mui-focused fieldset': {
            borderColor: UI_COLORS.accent || "#00f2ea",
        },
    },
    '& .MuiInputLabel-root': {
        color: 'rgba(255, 255, 255, 0.7)',
        fontFamily: 'Michroma, sans-serif',
        textTransform: 'uppercase',
    }
});