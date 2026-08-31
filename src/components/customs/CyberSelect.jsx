import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Box, Menu, MenuItem } from "@mui/material";
import { cyberMenuPaperSx, cyberMenuItemSx } from "../../constants/designSystem";
import { CYBER_SCROLL_STYLE } from "../../constants/cyberScrollStyle";

/**
 * Cyber-styled dropdown — replaces every native `<select>` in the KIT dossier
 * (cost / range / AoE / traitMode / RES / DIE / job picker). Never cycles on click,
 * always opens a MUI `Menu` styled with the shared cyber menu tokens.
 *
 * Two trigger flavors from the mockup (`cyberSelHtml` / `vchipCyberSel`):
 * - Default (no `renderTrigger`): a plain text/label button — used for DIE, packet die.
 * - `renderTrigger`: caller renders the trigger itself (e.g. a chip) and wires its
 *   `onClick` to the provided `onOpen` — used for cost/range/AoE/traitMode/RES chips
 *   where the chip *is* the button, no separate arrow affordance.
 *
 * `menuVariant="vchip"` mirrors `.cyber-sel.vchip-sel .vchip-panel`: options render
 * as chip glyphs (via `renderOption`), not plain text rows.
 */
export default function CyberSelect({
    value,
    options = [],
    onChange,
    placeholder = "—",
    renderTrigger = null,
    renderOption = null,
    menuVariant = "default",
    triggerSx = {},
    disabled = false,
    openRef = null,
    "aria-label": ariaLabel,
    title,
}) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const menuId = useId();
    const isVchip = menuVariant === "vchip";
    const triggerRef = useRef(null);

    const current = options.find((o) => String(o.value) === String(value ?? ""));

    const onOpen = useCallback((e) => {
        e?.stopPropagation?.();
        if (disabled) return;
        const el = e?.currentTarget ?? triggerRef.current;
        if (el) setAnchorEl(el);
    }, [disabled]);

    useEffect(() => {
        if (!openRef) return undefined;
        openRef.current = () => {
            if (disabled || !triggerRef.current) return;
            setAnchorEl(triggerRef.current);
        };
        return () => {
            if (openRef.current) openRef.current = null;
        };
    }, [disabled, openRef]);

    const handleClose = useCallback((e) => {
        e?.stopPropagation?.();
        setAnchorEl(null);
    }, []);

    const handlePick = useCallback((e, next) => {
        e.stopPropagation();
        setAnchorEl(null);
        if (String(next) !== String(value ?? "")) onChange?.(next);
    }, [onChange, value]);

    const vchipMenuPaperSx = {
        ...cyberMenuPaperSx,
        minWidth: 88,
        p: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        borderColor: "rgba(255,102,255,0.35)",
        maxHeight: 220,
        ...CYBER_SCROLL_STYLE,
    };

    const vchipMenuItemSx = (selected) => ({
        ...cyberMenuItemSx,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: "4px",
        borderRadius: "2px",
        minHeight: "auto",
        width: "100%",
        ...(selected ? {
            bgcolor: "rgba(255,102,255,0.18)",
            boxShadow: "inset 0 0 0 1px rgba(255,102,255,0.45)",
        } : {}),
        "&:hover": {
            bgcolor: selected ? "rgba(255,102,255,0.22)" : "rgba(255,102,255,0.12)",
        },
    });

    return (
        <>
            {renderTrigger ? (
                renderTrigger(current, { open, onOpen, disabled, triggerRef })
            ) : (
                <Box
                    component="button"
                    type="button"
                    onClick={onOpen}
                    disabled={disabled}
                    title={title}
                    aria-label={ariaLabel}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        bgcolor: "transparent",
                        border: "none",
                        outline: "none",
                        color: "inherit",
                        font: "inherit",
                        cursor: disabled ? "default" : "pointer",
                        opacity: disabled ? 0.5 : 1,
                        ...triggerSx,
                    }}
                >
                    <span>{current ? current.label : placeholder}</span>
                </Box>
            )}
            <Menu
                id={menuId}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                onClick={(e) => e.stopPropagation()}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        sx: isVchip ? vchipMenuPaperSx : {
                            ...cyberMenuPaperSx,
                            maxHeight: 260,
                            ...CYBER_SCROLL_STYLE,
                        },
                    },
                }}
            >
                {options.map((opt) => {
                    const selected = String(opt.value) === String(value ?? "");
                    return (
                        <MenuItem
                            key={String(opt.value)}
                            selected={selected}
                            onClick={(e) => handlePick(e, opt.value)}
                            sx={isVchip ? vchipMenuItemSx(selected) : cyberMenuItemSx}
                        >
                            {renderOption ? renderOption(opt, { selected }) : opt.label}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
}
