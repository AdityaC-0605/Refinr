import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.brandBlock}>
                <span className={styles.brandLabel}>Refinr</span>
                <p className={styles.brandText}>
                    Editorial AI for clearer, more deliberate writing. Built for refinement, not disguise.
                </p>
            </div>
            <div className={styles.linkRow}>
                <Link href="/" className={styles.link}>Editor</Link>
                <Link href="/about" className={styles.link}>About</Link>
                <span className={styles.linkMeta}>Ethical by design</span>
            </div>
        </footer>
    );
}
