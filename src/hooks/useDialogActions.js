import { useDispatch, useSelector } from "react-redux";
import { setIsMinimized, toggleIsMinimized } from "../store/uiSlice";

export default function useDialogActions() {
    const dispatch = useDispatch();
    const isMinimized = useSelector((state) => state.ui.isMinimized);

    const toggleMinimize = () => {
        dispatch(toggleIsMinimized());
    };

    const forceMinimize = () => {
        dispatch(setIsMinimized(true));
    };

    const forceRestore = () => {
        dispatch(setIsMinimized(false));
    };

    return {
        isMinimized,
        toggleMinimize,
        forceMinimize,
        forceRestore
    };
}