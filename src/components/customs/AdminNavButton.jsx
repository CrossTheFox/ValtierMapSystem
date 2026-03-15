import React from 'react';
import styled from '@emotion/styled';
import { UI_COLORS } from '../../constants/uiColors';

const AdminNavButton = ({ label, onClick, isSelected }) => {
  return (
    <StyledWrapper isSelected={isSelected}>
      <button onClick={onClick}>
        {label}
      </button>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  width: 100%;

  button {
    align-items: center;
    background-color: transparent;
    /* Si está seleccionado, usa el color de acento, si no, blanco */
    color: ${props => props.isSelected ? (UI_COLORS.accent || "#00f2ea") : "#ffffff"};
    cursor: pointer;
    display: flex;
    /* Usamos Orbitron o Michroma para mantener tu estética TTRPG */
    font-family: 'Orbitron', sans-serif;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.5;
    text-decoration: none;
    text-transform: uppercase;
    outline: 0;
    border: 0;
    padding: 0.8rem 1.5rem;
    transition: all .3s ease;
    width: 100%;
    text-align: left;
  }

  button:before {
    background-color: ${props => props.isSelected ? (UI_COLORS.accent || "#00f2ea") : "#ffffff"};
    content: "";
    display: inline-block;
    height: 2px; /* Un poco más grueso para que resalte */
    margin-right: 10px;
    transition: all .42s cubic-bezier(.25,.8,.25,1);
    /* Si está seleccionado, el guion ya mide 2rem */
    width: ${props => props.isSelected ? "2.5rem" : "0"};
  }

  button:hover {
    color: ${UI_COLORS.accent || "#00f2ea"};
    background-color: rgba(255, 255, 255, 0.03);
  }

  button:hover:before {
    background-color: ${UI_COLORS.accent || "#00f2ea"};
    width: 3rem;
  }
`;

export default AdminNavButton;