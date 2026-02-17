// AdminMenu.jsx
import React, { useState } from 'react';
import Swal from 'sweetalert2';

export default function AdminMenu({ socket, isAdmin, onLogout }) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleAction = (action) => {
        if (!socket) return;

        if (action === 'reset') {
        Swal.fire({
            title: 'Spiel neustarten?',
            text: "Das Spiel wird komplett zurückgesetzt und alle Rollen neu verteilt.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#28a745', 
            cancelButtonColor: '#d33',
            confirmButtonText: 'Ja, Neustart!',
            cancelButtonText: 'Abbrechen',
            background: '#1e1e23', 
            color: '#ffffff'      
        }).then((result) => {
            if (result.isConfirmed) {
                socket.emit('resetGame');
                setIsOpen(false);
            }
        });
    }

    if (action === 'kick') {
        Swal.fire({
            title: 'ALLE RAUSWERFEN?',
            text: "ACHTUNG: Alle Spieler werden vom Server getrennt! Das kann nicht rückgängig gemacht werden.",
            icon: 'error', 
            showCancelButton: true,
            confirmButtonColor: '#d33', 
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ja, alle kicken!',
            cancelButtonText: 'Abbrechen',
            background: '#1e1e23',
            color: '#ffffff'       
        }).then((result) => {
            if (result.isConfirmed) {
                socket.emit('kickAll');
                setIsOpen(false);
            }
        });
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