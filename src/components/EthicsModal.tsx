'use client';

import { useState, useEffect } from 'react';
import styles from './EthicsModal.module.css';

const STORAGE_KEY = 'refinr-ethics-acknowledged';

export default function EthicsModal() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const acknowledged = localStorage.getItem(STORAGE_KEY);
        if (!acknowledged) {
            setShow(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Ethics acknowledgment">
            <div className={styles.modal}>
                <div className={styles.badge}>
                    <span>🛡️</span>
                    Ethical AI Tool
                </div>

                <h2 className={styles.title}>
                    Write better, not &quot;undetectable&quot;
                </h2>
                <p className={styles.subtitle}>
                    Refinr is a writing assistant that improves readability and style.
                    It is <strong>not</strong> a tool for evading AI detection or for academic dishonesty.
                </p>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>✅ What this tool does</h3>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.doItem}`}>✓</span>
                            Improves sentence variety and natural flow
                        </li>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.doItem}`}>✓</span>
                            Reduces redundancy and filler words
                        </li>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.doItem}`}>✓</span>
                            Adjusts tone for your audience
                        </li>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.doItem}`}>✓</span>
                            Shows exactly what changed and why
                        </li>
                    </ul>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>🚫 What this tool does NOT do</h3>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.dontItem}`}>✕</span>
                            Bypass AI detection tools
                        </li>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.dontItem}`}>✕</span>
                            Help submit AI text as original academic work
                        </li>
                        <li className={styles.listItem}>
                            <span className={`${styles.listItemIcon} ${styles.dontItem}`}>✕</span>
                            Claim output is &quot;human-written&quot; or &quot;undetectable&quot;
                        </li>
                    </ul>
                </div>

                <hr className={styles.divider} />

                <div className={styles.footer}>
                    <p className={styles.footerNote}>
                        By continuing, you agree to use this tool responsibly and in compliance
                        with your institution or employer&apos;s policies.
                    </p>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={handleClose}
                        id="ethics-acknowledge-btn"
                    >
                        I understand →
                    </button>
                </div>
            </div>
        </div>
    );
}
