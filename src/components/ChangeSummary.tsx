'use client';

import styles from './ChangeSummary.module.css';

interface ChangeSummaryProps {
    changes: string[];
}

export default function ChangeSummary({ changes }: ChangeSummaryProps) {
    if (!changes || changes.length === 0) {
        return (
            <div className={styles.container}>
                <div className={styles.empty}>No changes recorded</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>📋 What changed</h3>
            <ul className={styles.list}>
                {changes.map((change, index) => (
                    <li key={index} className={styles.item}>
                        <span className={styles.itemIcon}>→</span>
                        {change}
                    </li>
                ))}
            </ul>
        </div>
    );
}
