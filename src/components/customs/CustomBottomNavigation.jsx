import {
    BottomNavigation,
    BottomNavigationAction,
} from "@mui/material";

import { UI_COLORS } from "../../constants/uiColors";

export default function CustomBottomNavigation({
    value,
    onChange,
    actions = [],
}) {
    return (
        <BottomNavigation
            value={value}
            onChange={onChange}
            showLabels
            sx={{
                borderTop: `1px solid ${UI_COLORS.border}`,
                backgroundColor: UI_COLORS.backgroundSecondary,
            }}
        >
            {actions.map((action, index) => (
                <BottomNavigationAction
                    key={index}
                    label={action.label}
                    icon={action.icon}
                    sx={{
                        color: UI_COLORS.textSecondary,
                        transition: "all 0.3s ease",

                        "&.Mui-selected": {
                            color: UI_COLORS.accentStrong,
                            textShadow: `0 0 10px ${UI_COLORS.accentGlow}`,
                        },

                        "& .MuiSvgIcon-root": {
                            transition: "all 0.3s ease",
                        },

                        "&.Mui-selected .MuiSvgIcon-root": {
                            filter: `drop-shadow(0 0 6px ${UI_COLORS.accentGlow})`,
                        },
                    }}
                />
            ))}
        </BottomNavigation>
    );
}
