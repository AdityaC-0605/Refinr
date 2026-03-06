'use client';

import { diffWords } from 'diff';
import styles from './DiffView.module.css';

interface DiffViewProps {
    original: string;
    edited: string;
}

export default function DiffView({ original, edited }: DiffViewProps) {
    if (!original || !edited) {
        return <div className={styles.noDiff}>No changes to display</div>;
    }

    const changes = diffWords(original, edited);

    if (changes.length === 1 && !changes[0].added && !changes[0].removed) {
        return <div className={styles.noDiff}>No changes were made</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.diffHeader}>
                <div className={styles.diffLegendItem}>
                    <span className={`${styles.legendDot} ${styles.legendDotAdded}`} />
                    Added
                </div>
                <div className={styles.diffLegendItem}>
                    <span className={`${styles.legendDot} ${styles.legendDotRemoved}`} />
                    Removed
                </div>
            </div>
            <div>
                {changes.map((part, index) => {
                    let className = styles.unchanged;
                    if (part.added) className = styles.added;
                    else if (part.removed) className = styles.removed;

                    return (
                        <span key={index} className={className}>
                            {part.value}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
