import { useState, useCallback } from "react";
import { Box } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { setDialogMinimized } from "../../store/uiSlice";
import { DIALOG_IDS } from "../../constants/dialogIds";
import CharactersRosterPanel from "./CharactersRosterPanel";
import CharacterEditorDialog from "./CharacterEditorDialog";

/**
 * Pestaña PERSONAJES de VTT Configs: roster + modal Create/Edit.
 */
export default function CharactersAdminTab({ campaignId }) {
    const dispatch = useDispatch();
    const locations = useSelector((s) => s.world.locations);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorOpts, setEditorOpts] = useState({ initialCharacterId: null, autoCreate: false });

    const openCreate = useCallback(() => {
        setEditorOpts({ initialCharacterId: null, autoCreate: true });
        setEditorOpen(true);
    }, []);

    const openEdit = useCallback((char) => {
        setEditorOpts({ initialCharacterId: char?.id || null, autoCreate: false });
        setEditorOpen(true);
    }, []);

    const closeEditor = useCallback(() => {
        setEditorOpen(false);
        setEditorOpts({ initialCharacterId: null, autoCreate: false });
    }, []);

    const minimizeForWiki = useCallback(() => {
        dispatch(setDialogMinimized({ id: DIALOG_IDS.SETTINGS, value: true }));
    }, [dispatch]);

    return (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <CharactersRosterPanel
                onCreate={openCreate}
                onEdit={openEdit}
                onMinimizeForWiki={minimizeForWiki}
            />
            <CharacterEditorDialog
                open={editorOpen}
                onClose={closeEditor}
                campaignId={campaignId}
                locations={Object.values(locations || {})}
                initialCharacterId={editorOpts.initialCharacterId}
                autoCreate={editorOpts.autoCreate}
            />
        </Box>
    );
}
