import Link from 'next/link';
import LogoMark from './LogoMark';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.gradientSeparator} />
            <div className={styles.footerInner}>
                <div className={styles.brandBlock}>
                    <Link href="/" className={styles.brandLogo}>
                        <span className={styles.brandLogoIcon}>
                            <LogoMark className={styles.brandLogoMark} />
                        </span>
                        <span className={styles.brandLabel}>Refinr</span>
                    </Link>
                    <p className={styles.brandText}>
                        Editorial AI for clearer, more deliberate writing.
                        Built for refinement, not disguise.
                    </p>
                </div>
                <div className={styles.footerColumns}>
                    <div className={styles.footerColumn}>
                        <h4 className={styles.footerColumnTitle}>Product</h4>
                        <Link href="/" className={styles.link}>Editor</Link>
                        <Link href="/about" className={styles.link}>About</Link>
                        <Link href="/voice" className={styles.link}>Voice DNA</Link>
                    </div>
                    <div className={styles.footerColumn}>
                        <h4 className={styles.footerColumnTitle}>Resources</h4>
                        <Link href="/documents" className={styles.link}>My Documents</Link>
                        <Link href="/about#principles" className={styles.link}>Ethics</Link>
                    </div>
                </div>
            </div>
            <div className={styles.footerBottom}>
                <span className={styles.copyright}>
                    © {new Date().getFullYear()} Refinr. Ethical by design.
                </span>
                <span className={styles.footerBadge}>
                    <span className={styles.footerBadgeDot} />
                    Powered by Gemini
                </span>
            </div>
        </footer>
    );
}
