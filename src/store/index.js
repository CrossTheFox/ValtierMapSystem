import { configureStore } from "@reduxjs/toolkit";
import worldReducer from "./worldSlice";
import uiReducer from "./uiSlice";
import playerReducer from "./playerSlice";

export const store = configureStore({
    reducer: {
        world: worldReducer,
        ui: uiReducer,
        player: playerReducer,
    },
});
