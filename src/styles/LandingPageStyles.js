import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

// --- ANIMACIONES (Keyframes) ---
const btnAnim1 = keyframes`
  0% { left: -100%; }
  50%, 100% { left: 100%; }
`;

const btnAnim2 = keyframes`
  0% { top: -100%; }
  50%, 100% { top: 100%; }
`;

const btnAnim3 = keyframes`
  0% { right: -100%; }
  50%, 100% { right: 100%; }
`;

const btnAnim4 = keyframes`
  0% { bottom: -100%; }
  50%, 100% { bottom: 100%; }
`;

const glitch = keyframes`
  0% { transform: translate(0); clip-path: inset(0 0 0 0); }
  20% { transform: translate(-2px, 1px); clip-path: inset(50% 0 20% 0); }
  40% { transform: translate(2px, -1px); clip-path: inset(20% 0 60% 0); }
  100% { transform: translate(0); clip-path: inset(0 0 0 0); }
`;

// --- ESTILO PRINCIPAL ---
export const StyledWrapper = styled.div`
  background-color: #050508;
  height: 100vh;
  width: 100vw;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;

  .login-box {
    position: relative;
    width: min(400px, calc(100vw - 32px));
    padding: clamp(20px, 6vw, 40px);
    background: rgba(10, 10, 15, 0.95);
    box-sizing: border-box;
    box-shadow: 0 15px 25px rgba(0,0,0,.6), 0 0 10px ${(props) => props.accent}22;
    border-radius: 10px;
    border: 1px solid ${(props) => props.accent}33;
    z-index: 10;
    backdrop-filter: blur(10px);
  }

  /* Título con Orbitron (vía CyberTitle) */
  .title-auth {
    margin: 0 0 30px !important;
    color: ${(props) => props.accent};
    text-shadow: 0 0 10px ${(props) => props.accent}88;
    text-align: center;
    font-weight: bold;
  }

  .user-box {
    position: relative;
    margin-bottom: 30px;
  }

  .user-box input {
    width: 100%;
    padding: 10px 0;
    font-family: 'Michroma', sans-serif;
    font-size: 14px;
    color: #ffffff !important; /* Forzamos blanco para el texto ingresado */
    border: none;
    border-bottom: 1px solid ${(props) => props.accent}66;
    outline: none;
    background: transparent;
    transition: 0.3s;

    /* Reset para autocompletado del navegador */
    &:-webkit-autofill,
    &:-webkit-autofill:hover, 
    &:-webkit-autofill:focus {
      -webkit-text-fill-color: #ffffff;
      -webkit-box-shadow: 0 0 0px 1000px #0a0a0f inset;
      transition: background-color 5000s ease-in-out 0s;
    }
  }

  .user-box input:focus {
    border-bottom: 1px solid ${(props) => props.accent};
  }

  .user-box label {
    position: absolute;
    top: 0;
    left: 0;
    padding: 10px 0;
    pointer-events: none;
    transition: 0.5s;
    color: rgba(255, 255, 255, 0.5); /* Color grisáceo inicial */
  }

  /* Efecto Float: Cuando tiene foco o el placeholder no se ve (tiene texto) */
  .user-box input:focus ~ label,
  .user-box input:not(:placeholder-shown) ~ label {
    top: -25px;
    left: 0;
    color: ${(props) => props.accent} !important;
    opacity: 1;
    
    & span {
      font-size: 10px !important;
      color: ${(props) => props.accent} !important;
    }
  }

  /* --- BOTÓN SUBMIT --- */
  .submit-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px 20px;
    margin-top: 20px;
    width: 100%;
    overflow: hidden;
    transition: 0.5s;
    color: ${(props) => props.accent};
  }

  .submit-btn:hover {
    background: ${(props) => props.accent};
    color: #000 !important;
    border-radius: 5px;
    box-shadow: 0 0 5px ${(props) => props.accent}, 0 0 25px ${(props) => props.accent};

    /* Invertimos el color de los textos internos en hover */
    & span, & h5, & p {
      color: #000 !important;
    }
  }

  .submit-btn span:not(.MuiTypography-root) {
    position: absolute;
    display: block;
  }

  .submit-btn span:nth-of-type(1) {
    top: 0; left: -100%; width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, ${(props) => props.accent});
    animation: ${btnAnim1} 1.5s linear infinite;
  }

  .submit-btn span:nth-of-type(2) {
    top: -100%; right: 0; width: 2px; height: 100%;
    background: linear-gradient(180deg, transparent, ${(props) => props.accent});
    animation: ${btnAnim2} 1.5s linear infinite;
    animation-delay: .375s;
  }

  .submit-btn span:nth-of-type(3) {
    bottom: 0; right: -100%; width: 100%; height: 2px;
    background: linear-gradient(270deg, transparent, ${(props) => props.accent});
    animation: ${btnAnim3} 1.5s linear infinite;
    animation-delay: .75s;
  }

  .submit-btn span:nth-of-type(4) {
    bottom: -100%; left: 0; width: 2px; height: 100%;
    background: linear-gradient(360deg, transparent, ${(props) => props.accent});
    animation: ${btnAnim4} 1.5s linear infinite;
    animation-delay: 1.125s;
  }

  /* Link de Sign Up */
  .a2 {
    color: ${(props) => props.accent};
    text-decoration: none;
    font-weight: bold;
    transition: 0.3s;
    &:hover {
      color: #fff;
      text-shadow: 0 0 5px ${(props) => props.accent};
    }
  }
`;