'use client';

import { useState } from 'react';
import type { VoiceMatchScore } from '@/lib/voice-types';
import styles from './OutputPanel.module.css';

export type ViewMode = 'output' | 'diff';

interface OutputPanelProps {
    text: string;
    loading: boolean;
    error: string | null;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onUseAsInput: () => void;
    diffContent?: React.ReactNode;
    hasResult: boolean;
    showStreamingCursor?: boolean;
    onSaveDocument?: () => void;
    saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    onUndo?: () => void;
    canUndo?: boolean;
    readOnlyPreview?: boolean;
    outputContent?: React.ReactNode;
    showResultActions?: boolean;
    voiceMatchScore?: VoiceMatchScore | null;
}

export default function OutputPanel({
    text,
    loading,
    error,
    viewMode,
    onViewModeChange,
    onUseAsInput,
    diffContent,
    hasResult,
    showStreamingCursor = false,
    onSaveDocument,
    saveStatus = 'idle',
    onUndo,
    canUndo = false,
    readOnlyPreview = false,
    outputContent,
    showResultActions,
    voiceMatchScore,
}: OutputPanelProps) {
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);
    const [breakdownOpen, setBreakdownOpen] = useState(false);

    const handleCopy = async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Ignore errors if clipboard permissions are denied
        }
    };

    const handleDownload = () => {
        if (!text) return;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'refinr-output.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2000);
    };

    const saveLabel = saveStatus === 'saving'
        ? 'Saving...'
        : saveStatus === 'saved'
            ? '✓ Saved'
            : saveStatus === 'error'
                ? 'Retry save'
                : '💾 Save Document';
    const shouldShowActions = showResultActions ?? hasResult;

    return (
        <div className={styles.container}>
            <div className={styles.outputHeader}>
                <span className={styles.outputTitle}>📝 Output</span>
                <div className={styles.actions}>
                    {shouldShowActions && !loading && (
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
                            <button
                                type="button"
                                className={`${styles.secondaryBtn} ${downloaded ? styles.secondaryBtnSuccess : ''}`}
                                onClick={handleDownload}
                            >
                                {downloaded ? '✓ Downloaded' : '↓ Download'}
                            </button>
                            {onUndo && (
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={onUndo}
                                    disabled={!canUndo}
                                >
                                    ↶ Undo
                                </button>
                            )}
                            {!readOnlyPreview && (
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={onUseAsInput}
                                >
                                    ↺ Use as input
                                </button>
                            )}
                            {!readOnlyPreview && onSaveDocument && (
                                <button
                                    type="button"
                                    className={`${styles.secondaryBtn} ${saveStatus === 'saved' ? styles.secondaryBtnSuccess : ''}`}
                                    onClick={onSaveDocument}
                                    disabled={saveStatus === 'saving'}
                                >
                                    {saveLabel}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className={styles.outputBody}>
                {loading && !text && (
                    <div className={styles.loadingState}>
                        <div className={styles.loadingVisual}>
                            <div className={styles.loadingPulse} />
                            <div className={styles.loadingGrid}>
                                <span />
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>
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
                        <div className={styles.emptyVisual}>
                            <div className={styles.emptyOrb} />
                            <div className={styles.emptyCard}>
                                <span className={styles.emptyLineLong} />
                                <span className={styles.emptyLineShort} />
                                <span className={styles.emptyLineLong} />
                            </div>
                        </div>
                        <span className={styles.emptyTitle}>Your improved text will appear here</span>
                        <span className={styles.emptyDesc}>
                            Enter your text on the left, adjust the tone settings, and click &quot;Refine Text&quot; to get started.
                        </span>
                    </div>
                )}

                {((loading && text) || (!loading && !error && hasResult)) && (
                    <div className={styles.resultStage} key={`${viewMode}-${text.slice(0, 40)}`}>
                        {!loading && viewMode === 'diff' && diffContent
                            ? diffContent
                            : outputContent ?? (
                                <div className={styles.outputText}>
                                    {text}
                                    {showStreamingCursor && <span className={styles.streamingCursor} />}
                                </div>
                            )}
                    </div>
                )}
            </div>

            {shouldShowActions && !loading && (
                <div className={styles.ethicsTag}>
                    <span>🛡️</span>
                    AI-assisted edit — check your institution or employer&apos;s disclosure policies.
                </div>
            )}

            {/* Voice Match Badge */}
            {voiceMatchScore && shouldShowActions && !loading && (
                <div className={styles.voiceMatchSection}>
                    <button
                        type="button"
                        className={`${styles.voiceMatchBadge} ${voiceMatchScore.score >= 85 ? styles.voiceMatchHigh
                            : voiceMatchScore.score >= 60 ? styles.voiceMatchMid
                                : styles.voiceMatchLow
                            }`}
                        onClick={() => setBreakdownOpen(!breakdownOpen)}
                    >
                        <span className={styles.voiceMatchIcon}>🧬</span>
                        <span className={styles.voiceMatchLabel}>Voice Match</span>
                        <span className={styles.voiceMatchValue}>{voiceMatchScore.score}%</span>
                        <span className={styles.voiceMatchQuality}>
                            {voiceMatchScore.score >= 85 ? 'Strong match ✓'
                                : voiceMatchScore.score >= 60 ? 'Good match'
                                    : 'Partial match'}
                        </span>
                    </button>

                    {breakdownOpen && (
                        <div className={styles.voiceBreakdown}>
                            {voiceMatchScore.breakdown.map(item => (
                                <div key={item.metric} className={styles.voiceBreakdownRow}>
                                    <span className={styles.voiceBreakdownMetric}>{item.metric}</span>
                                    <div className={styles.voiceBreakdownTrack}>
                                        <div
                                            className={styles.voiceBreakdownFill}
                                            style={{ width: `${item.score}%` }}
                                        />
                                    </div>
                                    <span className={styles.voiceBreakdownValue}>{item.score}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
