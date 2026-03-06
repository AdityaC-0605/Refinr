'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    return (
        <header className={styles.header}>
            <Link href="/" className={styles.logo}>
                <span className={styles.logoIcon}>✦</span>
                <span className={styles.logoText}>
                    Refinr
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
                <div className={styles.ethicsBadge}>
                    <span>🛡️</span>
                    Ethical AI
                </div>
            </nav>
        </header>
    );
}
