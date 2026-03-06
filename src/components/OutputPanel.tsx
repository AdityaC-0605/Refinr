'use client';

import { useState } from 'react';
import styles from './OutputPanel.module.css';

export type ViewMode = 'output' | 'diff';

interface OutputPanelProps {
    text: string;
    loading: boolean;
    error: string | null;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    diffContent?: React.ReactNode;
    hasResult: boolean;
}

export default function OutputPanel({
    text,
    loading,
    error,
    viewMode,
    onViewModeChange,
    diffContent,
    hasResult,
}: OutputPanelProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.outputHeader}>
                <span className={styles.outputTitle}>📝 Output</span>
                <div className={styles.actions}>
                    {hasResult && (
                        <>
                            <div className={styles.viewToggle}>
                                <button
                                    type="button"
                                    className={`${styles.viewBtn} ${viewMode === 'output' ? styles.viewBtnActive : ''}`}
                                    onClick={() => onViewModeChange('output')}
                                >
                                    Result
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.viewBtn} ${viewMode === 'diff' ? styles.viewBtnActive : ''}`}
                                    onClick={() => onViewModeChange('diff')}
                                >
                                    Diff
                                </button>
                            </div>
                            <button
                                type="button"
                                className={`${styles.copyBtn} ${copied ? styles.copySuccess : ''}`}
                                onClick={handleCopy}
                                id="copy-btn"
                            >
                                {copied ? '✓ Copied' : '📋 Copy'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className={styles.outputBody}>
                {loading && (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingPulse} />
                        <span className={styles.loadingText}>Improving your text...</span>
                    </div>
                )}

                {error && !loading && (
                    <div className={styles.errorState}>
                        <span className={styles.errorIcon}>⚠️</span>
                        <span className={styles.errorTitle}>Something went wrong</span>
                        <span className={styles.errorDesc}>{error}</span>
                    </div>
                )}

                {!loading && !error && !hasResult && (
                    <div className={styles.emptyState}>
                        <span className={styles.emptyIcon}>✨</span>
                        <span className={styles.emptyTitle}>Your improved text will appear here</span>
                        <span className={styles.emptyDesc}>
                            Enter your text on the left, adjust the tone settings, and click &quot;Refine Text&quot; to get started.
                        </span>
                    </div>
                )}

                {!loading && !error && hasResult && (
                    viewMode === 'diff' && diffContent
                        ? diffContent
                        : <div className={styles.outputText}>{text}</div>
                )}
            </div>

            {hasResult && !loading && (
                <div className={styles.ethicsTag}>
                    <span>🛡️</span>
                    AI-assisted edit — check your institution or employer&apos;s disclosure policies.
                </div>
            )}
        </div>
    );
}
