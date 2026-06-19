import { useEffect, useState } from "react";
import { getClaseDocsByIds } from "../../firebase/services/classService";
import { formatClassLabel } from "../constants/characterSheetTokens";

/**
 * Resolves human-readable job names from `clases/{id}.displayName`.
 * Falls back to a cleaned slug when the doc is missing.
 */
export function useCharacterClassLabels(character) {
    const classIds = character?.assignedClassIds || [];
    const [labelsById, setLabelsById] = useState({});

    useEffect(() => {
        if (!classIds.length) {
            setLabelsById({});
            return;
        }

        let cancelled = false;
        getClaseDocsByIds(classIds)
            .then((docs) => {
                if (cancelled) return;
                const map = {};
                for (const id of classIds) {
                    const doc = docs.find((d) => d.id === id);
                    map[id] = doc?.displayName || formatClassLabel(id, character?.name);
                }
                setLabelsById(map);
            })
            .catch(() => {
                if (!cancelled) {
                    const map = Object.fromEntries(
                        classIds.map((id) => [id, formatClassLabel(id, character?.name)])
                    );
                    setLabelsById(map);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [classIds.join(","), character?.id, character?.name]);

    const labelFor = (classId) =>
        labelsById[classId] || formatClassLabel(classId, character?.name);

    return { labelFor, labelsById };
}
