import React from 'react';
import styled from '@emotion/styled';
import { UI_COLORS } from '../../constants/uiColors';
import { CyberText } from './CustomTexts';

export const CyberCheckbox = ({ label, checked, onChange, name }) => {
    // Generamos un ID único si no se provee uno para evitar colisiones de labels
    const uniqueId = `checkbox-${name || label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <StyledWrapper checked={checked}>
            <div className="checkbox-wrapper">
                <input 
                    className="holo-checkbox-input" 
                    type="checkbox" 
                    checked={checked}
                    onChange={onChange}
                    name={name} // IMPORTANTE: Para que el handleChange funcione
                    id={uniqueId} // ID Único
                />
                <label className="holo-checkbox" htmlFor={uniqueId}>
                    <div className="holo-box">
                        <div className="holo-inner" />
                        <div className="scan-effect" />
                        <div className="cube-transform">
                            {[...Array(6)].map((_, i) => <div key={i} className="cube-face" />)}
                        </div>
                    </div>
                    {[...Array(4)].map((_, i) => <div key={i} className="corner-accent" />)}
                </label>
                <CyberText sx={{ ml: 2, fontSize: '13px', color: checked ? UI_COLORS.accent : '#fff' }}>
                    {label}
                </CyberText>
            </div>
        </StyledWrapper>
    );
};

const StyledWrapper = styled.div`
  margin: 10px 0 20px 0;

  .checkbox-wrapper {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .holo-checkbox-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .holo-checkbox {
    position: relative;
    width: 32px;
    height: 32px;
    perspective: 1000px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .holo-box {
    width: 100%;
    height: 100%;
    border: 1px solid ${props => props.checked ? UI_COLORS.accent : 'rgba(255,255,255,0.2)'};
    background-color: rgba(0, 0, 0, 0.4);
    box-shadow: ${props => props.checked ? `0 0 10px ${UI_COLORS.accent}44` : 'none'};
    transition: all 0.3s ease;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  /* Scan line */
  .scan-effect {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, ${UI_COLORS.accent}, transparent);
    animation: scan ${props => props.checked ? '1.5s' : '4s'} infinite linear;
    opacity: ${props => props.checked ? 1 : 0.2};
  }

  @keyframes scan {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  /* Cubo 3D escalado */
  .cube-transform {
    position: absolute;
    width: 12px;
    height: 12px;
    transform-style: preserve-3d;
    opacity: ${props => props.checked ? 1 : 0};
    animation: rotate 3s infinite linear;
    transition: 0.3s;
  }

  .cube-face {
    position: absolute;
    width: 100%;
    height: 100%;
    background: ${UI_COLORS.accent}33;
    border: 1px solid ${UI_COLORS.accent};
  }

  .cube-face:nth-of-type(1) { transform: translateZ(6px); }
  .cube-face:nth-of-type(2) { transform: rotateY(180deg) translateZ(6px); }
  .cube-face:nth-of-type(3) { transform: rotateY(90deg) translateZ(6px); }
  .cube-face:nth-of-type(4) { transform: rotateY(-90deg) translateZ(6px); }
  .cube-face:nth-of-type(5) { transform: rotateX(90deg) translateZ(6px); }
  .cube-face:nth-of-type(6) { transform: rotateX(-90deg) translateZ(6px); }

  @keyframes rotate {
    from { transform: rotateX(0) rotateY(0); }
    to { transform: rotateX(360deg) rotateY(360deg); }
  }

  /* Esquinas */
  .corner-accent {
    position: absolute;
    width: 6px;
    height: 6px;
    border: 1px solid ${props => props.checked ? UI_COLORS.accent : 'rgba(255,255,255,0.3)'};
    transition: 0.3s;
  }

  .corner-accent:nth-of-type(1) { top: -2px; left: -2px; border-right: 0; border-bottom: 0; }
  .corner-accent:nth-of-type(2) { top: -2px; right: -2px; border-left: 0; border-bottom: 0; }
  .corner-accent:nth-of-type(3) { bottom: -2px; left: -2px; border-right: 0; border-top: 0; }
  .corner-accent:nth-of-type(4) { bottom: -2px; right: -2px; border-left: 0; border-top: 0; }
`;