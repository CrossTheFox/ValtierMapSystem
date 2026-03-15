import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { CyberText, CyberTitle } from "./CustomTexts";
import { UI_COLORS } from "../../constants/uiColors";

// --- ANIMACIONES PARA EL BOTÓN ---
const btnAnim1 = keyframes` 0% { left: -100%; } 50%, 100% { left: 100%; } `;
const btnAnim2 = keyframes` 0% { top: -100%; } 50%, 100% { top: 100%; } `;
const btnAnim3 = keyframes` 0% { right: -100%; } 50%, 100% { right: 100%; } `;
const btnAnim4 = keyframes` 0% { bottom: -100%; } 50%, 100% { bottom: 100%; } `;

const accent = UI_COLORS.accent || "#00f2ea";

export const CyberInput = ({ label, value, onChange, type = "text", multiline, rows = 3, select, children, allowAutofill = false, ...props }) => {
	const autoCompleteValue = allowAutofill ? "on" : "off";

	if (select) {
        return (
            <InputContainer accent={accent}>
                <select 
                    value={value} 
                    onChange={onChange} 
                    style={{
                        width: '100%', background: 'transparent', border: 'none', 
                        borderBottom: `1px solid ${accent}66`, color: '#fff', 
                        padding: '10px 0', fontFamily: 'Michroma'
                    }}
                >
                    {children}
                </select>
                <label style={{ top: '-20px', color: accent, fontSize: '10px' }}>
                    <CyberText component="span">{label}</CyberText>
                </label>
            </InputContainer>
        );
    }

    const InputTag = multiline ? "textarea" : "input";
    
    return (
        <InputContainer accent={accent}>
            <InputTag 
                {...props}
                type={type} 
                value={value} 
                placeholder=" " 
                onChange={onChange}
                rows={multiline ? rows : undefined}
                autoComplete={autoCompleteValue}
            />
            <label>
                <CyberText component="span" sx={{ color: 'inherit', fontSize: '12px' }}>{label}</CyberText>
            </label>
        </InputContainer>
    );
};

export const CyberButton = ({ children, onClick, loading, type = "submit" }) => (
    <StyledButton type={type} onClick={onClick} className="submit-btn" accent={accent}>
        <span /><span /><span /><span />
        <CyberTitle component="span" sx={{ fontSize: '0.9rem' }}>
            {loading ? "PROCESSING..." : children}
        </CyberTitle>
    </StyledButton>
);

// --- ESTILOS LOCALES ---
const InputContainer = styled.div`
    position: relative;
    margin-bottom: 30px;
    width: 100%;

    /* Incluimos select en los estilos base */
    input, textarea, select {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 0;
        font-family: 'Michroma', sans-serif;
        font-size: 14px;
        color: #fff !important;
        border: none;
        border-bottom: 1px solid ${props => props.accent}66;
        outline: none;
        background: transparent;
        transition: 0.3s;
        appearance: none; /* Quita la flecha default en algunos navegadores si prefieres */

        &:focus { 
            border-bottom: 1px solid ${props => props.accent}; 
        }
    }

    label {
        position: absolute;
        top: 0; left: 0; padding: 10px 0;
        pointer-events: none;
        transition: 0.5s;
        color: rgba(255, 255, 255, 0.5);
    }

    /* REGLA MAESTRA: Añadimos select y la clase .shrink */
    input:focus ~ label, 
    input:not(:placeholder-shown) ~ label,
    textarea:focus ~ label,
    textarea:not(:placeholder-shown) ~ label,
    select:focus ~ label,
    label.shrink {
        top: -25px !important;
        color: ${props => props.accent} !important;
        & span { 
            font-size: 10px !important; 
            color: inherit !important; 
        }
    }
`;

const StyledButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 15px 20px;
  width: 100%;
  overflow: hidden;
  transition: 0.5s;
  color: ${props => props.accent};
  
  &:hover {
    background: ${props => props.accent};
    box-shadow: 0 0 15px ${props => props.accent};
    color: #000;
    & span { color: #000 !important; }
  }

  /* Los 4 spans para el efecto de borde animado */
  & > span:not(.MuiTypography-root) {
    position: absolute;
    display: block;
  }

  & span:nth-of-type(1) {
    top: 0; left: -100%; width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, ${props => props.accent});
    animation: ${btnAnim1} 1.5s linear infinite;
  }

  & span:nth-of-type(2) {
    top: -100%; right: 0; width: 2px; height: 100%;
    background: linear-gradient(180deg, transparent, ${props => props.accent});
    animation: ${btnAnim2} 1.5s linear infinite;
    animation-delay: .375s;
  }

  & span:nth-of-type(3) {
    bottom: 0; right: -100%; width: 100%; height: 2px;
    background: linear-gradient(270deg, transparent, ${props => props.accent});
    animation: ${btnAnim3} 1.5s linear infinite;
    animation-delay: .75s;
  }

  & span:nth-of-type(4) {
    bottom: -100%; left: 0; width: 2px; height: 100%;
    background: linear-gradient(360deg, transparent, ${props => props.accent});
    animation: ${btnAnim4} 1.5s linear infinite;
    animation-delay: 1.125s;
  }
`;