'use client';

import {
    calculateReadability,
    getReadabilityLabel,
    getReadabilityColor,
    ReadabilityResult,
} from '@/lib/readability';
import styles from './ReadabilityScore.module.css';

interface ReadabilityScoreProps {
    originalText: string;
    editedText: string;
}

function ScoreCard({
    label,
    result,
    comparison,
}: {
    label: string;
    result: ReadabilityResult;
    comparison?: ReadabilityResult;
}) {
    const color = getReadabilityColor(result.fleschKincaid);
    const readabilityLabel = getReadabilityLabel(result.fleschKincaid);

    const diff = comparison
        ? result.fleschKincaid - comparison.fleschKincaid
        : null;

    return (
        <div className={styles.scoreCard}>
            <span className={styles.scoreLabel}>{label}</span>
            <span className={styles.scoreValue} style={{ color }}>
                {result.fleschKincaid}
            </span>
            <span className={styles.scoreDesc}>{readabilityLabel} · Grade {result.gradeLevel}</span>
            {diff !== null && diff !== 0 && (
                <span
                    className={`${styles.improvement} ${diff > 0
                            ? styles.improvementPositive
                            : diff < 0
                                ? styles.improvementNegative
                                : styles.improvementNeutral
                        }`}
                >
                    {diff > 0 ? '↑' : '↓'} {Math.abs(Math.round(diff * 10) / 10)} pts
                </span>
            )}
        </div>
    );
}

export default function ReadabilityScore({
    originalText,
    editedText,
}: ReadabilityScoreProps) {
    const originalScore = calculateReadability(originalText);
    const editedScore = calculateReadability(editedText);

    return (
        <div>
            <div className={styles.container}>
                <ScoreCard label="Before" result={originalScore} />
                <ScoreCard label="After" result={editedScore} comparison={originalScore} />
            </div>
            <p className={styles.contextNote}>
                Readability is audience-dependent. Higher scores usually mean easier reading, but formal or academic writing may intentionally score lower.
            </p>
            <div className={styles.statsRow}>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Sentences</span>
                    <span className={styles.statValue}>
                        {originalScore.sentenceCount} → {editedScore.sentenceCount}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Avg Words/Sent</span>
                    <span className={styles.statValue}>
                        {originalScore.avgWordsPerSentence} → {editedScore.avgWordsPerSentence}
                    </span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statLabel}>Words</span>
                    <span className={styles.statValue}>
                        {originalScore.wordCount} → {editedScore.wordCount}
                    </span>
                </div>
            </div>
        </div>
    );
}
