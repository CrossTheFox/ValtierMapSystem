import { configureStore } from "@reduxjs/toolkit";
import worldReducer from "./worldSlice";
import uiReducer from "./uiSlice";
import playerReducer from "./playerSlice";
import characterReducer from "./characterSlice";
import gameReducer from "./gameSlice";

export const store = configureStore({
    reducer: {
        world: worldReducer,
        ui: uiReducer,
        player: playerReducer,
        characters: characterReducer,
        game: gameReducer,
    },
});
