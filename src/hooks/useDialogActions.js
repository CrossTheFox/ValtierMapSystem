import { useDispatch, useSelector } from "react-redux";
import { setDialogMinimized, toggleDialogMinimized, restoreDialog } from "../store/uiSlice";

/**
 * Per-dialog minimize helpers. Pass the dialog id from DIALOG_IDS.
 */
export default function useDialogActions(dialogId) {
    const dispatch = useDispatch();
    const isMinimized = useSelector(
        (state) => (dialogId ? state.ui.minimizedDialogs[dialogId] : false) ?? false
    );

    const toggleMinimize = () => {
        if (dialogId) dispatch(toggleDialogMinimized(dialogId));
    };

    const forceMinimize = () => {
        if (dialogId) dispatch(setDialogMinimized({ id: dialogId, value: true }));
    };

    const forceRestore = () => {
        if (dialogId) dispatch(restoreDialog(dialogId));
    };

    return {
        isMinimized,
        toggleMinimize,
        forceMinimize,
        forceRestore,
    };
}
