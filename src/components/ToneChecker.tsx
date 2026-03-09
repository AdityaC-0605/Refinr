'use client';

import { useEffect, useMemo, useState } from 'react';
import { streamRefinementRequest } from '@/lib/refine-stream';
import {
    mapToneFindingsToIssues,
    type ToneCheckFinding,
    type ToneIssue,
} from '@/lib/output-checks';
import type { HumanizeSettings, RewritePreset, Tone } from '@/lib/prompt';
import styles from './ToneChecker.module.css';

interface ToneCheckerProps {
    text: string;
    targetTone: Tone;
    settings: HumanizeSettings;
    preset: RewritePreset;
    readOnly?: boolean;
    onTextChange: (text: string) => void;
    onIssuesChange?: (issues: ToneIssue[]) => void;
}

interface ToneCheckResponse {
    inconsistencies?: ToneCheckFinding[];
    unavailable?: boolean;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        window.setTimeout(resolve, ms);
    });
}

function replaceRange(text: string, offset: number, length: number, replacement: string): string {
    return `${text.slice(0, offset)}${replacement}${text.slice(offset + length)}`;
}

export default function ToneChecker({
    text,
    targetTone,
    settings,
    preset,
    readOnly = false,
    onTextChange,
    onIssuesChange,
}: ToneCheckerProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [issues, setIssues] = useState<ToneIssue[]>([]);
    const [unavailable, setUnavailable] = useState(false);
    const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [processingIssueId, setProcessingIssueId] = useState<string | null>(null);
    const [streamPreview, setStreamPreview] = useState('');

    useEffect(() => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            setCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (!text.trim()) {
            setIssues([]);
            setUnavailable(false);
            onIssuesChange?.([]);
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                const response = await fetch('/api/tone-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        targetTone,
                    }),
                });

                const payload = await response.json().catch(() => ({ inconsistencies: [], unavailable: true })) as ToneCheckResponse;

                if (cancelled) {
                    return;
                }

                if (payload.unavailable) {
                    setIssues([]);
                    setUnavailable(true);
                    onIssuesChange?.([]);
                    return;
                }

                const findings = Array.isArray(payload.inconsistencies) ? payload.inconsistencies : [];
                const nextIssues = mapToneFindingsToIssues(text, findings);
                setIssues(nextIssues);
                setUnavailable(false);
                onIssuesChange?.(nextIssues);
            } catch {
                if (!cancelled) {
                    setIssues([]);
                    setUnavailable(true);
                    onIssuesChange?.([]);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [onIssuesChange, targetTone, text]);

    const summaryLabel = useMemo(() => {
        if (issues.length === 0) {
            return 'Tone looks consistent ✓';
        }

        return issues.length === 1 ? '1 inconsistency' : `${issues.length} inconsistencies`;
    }, [issues.length]);

    const refineSentence = async (issue: ToneIssue): Promise<string> => {
        setProcessing(true);
        setProcessingIssueId(issue.id);
        setStreamPreview('');

        try {
            const payload = await streamRefinementRequest({
                text: issue.sentence,
                settings,
                preset,
                onChunk: chunk => {
                    setStreamPreview(current => current + chunk);
                },
            });

            return payload.edited_text;
        } finally {
            setProcessing(false);
            setProcessingIssueId(null);
            setStreamPreview('');
        }
    };

    const handleRefineIssue = async (issue: ToneIssue) => {
        const replacement = await refineSentence(issue);
        onTextChange(replaceRange(text, issue.offset, issue.length, replacement));
    };

    const handleRefineAll = async () => {
        if (issues.length === 0) {
            return;
        }

        const sortedIssues = [...issues].sort((left, right) => right.offset - left.offset);
        let nextText = text;

        for (let index = 0; index < sortedIssues.length; index += 1) {
            const issue = sortedIssues[index];
            const replacement = await refineSentence(issue);
            nextText = replaceRange(nextText, issue.offset, issue.length, replacement);

            if (index < sortedIssues.length - 1) {
                await delay(200);
            }
        }

        onTextChange(nextText);
    };

    if (unavailable) {
        return null;
    }

    return (
        <section className={styles.panel}>
            <button
                type="button"
                className={styles.header}
                onClick={() => setCollapsed(current => !current)}
                aria-expanded={!collapsed}
            >
                <span className={styles.title}>Tone Consistency</span>
                <span className={issues.length > 0 ? styles.badgeWarning : styles.badgeSuccess}>
                    {summaryLabel}
                </span>
            </button>

            {!collapsed && (
                <div className={styles.body}>
                    {issues.length === 0 ? (
                        <p className={styles.mutedMessage}>The refined draft stays consistent with the selected tone.</p>
                    ) : (
                        <>
                            {!readOnly && (
                                <div className={styles.toolbar}>
                                    <button
                                        type="button"
                                        className={styles.toolbarButton}
                                        onClick={() => void handleRefineAll()}
                                        disabled={processing}
                                    >
                                        {processing ? 'Refining...' : 'Re-refine All Flagged'}
                                    </button>
                                </div>
                            )}
                            <div className={styles.issueList}>
                                {issues.map(issue => (
                                    <article
                                        key={issue.id}
                                        className={`${styles.issueCard} ${
                                            issue.severity === 'strong' ? styles.issueCardStrong : styles.issueCardMild
                                        }`}
                                    >
                                        <div className={styles.issueHeader}>
                                            <div className={styles.issueMeta}>
                                                <span className={`${styles.severityDot} ${
                                                    issue.severity === 'strong' ? styles.severityDotStrong : styles.severityDotMild
                                                }`} />
                                                <span className={styles.severityLabel}>{issue.severity}</span>
                                                <span
                                                    className={styles.whyWrap}
                                                    onMouseLeave={() => setOpenTooltipId(current => current === issue.id ? null : current)}
                                                >
                                                    <button
                                                        type="button"
                                                        className={styles.whyButton}
                                                        onMouseEnter={() => setOpenTooltipId(issue.id)}
                                                        onFocus={() => setOpenTooltipId(issue.id)}
                                                        onClick={() => setOpenTooltipId(current => current === issue.id ? null : issue.id)}
                                                    >
                                                        why
                                                    </button>
                                                    {openTooltipId === issue.id && (
                                                        <span className={styles.tooltip}>{issue.reason}</span>
                                                    )}
                                                </span>
                                            </div>
                                            {!readOnly && (
                                                <button
                                                    type="button"
                                                    className={styles.issueButton}
                                                    onClick={() => void handleRefineIssue(issue)}
                                                    disabled={processing}
                                                >
                                                    {processing && processingIssueId === issue.id ? 'Refining...' : 'Re-refine this sentence'}
                                                </button>
                                            )}
                                        </div>
                                        <p className={styles.sentence}>{issue.sentence}</p>
                                        {processingIssueId === issue.id && streamPreview && (
                                            <p className={styles.preview}>{streamPreview}</p>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
