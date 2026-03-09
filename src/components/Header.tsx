'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import LogoMark from './LogoMark';
import styles from './Header.module.css';

export default function Header() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const pathname = usePathname();
    const menuRef = useRef<HTMLDivElement | null>(null);
    const { authReady, openAuthModal, logout, user } = useAuth();

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const displayName = user?.displayName?.trim() || user?.email || 'Account';
    const avatarLabel = displayName.charAt(0).toUpperCase() || 'R';

    return (
        <header className={styles.header}>
            <Link href="/" className={styles.logo}>
                <span className={styles.logoIcon}>
                    <LogoMark className={styles.logoMark} />
                </span>
                <span className={styles.logoLockup}>
                    <span className={styles.logoText}>
                        Refinr
                    </span>
                    <span className={styles.logoMeta}>Editorial AI</span>
                </span>
            </Link>

            <button
                className={styles.mobileToggle}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
            >
                {mobileOpen ? '✕' : '☰'}
            </button>

            <nav className={`${styles.nav} ${mobileOpen ? styles.navOpen : ''}`}>
                <Link
                    href="/"
                    className={`${styles.navLink} ${pathname === '/' ? styles.navLinkActive : ''}`}
                    onClick={() => setMobileOpen(false)}
                >
                    Editor
                </Link>
                <Link
                    href="/about"
                    className={`${styles.navLink} ${pathname === '/about' ? styles.navLinkActive : ''}`}
                    onClick={() => setMobileOpen(false)}
                >
                    About
                </Link>
                {user && (
                    <Link
                        href="/documents"
                        className={`${styles.navLink} ${pathname.startsWith('/documents') ? styles.navLinkActive : ''}`}
                        onClick={() => setMobileOpen(false)}
                    >
                        My Documents
                    </Link>
                )}
                {user && (
                    <Link
                        href="/voice"
                        className={`${styles.navLink} ${pathname.startsWith('/voice') ? styles.navLinkActive : ''}`}
                        onClick={() => setMobileOpen(false)}
                    >
                        Voice DNA
                    </Link>
                )}
                <div className={styles.headerActions}>
                    <div className={styles.ethicsBadge}>
                        <span>🛡️</span>
                        Ethical AI
                    </div>
                    {!authReady ? (
                        <div className={styles.authStatus}>Syncing</div>
                    ) : user ? (
                        <div className={styles.profileWrap} ref={menuRef}>
                            <button
                                type="button"
                                className={styles.profileButton}
                                onClick={() => setProfileOpen(prev => !prev)}
                                aria-label="Open account menu"
                                aria-expanded={profileOpen}
                            >
                                <span className={styles.profileAvatar}>{avatarLabel}</span>
                                <span className={styles.profileName}>{displayName}</span>
                            </button>
                            {profileOpen && (
                                <div className={styles.profileMenu}>
                                    <span className={styles.profileEmail}>{user.email}</span>
                                    <Link
                                        href="/documents"
                                        className={styles.profileMenuLink}
                                        onClick={() => {
                                            setProfileOpen(false);
                                            setMobileOpen(false);
                                        }}
                                    >
                                        My Documents
                                    </Link>
                                    <button
                                        type="button"
                                        className={styles.profileMenuButton}
                                        onClick={async () => {
                                            setProfileOpen(false);
                                            setMobileOpen(false);
                                            await logout();
                                        }}
                                    >
                                        Log out
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={styles.loginButton}
                            onClick={() => {
                                setMobileOpen(false);
                                openAuthModal('login');
                            }}
                        >
                            Log in
                        </button>
                    )}
                </div>
            </nav>
        </header>
    );
}
