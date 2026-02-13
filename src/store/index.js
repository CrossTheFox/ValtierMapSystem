import { configureStore } from "@reduxjs/toolkit";
import worldReducer from "./worldSlice";
import uiReducer from "./uiSlice";

export const store = configureStore({
    reducer: {
        world: worldReducer,
        ui: uiReducer,
    },
});
