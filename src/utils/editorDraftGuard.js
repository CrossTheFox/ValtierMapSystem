/** WikiEntityEditor has no autosave. Tab changes ask before discarding. */
let dirty = false;

export function setEditorDraftDirty(value) {
    dirty = !!value;
}

export function confirmLeaveEditorDraft() {
    if (!dirty) return true;
    const ok = window.confirm("Hay cambios sin guardar en la ficha. Si sales, se descartan.");
    if (ok) dirty = false;
    return ok;
}
