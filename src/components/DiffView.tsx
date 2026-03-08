'use client';

import { useMemo, useState } from 'react';
import type { ChangeExplanation } from '@/lib/humanize';
import {
    buildReviewDiffClusters,
    type ChangeDecision,
} from '@/lib/diff-review';
import styles from './DiffView.module.css';

interface DiffViewProps {
    original: string;
    edited: string;
    explanations?: ChangeExplanation[];
    showExplanations?: boolean;
    reviewDecisions?: Partial<Record<number, ChangeDecision>>;
    onReviewDecision?: (changeId: number, decision: ChangeDecision | 'pending') => void;
}

export default function DiffView({
    original,
    edited,
    explanations = [],
    showExplanations = false,
    reviewDecisions = {},
    onReviewDecision,
}: DiffViewProps) {
    const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null);

    const clusters = useMemo(
        () => buildReviewDiffClusters(original, edited, explanations, showExplanations),
        [edited, explanations, original, showExplanations]
    );

    if (!original || !edited) {
        return <div className={styles.noDiff}>No changes to display</div>;
    }

    if (clusters.length === 1 && clusters[0]?.type === 'unchanged') {
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
                {showExplanations && explanations.length > 0 && (
                    <div className={styles.diffLegendItem}>
                        <span className={`${styles.legendDot} ${styles.legendDotInfo}`} />
                        Explanations
                    </div>
                )}
            </div>
            <div className={styles.diffBody}>
                {clusters.map((cluster, index) => {
                    if (cluster.type === 'unchanged') {
                        return (
                            <span key={`unchanged-${index}`} className={styles.unchanged}>
                                {cluster.text}
                            </span>
                        );
                    }

                    const tooltipOpen = openTooltipIndex === index;
                    const decision = reviewDecisions[cluster.id];

                    return (
                        <span
                            key={`change-${index}`}
                            className={`${styles.changeGroup} ${
                                decision === 'accepted'
                                    ? styles.changeGroupAccepted
                                    : decision === 'rejected'
                                        ? styles.changeGroupRejected
                                        : ''
                            }`}
                            onMouseLeave={() => setOpenTooltipIndex(current => current === index ? null : current)}
                        >
                            {cluster.removed && (
                                <span className={styles.removed}>{cluster.removed}</span>
                            )}
                            {cluster.added && (
                                <span className={styles.added}>{cluster.added}</span>
                            )}
                            {showExplanations && cluster.explanation && (
                                <span className={styles.explanationWrap}>
                                    <button
                                        type="button"
                                        className={styles.explanationButton}
                                        aria-label="Show explanation"
                                        aria-expanded={tooltipOpen}
                                        onMouseEnter={() => setOpenTooltipIndex(index)}
                                        onFocus={() => setOpenTooltipIndex(index)}
                                        onClick={() => setOpenTooltipIndex(current => current === index ? null : index)}
                                    >
                                        ⓘ
                                    </button>
                                    {tooltipOpen && (
                                        <span className={styles.tooltip} role="tooltip">
                                            {cluster.explanation.reason}
                                        </span>
                                    )}
                                </span>
                            )}
                            {onReviewDecision && (
                                <span className={styles.reviewActions}>
                                    <button
                                        type="button"
                                        className={`${styles.reviewButton} ${
                                            decision === 'accepted' ? styles.reviewButtonActive : ''
                                        }`}
                                        onClick={() => onReviewDecision(cluster.id, decision === 'accepted' ? 'pending' : 'accepted')}
                                    >
                                        Keep
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.reviewButton} ${
                                            decision === 'rejected' ? styles.reviewButtonDanger : ''
                                        }`}
                                        onClick={() => onReviewDecision(cluster.id, decision === 'rejected' ? 'pending' : 'rejected')}
                                    >
                                        Revert
                                    </button>
                                </span>
                            )}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
