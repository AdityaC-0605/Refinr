'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { StoredDocument, StoredDocumentVersion } from '@/lib/documents';
import styles from './page.module.css';

interface DocumentsWorkspaceProps {
    documents: StoredDocument[];
}

interface HistoryResponse {
    document?: StoredDocument;
    versions?: StoredDocumentVersion[];
    error?: string;
}

function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export default function DocumentsWorkspace({ documents }: DocumentsWorkspaceProps) {
    const [historyDocument, setHistoryDocument] = useState<StoredDocument | null>(null);
    const [historyVersions, setHistoryVersions] = useState<StoredDocumentVersion[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const closeHistory = () => {
        setHistoryDocument(null);
        setHistoryVersions([]);
        setHistoryError(null);
        setHistoryLoading(false);
    };

    const handleOpenHistory = async (document: StoredDocument) => {
        setHistoryDocument(document);
        setHistoryVersions([]);
        setHistoryError(null);
        setHistoryLoading(true);

        try {
            const response = await fetch(`/api/documents/${document.id}/versions`);
            const payload = await response.json().catch(() => ({ error: 'Unable to load version history.' })) as HistoryResponse;

            if (!response.ok || !payload.versions) {
                throw new Error(payload.error || 'Unable to load version history.');
            }

            setHistoryDocument(payload.document ?? document);
            setHistoryVersions(payload.versions);
        } catch (error) {
            setHistoryError(error instanceof Error ? error.message : 'Unable to load version history.');
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <>
            <main className={styles.main}>
                <section className={styles.hero}>
                    <div>
                        <p className={styles.eyebrow}>Saved Workspace</p>
                        <h1 className={styles.title}>My Documents</h1>
                        <p className={styles.subtitle}>
                            Reopen saved drafts, jump back into the editor, and keep your refined versions organized in one place.
                        </p>
                    </div>
                    <Link href="/" className={styles.heroAction}>
                        Open editor
                    </Link>
                </section>

                {documents.length === 0 ? (
                    <section className={styles.emptyState}>
                        <div className={styles.emptyOrb} />
                        <h2>No saved drafts yet</h2>
                        <p>
                            Refine a piece of writing, then use the save button in the output panel to add it to this workspace.
                        </p>
                        <Link href="/" className={styles.emptyAction}>
                            Start with the editor
                        </Link>
                    </section>
                ) : (
                    <section className={styles.grid}>
                        {documents.map(document => (
                            <article key={document.id} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <span className={styles.presetBadge}>
                                        {document.preset === 'none' ? 'Manual' : document.preset.replace(/-/g, ' ')}
                                    </span>
                                    <span className={styles.timestamp}>Updated {formatTimestamp(document.updatedAt)}</span>
                                </div>
                                <h2 className={styles.cardTitle}>{document.title}</h2>
                                <p className={styles.cardPreview}>{document.outputText}</p>
                                <div className={styles.cardMeta}>
                                    <span>{document.tone}</span>
                                    <span>{document.intensity}</span>
                                    <span>{document.vocabLevel}</span>
                                </div>
                                <div className={styles.cardActions}>
                                    <div className={styles.actionGroup}>
                                        <Link href={`/?document=${document.id}`} className={styles.primaryAction}>
                                            Open in editor
                                        </Link>
                                        <button
                                            type="button"
                                            className={styles.historyButton}
                                            onClick={() => void handleOpenHistory(document)}
                                        >
                                            History
                                        </button>
                                    </div>
                                    <span className={styles.createdAt}>Created {formatTimestamp(document.createdAt)}</span>
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>

            {historyDocument && (
                <>
                    <button
                        type="button"
                        className={styles.historyBackdrop}
                        onClick={closeHistory}
                        aria-label="Close version history"
                    />
                    <aside className={styles.historyPanel} aria-label="Document version history">
                        <div className={styles.historyHeader}>
                            <div>
                                <p className={styles.historyEyebrow}>Version History</p>
                                <h2 className={styles.historyTitle}>{historyDocument.title}</h2>
                                <p className={styles.historySubtitle}>
                                    Versions are sorted newest first. Opening one loads it into the editor as a read-only preview.
                                </p>
                            </div>
                            <button
                                type="button"
                                className={styles.historyClose}
                                onClick={closeHistory}
                                aria-label="Close version history"
                            >
                                ✕
                            </button>
                        </div>

                        {historyLoading && (
                            <div className={styles.historyState}>
                                <p>Loading versions...</p>
                            </div>
                        )}

                        {!historyLoading && historyError && (
                            <div className={styles.historyState}>
                                <p>{historyError}</p>
                            </div>
                        )}

                        {!historyLoading && !historyError && historyVersions.length === 0 && (
                            <div className={styles.historyState}>
                                <p>No saved versions exist for this document yet.</p>
                            </div>
                        )}

                        {!historyLoading && !historyError && historyVersions.length > 0 && (
                            <div className={styles.historyList}>
                                {historyVersions.map(version => (
                                    <article key={version.id} className={styles.versionCard}>
                                        <div className={styles.versionMeta}>
                                            <span>Saved {formatTimestamp(version.createdAt)}</span>
                                            <span>{version.preset === 'none' ? 'manual' : version.preset.replace(/-/g, ' ')}</span>
                                        </div>
                                        <p className={styles.versionPreview}>{version.outputText}</p>
                                        <div className={styles.versionTags}>
                                            <span>{version.tone}</span>
                                            <span>{version.intensity}</span>
                                            <span>{version.vocabLevel}</span>
                                        </div>
                                        <Link
                                            href={`/?document=${historyDocument.id}&version=${version.id}`}
                                            className={styles.versionOpen}
                                        >
                                            Preview this version
                                        </Link>
                                    </article>
                                ))}
                            </div>
                        )}
                    </aside>
                </>
            )}
        </>
    );
}
