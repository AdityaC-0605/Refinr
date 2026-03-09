'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    applyAllGrammarSuggestions,
    applyGrammarSuggestion,
    type GrammarIssue,
} from '@/lib/output-checks';
import styles from './GrammarChecker.module.css';

interface GrammarCheckerProps {
    text: string;
    readOnly?: boolean;
    onTextChange: (text: string) => void;
    onIssuesChange?: (issues: GrammarIssue[]) => void;
}

interface GrammarApiResponse {
    matches?: GrammarIssue[];
    unavailable?: boolean;
}

function getIssueLabel(issue: GrammarIssue): string {
    if (issue.issueType === 'spelling') {
        return 'Spelling';
    }

    if (issue.issueType === 'style') {
        return 'Style';
    }

    return 'Grammar';
}

function buildSnippet(text: string, issue: GrammarIssue): {
    before: string;
    target: string;
    after: string;
} {
    const contextStart = Math.max(0, issue.offset - 28);
    const contextEnd = Math.min(text.length, issue.offset + issue.length + 28);

    return {
        before: text.slice(contextStart, issue.offset),
        target: text.slice(issue.offset, issue.offset + issue.length),
        after: text.slice(issue.offset + issue.length, contextEnd),
    };
}

export default function GrammarChecker({
    text,
    readOnly = false,
    onTextChange,
    onIssuesChange,
}: GrammarCheckerProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [issues, setIssues] = useState<GrammarIssue[]>([]);
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(max-width: 768px)').matches) {
            setCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (!text.trim()) {
            setIssues([]);
            setDismissedIds([]);
            setUnavailable(false);
            onIssuesChange?.([]);
            return;
        }

        let cancelled = false;
        setDismissedIds([]);

        void (async () => {
            try {
                const response = await fetch('/api/grammar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text }),
                });

                const payload = await response.json().catch(() => ({ matches: [], unavailable: true })) as GrammarApiResponse;

                if (cancelled) {
                    return;
                }

                const nextIssues = Array.isArray(payload.matches) ? payload.matches : [];
                setIssues(nextIssues);
                setUnavailable(Boolean(payload.unavailable));
                onIssuesChange?.(payload.unavailable ? [] : nextIssues);
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
    }, [onIssuesChange, text]);

    const visibleIssues = useMemo(
        () => issues.filter(issue => !dismissedIds.includes(issue.id)),
        [dismissedIds, issues]
    );

    useEffect(() => {
        onIssuesChange?.(unavailable ? [] : visibleIssues);
    }, [onIssuesChange, unavailable, visibleIssues]);

    const handleDismiss = (issueId: string) => {
        setDismissedIds(current => [...current, issueId]);
    };

    const handleApplyFix = (issue: GrammarIssue) => {
        const replacement = issue.replacements[0];

        if (!replacement) {
            return;
        }

        onTextChange(applyGrammarSuggestion(text, issue, replacement));
    };

    const handleFixAll = () => {
        const applicableIssues = visibleIssues.filter(issue => issue.replacements[0]);

        if (applicableIssues.length === 0) {
            return;
        }

        onTextChange(applyAllGrammarSuggestions(text, applicableIssues));
    };

    const issueCountLabel = visibleIssues.length === 1 ? '1 issue found' : `${visibleIssues.length} issues found`;

    return (
        <section className={styles.panel}>
            <button
                type="button"
                className={styles.header}
                onClick={() => setCollapsed(current => !current)}
                aria-expanded={!collapsed}
            >
                <span className={styles.title}>Grammar Check</span>
                <span className={unavailable ? styles.badgeMuted : visibleIssues.length > 0 ? styles.badgeWarning : styles.badgeSuccess}>
                    {unavailable ? 'Unavailable' : visibleIssues.length > 0 ? issueCountLabel : 'No issues'}
                </span>
            </button>

            {!collapsed && (
                <div className={styles.body}>
                    {unavailable ? (
                        <p className={styles.mutedMessage}>Grammar check unavailable</p>
                    ) : visibleIssues.length === 0 ? (
                        <p className={styles.mutedMessage}>No obvious grammar or spelling issues were found.</p>
                    ) : (
                        <>
                            {!readOnly && (
                                <div className={styles.toolbar}>
                                    <button
                                        type="button"
                                        className={styles.toolbarButton}
                                        onClick={handleFixAll}
                                    >
                                        Fix All
                                    </button>
                                </div>
                            )}
                            <div className={styles.issueList}>
                                {visibleIssues.map(issue => {
                                    const snippet = buildSnippet(text, issue);

                                    return (
                                        <article key={issue.id} className={styles.issueCard}>
                                            <div className={styles.issueHeader}>
                                                <span className={`${styles.issueTag} ${
                                                    issue.issueType === 'spelling'
                                                        ? styles.issueTagSpelling
                                                        : issue.issueType === 'style'
                                                            ? styles.issueTagStyle
                                                            : styles.issueTagGrammar
                                                }`}>
                                                    {getIssueLabel(issue)}
                                                </span>
                                                {!readOnly && (
                                                    <div className={styles.issueActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.issueButton}
                                                            onClick={() => handleApplyFix(issue)}
                                                            disabled={!issue.replacements[0]}
                                                        >
                                                            Apply Fix
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.issueButton}
                                                            onClick={() => handleDismiss(issue.id)}
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <p className={styles.snippet}>
                                                {snippet.before}
                                                <span className={`${styles.snippetHighlight} ${
                                                    issue.issueType === 'spelling'
                                                        ? styles.snippetHighlightSpelling
                                                        : issue.issueType === 'style'
                                                            ? styles.snippetHighlightStyle
                                                            : styles.snippetHighlightGrammar
                                                }`}>
                                                    {snippet.target}
                                                </span>
                                                {snippet.after}
                                            </p>
                                            <p className={styles.message}>{issue.message}</p>
                                            {issue.replacements[0] && (
                                                <p className={styles.suggestion}>
                                                    Suggested fix: <strong>{issue.replacements[0]}</strong>
                                                </p>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
