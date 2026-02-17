// AdminMenu.jsx
import React, { useState } from 'react';

export default function AdminMenu({ socket, isAdmin, onLogout }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleAction = (action) => {
        if (!socket) return;

        if (action === 'reset') {
            if (window.confirm("Sicher? Das Spiel wird komplett neu gestartet.")) {
                socket.emit('resetGame');
                setIsOpen(false);
            }
        }
        if (action === 'kick') {
            if (window.confirm("ACHTUNG: Alle Spieler werden rausgeworfen!")) {
                socket.emit('kickAll');
                setIsOpen(false);
            }
        }
    };

    return (
        <div className="admin-menu-container">
            <button onClick={toggleMenu} className="btn-menu-trigger">
                {isAdmin ? '⚙️' : '❌'}
            </button>

            {/*ausklappbares Menü */}
            {isOpen && (
                <>
                    <div className="menu-backdrop" onClick={() => setIsOpen(false)} />
                    <div className="admin-dropdown">
                        {isAdmin && (
                            <>
                                <div className="menu-label">ADMIN ZONE</div>
                                <button onClick={() => handleAction('reset')} className="menu-item btn-reset">
                                    🔄 Spiel Neustarten
                                </button>
                                <button onClick={() => handleAction('kick')} className="menu-item btn-kick">
                                    ⚠️ Alle Kicken
                                </button>
                                <hr className="menu-divider" />
                            </>
                        )}

                        <button onClick={onLogout} className="menu-item btn-logout-text">
                            🚪 Ausloggen
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}