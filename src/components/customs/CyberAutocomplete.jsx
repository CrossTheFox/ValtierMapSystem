import { Autocomplete, styled } from '@mui/material';
import { UI_COLORS } from '../../constants/uiColors';

export const CyberAutocomplete = styled(Autocomplete)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        color: '#fff',
        fontFamily: 'Michroma, sans-serif',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 0,
        paddingRight: '40px !important',
        '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderLeft: `4px solid ${UI_COLORS.accent || "#00f2ea"}`,
        },
        '&:hover fieldset': {
            borderColor: UI_COLORS.accent || "#00f2ea",
            boxShadow: `inset 0 0 10px ${UI_COLORS.accent || "#00f2ea"}33`,
        },
        '&.Mui-focused fieldset': {
            borderColor: UI_COLORS.accent || "#00f2ea",
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline legend, &:hover .MuiOutlinedInput-notchedOutline legend': {
            backgroundColor: 'transparent',
        }
    },
    '& .MuiAutocomplete-popper': {
        zIndex: 1300,
    },

    '& + .MuiAutocomplete-popper .MuiPaper-root': {
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontFamily: 'Michroma, sans-serif',
        borderRadius: 0,
        border: `1px solid ${UI_COLORS.accent || "#00f2ea"}33`,
        marginTop: '4px',
        '& .MuiAutocomplete-listbox': {
            maxHeight: '250px', // Hacerlo scrolleable
            padding: 0,
            '& .MuiAutocomplete-option': {
                fontSize: '0.8rem',
                padding: '12px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                '&:hover': {
                    backgroundColor: `${UI_COLORS.accent || "#00f2ea"}22`,
                    color: UI_COLORS.accent || "#00f2ea",
                },
                '&[aria-selected="true"]': {
                    backgroundColor: `${UI_COLORS.accent || "#00f2ea"}44`,
                }
            }
        }
    }
}));