import { useState } from "react";
import { loginPlayer } from "../../firebase/playersAuth";
import { UI_COLORS } from "../constants/uiColors";
import { Square } from "../assets/DecorativeSquare";
import { StyledWrapper } from "../styles/LandingPageStyles";
import CyberPattern from "../components/animations/CyberPattern";
// Importamos tus customTexts
import { CyberTitle, CyberText } from "../components/customs/CustomTexts"; 

const LandingPage = () => {
    const [nickname, setNickname] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const accentColor = UI_COLORS.accent || "#00f2ea";

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await loginPlayer(nickname, password);
        } catch (error) {
            console.error("Auth Error:", error);
            alert("ACCESO DENEGADO: Credenciales incorrectas.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <StyledWrapper accent={accentColor}>
            <CyberPattern />

            <div className="login-box">
                {/* Usamos CyberTitle para el encabezado */}
                <CyberTitle variant="h5" className="title-auth">
                    SYSTEM_AUTH
                </CyberTitle>

                <form onSubmit={handleLogin}>
                    <div className="user-box">
                        <input 
                            required 
                            type="text" 
                            value={nickname}
                            placeholder=" " /* Importante: espacio en blanco para activar :not(:placeholder-shown) */
                            onChange={(e) => setNickname(e.target.value)}
                        />
                        <label>
                            <CyberText component="span" sx={{ color: 'inherit' }}>Username</CyberText>
                        </label>
                    </div>

                    <div className="user-box">
                        <input 
                            required 
                            type="password" 
                            value={password}
                            placeholder=" " /* Importante */
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <label>
                            <CyberText component="span" sx={{ color: 'inherit' }}>Access Key</CyberText>
                        </label>
                    </div>
                    
                    <button type="submit" className="submit-btn">
                        <span /> <span /> <span /> <span />
                        <CyberTitle component="span" sx={{ fontSize: '1rem' }}>
                            {loading ? "VERIFYING..." : "SUBMIT"}
                        </CyberTitle>
                    </button>
                </form>
            </div>
        </StyledWrapper>
    );    
}

export default LandingPage;