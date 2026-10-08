import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';

export default function AdminMenu({ socket, isAdmin, onLogout }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    const handleAction = (action) => {
        if (!socket) return;

        if (action === 'reset') {
            Swal.fire({
                title: t('admin.reset_title'),
                text: t('admin.reset_text'),
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#28a745', 
                cancelButtonColor: '#d33',
                confirmButtonText: t('admin.reset_confirm'),
                cancelButtonText: t('admin.cancel'),
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
                title: t('admin.kick_title'),
                text: t('admin.kick_text'),
                icon: 'error', 
                showCancelButton: true,
                confirmButtonColor: '#d33', 
                cancelButtonColor: '#3085d6',
                confirmButtonText: t('admin.kick_confirm'),
                cancelButtonText: t('admin.cancel'),
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

            {isOpen && (
                <>
                    <div className="menu-backdrop" onClick={() => setIsOpen(false)} />
                    <div className="admin-dropdown">
                        {isAdmin && (
                            <>
                                <div className="menu-label">{t('admin.zone_label')}</div>
                                <button onClick={() => handleAction('reset')} className="menu-item btn-reset">
                                    🔄 {t('admin.btn_reset')}
                                </button>
                                <button onClick={() => handleAction('kick')} className="menu-item btn-kick">
                                    ⚠️ {t('admin.btn_kick')}
                                </button>
                                <hr className="menu-divider" />
                            </>
                        )}

                        <button onClick={onLogout} className="menu-item btn-logout-text">
                            🚪 {t('admin.btn_logout')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}