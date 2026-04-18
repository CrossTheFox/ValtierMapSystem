import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { useDispatch } from "react-redux";
import { fetchPlayerData, clearPlayer } from "./store/playerSlice";
import LandingPage from "./pages/LandingPage";
import MainMapPage from "./pages/MainMapPage";
import PopupDialogPage from "./pages/PopupDialogPage";

export default function App() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const dispatch = useDispatch();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Cargamos el nickname y rol inmediatamente
                dispatch(fetchPlayerData(currentUser.uid));
            } else {
                dispatch(clearPlayer());
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [dispatch]);

    if (authLoading) return null; // O un loader simple de sistema

    return (
        <Router>
            <Routes>
                {/* Si no hay usuario, Landing. Si hay, redirige al mapa */}
                <Route 
                    path="/" 
                    element={user ? <Navigate to="/map" /> : <LandingPage />} 
                />
                
                {/* Ruta del Mapa Protegida */}
                <Route 
                    path="/map" 
                    element={user ? <MainMapPage /> : <Navigate to="/" />} 
                />

                {/* Ventana emergente de diálogos (popup) */}
                <Route
                    path="/popup"
                    element={user ? <PopupDialogPage /> : <Navigate to="/" />}
                />
            </Routes>
        </Router>
    );
}