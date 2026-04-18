import { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { ROLES } from "../../constants/roles";
import { loadFirebaseAsset } from "../../../firebase/services/assetLoader";

export const CyberProfile = ({ profile, activeCharacter, accentColor, setAdminOpen, setCharactersOpen, handleLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(null);

    const isDM = profile?.role === ROLES.DM;

    useEffect(() => {
        if (activeCharacter?.imageUrl) {
            loadFirebaseAsset(activeCharacter.imageUrl).then(setAvatarUrl).catch(() => setAvatarUrl(null));
        } else {
            setAvatarUrl(null);
        }
    }, [activeCharacter?.imageUrl]);

    return (
        <StyledProfile accent={accentColor} isOpen={isOpen}>
            <div className="profile-container" onClick={() => setIsOpen(!isOpen)}>
                <div className="profile-avatar">
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={activeCharacter?.name || "character"}
                            className="char-avatar-img"
                        />
                    ) : (
                        <svg className="octocat-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                    )}
                </div>
                <div className="profile-info">
                    {activeCharacter && (
                        <div className="char-name" data-text={activeCharacter.name}>
                            {activeCharacter.name?.toUpperCase()}
                        </div>
                    )}
                    <div className="profile-name" data-text={profile?.nickname}>
                        {profile?.nickname}
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="dropdown-menu">
                    <div className="menu-header">SYSTEM_SESSIONS</div>
                    
                    {isDM && (
                        <button className="menu-item" onClick={() => setAdminOpen(true)}>
                            ADMIN_SETTINGS
                        </button>
                    )}

                    <button className="menu-item" onClick={() => setCharactersOpen(true)}>
                        CHARACTERS_SETTINGS
                    </button>

                    <button className="menu-item logout-btn" onClick={handleLogout}>
                        <span className="glitch-text" data-text="TERMINATE_CONNECTION">
                            TERMINATE_CONNECTION
                        </span>
                    </button>
                </div>
            )}
        </StyledProfile>
    );
};

const StyledProfile = styled.div`
  --primary-color: ${(props) => props.accent};
  --secondary-color: #a855f7;
  --bg-color: #050508;

  position: absolute;
  top: 20px;
  right: 20px;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 100;

  .profile-container {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(10, 10, 15, 0.9);
    padding: 8px 16px 8px 8px;
    border-radius: 40px;
    border: 1px solid ${(props) => props.isOpen ? props.accent : props.accent + '33'};
    backdrop-filter: blur(8px);
    transition: 0.3s;
    cursor: pointer;
    box-shadow: ${(props) => props.isOpen ? `0 0 15px ${props.accent}44` : 'none'};

    @media (max-width: 599px) {
      padding: 8px;
      gap: 0;
    }
  }

  .profile-info {
    @media (max-width: 599px) {
      display: none;
    }
  }

  .profile-avatar {
    width: 40px;
    height: 40px;
    background: var(--bg-color);
    border-radius: 50%;
    padding: 0;
    border: 1px solid ${(props) => props.accent}88;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: 0.5s;
    flex-shrink: 0;

    @media (max-width: 599px) {
      width: 44px;
      height: 44px;
    }
  }

  .char-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .octocat-svg {
    width: 60%;
    fill: var(--primary-color);
    filter: drop-shadow(0 0 5px ${(props) => props.accent}66);
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .char-name {
    font-family: "Fira Code", monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 1px;
    position: relative;
    line-height: 1.2;
  }

  .profile-name {
    font-family: "Fira Code", monospace;
    font-size: 0.7rem;
    font-weight: 400;
    color: ${(props) => props.accent}bb;
    text-transform: uppercase;
    letter-spacing: 1px;
    position: relative;
    line-height: 1.2;
  }

  /* Hover Effects */
  .profile-container:hover {
    border-color: var(--primary-color);
    .profile-avatar {
      border-color: var(--primary-color);
      box-shadow: 0 0 12px ${(props) => props.accent}66;
    }
    .char-name {
        color: transparent;
        &::before, &::after {
            content: attr(data-text);
            position: absolute;
            top: 0; left: 0; width: 100%;
            color: var(--primary-color);
        }
        &::before {
            color: var(--secondary-color);
            animation: glitch 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both infinite;
        }
        &::after {
            animation: glitch 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) reverse both infinite;
        }
    }
    .profile-name {
        color: var(--primary-color);
    }
  }

  /* Estilo del Menú Desplegable */
  .dropdown-menu {
    background: rgba(5, 5, 8, 0.95);
    border: 1px solid var(--primary-color);
    min-width: 220px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px ${(props) => props.accent}22;
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%);
    animation: fadeIn 0.2s ease-out;

    @media (max-width: 599px) {
      min-width: calc(100vw - 40px);
      right: 0;
    }
  }

  .menu-header {
    font-family: "Fira Code", monospace;
    font-size: 0.65rem;
    color: var(--primary-color);
    opacity: 0.5;
    margin-bottom: 8px;
    letter-spacing: 2px;
  }

  .menu-item {
    background: transparent;
    border: none;
    color: #fff;
    font-family: "Fira Code", monospace;
    font-size: 0.8rem;
    padding: 10px;
    text-align: left;
    cursor: pointer;
    text-transform: uppercase;
    transition: 0.2s;
    border-left: 2px solid transparent;

    @media (max-width: 599px) {
      font-size: 0.95rem;
      padding: 14px 10px;
    }

    &:hover {
      background: ${(props) => props.accent}22;
      border-left: 2px solid var(--primary-color);
      color: var(--primary-color);
      padding-left: 15px;
    }
  }

  .logout-btn {
    margin-top: 8px;
    color: #ff4d4d;
    &:hover {
        color: #ff4d4d;
        background: #ff4d4d11;
        border-left: 2px solid #ff4d4d;
    }
  }

  @keyframes glitch {
    0% { transform: translate(0); clip-path: inset(0 0 0 0); }
    20% { transform: translate(-2px, 1px); clip-path: inset(50% 0 20% 0); }
    40% { transform: translate(2px, -1px); clip-path: inset(20% 0 60% 0); }
    100% { transform: translate(0); clip-path: inset(0 0 0 0); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
