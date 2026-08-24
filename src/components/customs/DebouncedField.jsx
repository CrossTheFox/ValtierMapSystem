import { useCallback } from "react";
import { Box, TextField } from "@mui/material";
import { useLocalText } from "../../hooks/useLocalText";

/**
 * Native input/textarea with local draft — parent only sees commits after idle/blur.
 */
export function DebouncedBoxInput({
    value,
    onCommit,
    onBlurExtra,
    component = "input",
    ...rest
}) {
    const commit = useCallback((next) => onCommit?.(next), [onCommit]);
    const text = useLocalText(value ?? "", commit);
    const { onFocus: userFocus, onBlur: userBlur, onChange: _ignored, ...boxRest } = rest;
    return (
        <Box
            component={component}
            value={text.value}
            onFocus={(e) => {
                text.onFocus();
                userFocus?.(e);
            }}
            onBlur={(e) => {
                text.onBlur();
                onBlurExtra?.(e);
                userBlur?.(e);
            }}
            onChange={(e) => text.setValue(e.target.value)}
            {...boxRest}
        />
    );
}

/** MUI TextField variant of {@link DebouncedBoxInput}. */
export function DebouncedTextField({ value, onCommit, onBlurExtra, ...props }) {
    const commit = useCallback((next) => onCommit?.(next), [onCommit]);
    const text = useLocalText(value ?? "", commit);
    const { onFocus: userFocus, onBlur: userBlur, onChange: _ignored, ...fieldRest } = props;
    return (
        <TextField
            {...fieldRest}
            value={text.value}
            onFocus={(e) => {
                text.onFocus();
                userFocus?.(e);
            }}
            onBlur={(e) => {
                text.onBlur();
                onBlurExtra?.(e);
                userBlur?.(e);
            }}
            onChange={(e) => text.setValue(e.target.value)}
        />
    );
}
