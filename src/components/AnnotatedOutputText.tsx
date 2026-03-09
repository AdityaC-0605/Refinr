'use client';

import { useMemo } from 'react';
import { buildAnnotatedTextSegments, type GrammarIssue, type ToneIssue } from '@/lib/output-checks';
import styles from './AnnotatedOutputText.module.css';

interface AnnotatedOutputTextProps {
    text: string;
    grammarIssues: GrammarIssue[];
    toneIssues: ToneIssue[];
}

export default function AnnotatedOutputText({
    text,
    grammarIssues,
    toneIssues,
}: AnnotatedOutputTextProps) {
    const segments = useMemo(
        () => buildAnnotatedTextSegments(text, grammarIssues, toneIssues),
        [grammarIssues, text, toneIssues]
    );

    if (!text) {
        return null;
    }

    return (
        <div className={styles.text}>
            {segments.length === 0
                ? text
                : segments.map((segment, index) => (
                    <span
                        key={`${index}-${segment.text.length}`}
                        className={[
                            segment.grammarIssueType ? styles[`grammar${segment.grammarIssueType[0].toUpperCase()}${segment.grammarIssueType.slice(1)}`] : '',
                            segment.toneSeverity ? styles[`tone${segment.toneSeverity[0].toUpperCase()}${segment.toneSeverity.slice(1)}`] : '',
                        ].filter(Boolean).join(' ')}
                    >
                        {segment.text}
                    </span>
                ))}
        </div>
    );
}
