import PixiRoot from "./layers/PixiRoot";
import UIOverlay from "./layers/UIOverlay";
import { useEffect } from "react";
import { testFirestore } from "./testFirebase";
import { testStorage } from "./testStorage";

export default function App() {

    useEffect(() => {
        testFirestore();
        testStorage();
    }, []);

    return (
        <>
            <PixiRoot />
            <UIOverlay />
        </>
    );
}
