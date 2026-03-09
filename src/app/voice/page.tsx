'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import type { VoiceDNAProfile } from '@/lib/voice-types';
import { countWords } from '@/lib/sanitize';
import styles from './page.module.css';

interface WritingSample {
    id: string;
    label: string;
    text: string;
    wordCount: number;
}

interface AnalyzeResponse {
    profile?: VoiceDNAProfile;
    error?: string;
}

interface ProfileStatusResponse {
    profile?: VoiceDNAProfile;
}

const MIN_WORDS_PER_SAMPLE = 100;
const MIN_SAMPLES = 2;
const MAX_SAMPLES = 5;

function DnaHelixIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 15c6.667-6 13.333 0 20-6" />
            <path d="M2 9c6.667 6 13.333 0 20 6" />
            <path d="M7 12h10" />
            <path d="M5 7h14" />
            <path d="M5 17h14" />
        </svg>
    );
}

function computeFingerprintValues(profile: VoiceDNAProfile): { label: string; value: number }[] {
    const s = profile.statistical;

    const sentenceComplexity = Math.min(100, Math.round((s.avgSentenceLength / 30) * 100));
    const vocabRichness = Math.min(100, Math.round(s.vocabularyRichness * 100));
    const formality = Math.min(100, Math.round(s.averageSyllablesPerWord / 2.5 * 100));
    const rhythmVariance = Math.min(100, Math.round((s.sentenceLengthVariance / 15) * 100));
    const activeVoice = Math.min(100, Math.round((1 - s.passiveVoiceRatio) * 100));

    return [
        { label: 'Sentence Complexity', value: sentenceComplexity },
        { label: 'Vocabulary Richness', value: vocabRichness },
        { label: 'Formality', value: formality },
        { label: 'Rhythm Variance', value: rhythmVariance },
        { label: 'Active Voice', value: activeVoice },
    ];
}

let nextSampleId = 1;

export default function VoiceDNAPage() {
    const { user, authReady, openAuthModal } = useAuth();
    const router = useRouter();

    const [samples, setSamples] = useState<WritingSample[]>([]);
    const [pasteMode, setPasteMode] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<VoiceDNAProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Redirect unauthenticated users
    useEffect(() => {
        if (authReady && !user) {
            openAuthModal('login');
            router.push('/');
        }
    }, [authReady, openAuthModal, router, user]);

    // Load existing profile
    const fetchProfile = useCallback(async () => {
        try {
            const response = await fetch('/api/voice/profile');

            if (!response.ok) {
                setProfile(null);
                return;
            }

            const data = await response.json() as ProfileStatusResponse;
            setProfile(data.profile ?? null);
        } catch {
            setProfile(null);
        } finally {
            setLoadingProfile(false);
        }
    }, []);

    useEffect(() => {
        if (authReady && user) {
            void fetchProfile();
        } else {
            setLoadingProfile(false);
        }
    }, [authReady, fetchProfile, user]);

    const addSample = (label: string, text: string) => {
        if (samples.length >= MAX_SAMPLES) {
            setError(`Maximum ${MAX_SAMPLES} samples allowed.`);
            return;
        }

        const wordCount = countWords(text);

        setSamples(prev => [
            ...prev,
            {
                id: `sample-${nextSampleId++}`,
                label,
                text,
                wordCount,
            },
        ]);
        setError(null);
    };

    const removeSample = (id: string) => {
        setSamples(prev => prev.filter(s => s.id !== id));
    };

    const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragOver(false);

        const files = Array.from(event.dataTransfer.files);

        for (const file of files) {
            if (!file.name.endsWith('.txt')) {
                continue;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const content = typeof reader.result === 'string' ? reader.result : '';

                if (content.trim()) {
                    addSample(file.name, content.trim());
                }
            };
            reader.readAsText(file);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);

        for (const file of files) {
            const reader = new FileReader();
            reader.onload = () => {
                const content = typeof reader.result === 'string' ? reader.result : '';

                if (content.trim()) {
                    addSample(file.name, content.trim());
                }
            };
            reader.readAsText(file);
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAddPaste = () => {
        const trimmed = pasteText.trim();

        if (!trimmed) {
            return;
        }

        addSample(`Pasted sample ${samples.length + 1}`, trimmed);
        setPasteText('');
    };

    const validSamples = samples.filter(s => s.wordCount >= MIN_WORDS_PER_SAMPLE);
    const canAnalyze = validSamples.length >= MIN_SAMPLES && !analyzing;

    const handleAnalyze = async () => {
        if (!canAnalyze) return;

        setAnalyzing(true);
        setError(null);

        try {
            const response = await fetch('/api/voice/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    samples: validSamples.map(s => s.text),
                }),
            });

            const data = await response.json() as AnalyzeResponse;

            if (!response.ok || !data.profile) {
                setError(data.error || 'Failed to analyze writing samples. Please try again.');
                return;
            }

            setProfile(data.profile);
            setSamples([]);
        } catch {
            setError('Failed to analyze writing samples. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDelete = async () => {
        try {
            await fetch('/api/voice/profile', { method: 'DELETE' });
            setProfile(null);
        } catch {
            setError('Failed to delete profile.');
        }
    };

    const handleReanalyze = () => {
        setProfile(null);
    };

    if (!authReady || !user) {
        return null;
    }

    return (
        <>
            <Header />
            <main className={styles.voicePage}>
                <h1 className={styles.pageTitle}>
                    <DnaHelixIcon className={styles.dnaIcon} />
                    Your Voice DNA
                </h1>
                <p className={styles.pageSubtext}>
                    Upload 2–5 samples of your own writing. Refinr will learn your unique style
                    and refine future text to sound like you — not like AI.
                </p>

                {error && <div className={styles.errorMessage}>{error}</div>}

                {/* ── Profile Display ── */}
                {profile && !analyzing && (
                    <div className={styles.profileSection}>
                        <h2 className={styles.profileSectionTitle}>Your Voice Profile</h2>

                        <div className={styles.dnaCard}>
                            {/* Personality tags */}
                            {profile.qualitative && (
                                <div className={styles.personalityTags}>
                                    {profile.qualitative.writingPersonality.map(trait => (
                                        <span key={trait} className={styles.personalityTag}>{trait}</span>
                                    ))}
                                </div>
                            )}

                            {/* Tone description */}
                            {profile.qualitative && (
                                <p className={styles.toneDesc}>{profile.qualitative.toneDescription}</p>
                            )}

                            {/* Stats grid */}
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>
                                        {profile.statistical.avgSentenceLength.toFixed(1)}
                                    </span>
                                    <span className={styles.statLabel}>Avg Sentence Length</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>
                                        {(profile.statistical.vocabularyRichness * 100).toFixed(0)}%
                                    </span>
                                    <span className={styles.statLabel}>Vocabulary Richness</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>
                                        {(profile.statistical.passiveVoiceRatio * 100).toFixed(0)}%
                                    </span>
                                    <span className={styles.statLabel}>Passive Voice</span>
                                </div>
                            </div>

                            {/* Distinctive habits */}
                            {profile.qualitative && profile.qualitative.distinctiveHabits.length > 0 && (
                                <ul className={styles.habitsList}>
                                    {profile.qualitative.distinctiveHabits.map((habit, i) => (
                                        <li key={i}>{habit}</li>
                                    ))}
                                </ul>
                            )}

                            {/* Example phrases */}
                            {profile.qualitative && profile.qualitative.examplePhrases.length > 0 && (
                                <div className={styles.exampleBlock}>
                                    {profile.qualitative.examplePhrases.map((phrase, i) => (
                                        <div key={i}>&ldquo;{phrase}&rdquo;</div>
                                    ))}
                                </div>
                            )}

                            {/* Avoided patterns */}
                            {profile.qualitative && profile.qualitative.avoidPatterns.length > 0 && (
                                <div className={styles.avoidTags}>
                                    {profile.qualitative.avoidPatterns.map((pattern, i) => (
                                        <span key={i} className={styles.avoidTag}>{pattern}</span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Voice Fingerprint bars */}
                        <div className={styles.fingerprintSection}>
                            <h3 className={styles.fingerprintTitle}>Voice Fingerprint</h3>
                            {computeFingerprintValues(profile).map(bar => (
                                <div key={bar.label} className={styles.fingerprintBar}>
                                    <span className={styles.fingerprintLabel}>{bar.label}</span>
                                    <div className={styles.fingerprintTrack}>
                                        <div
                                            className={styles.fingerprintFill}
                                            style={{ width: `${Math.min(100, bar.value)}%` }}
                                        />
                                    </div>
                                    <span className={styles.fingerprintValue}>{bar.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className={styles.profileActions}>
                            <button
                                type="button"
                                className={styles.profileActionBtn}
                                onClick={handleReanalyze}
                            >
                                Re-analyze
                            </button>
                            <button
                                type="button"
                                className={`${styles.profileActionBtn} ${styles.profileActionBtnDanger}`}
                                onClick={() => void handleDelete()}
                            >
                                Delete Profile
                            </button>
                        </div>

                        <p className={styles.profileTimestamp}>
                            Last analyzed: {new Date(profile.updatedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </p>
                    </div>
                )}

                {/* ── Upload UI (show when no profile or re-analyzing) ── */}
                {(!profile || analyzing) && !loadingProfile && (
                    <>
                        {/* Upload zone */}
                        <div
                            className={`${styles.uploadZone} ${dragOver ? styles.uploadZoneDragOver : ''}`}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleFileDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className={styles.uploadIcon}>📄</div>
                            <span className={styles.uploadLabel}>
                                Drag and drop .txt files here, or click to browse
                            </span>
                            <span className={styles.uploadBrowseBtn}>Browse files</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt"
                                multiple
                                className={styles.hiddenInput}
                                onChange={handleFileSelect}
                            />
                        </div>

                        {/* Paste toggle */}
                        <div className={styles.pasteToggle}>
                            <button
                                type="button"
                                className={`${styles.pasteToggleBtn} ${pasteMode ? styles.pasteToggleBtnActive : ''}`}
                                onClick={() => setPasteMode(!pasteMode)}
                            >
                                {pasteMode ? 'Hide paste area' : '📋 Paste text instead'}
                            </button>
                        </div>

                        {pasteMode && (
                            <>
                                <textarea
                                    className={styles.pasteArea}
                                    value={pasteText}
                                    onChange={e => setPasteText(e.target.value)}
                                    placeholder="Paste a writing sample here..."
                                />
                                <button
                                    type="button"
                                    className={styles.addPasteBtn}
                                    onClick={handleAddPaste}
                                    disabled={!pasteText.trim()}
                                >
                                    + Add this sample
                                </button>
                            </>
                        )}

                        {/* Sample cards */}
                        {samples.length > 0 && (
                            <div className={styles.sampleList}>
                                {samples.map(sample => (
                                    <div key={sample.id} className={styles.sampleCard}>
                                        <div className={styles.sampleInfo}>
                                            <span className={styles.sampleName}>{sample.label}</span>
                                            <span className={styles.sampleMeta}>{sample.wordCount} words</span>
                                            {sample.wordCount < MIN_WORDS_PER_SAMPLE && (
                                                <span className={styles.sampleWarning}>
                                                    ⚠ Minimum {MIN_WORDS_PER_SAMPLE} words required
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.sampleRemoveBtn}
                                            onClick={() => removeSample(sample.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Analyze button */}
                        <button
                            type="button"
                            className={styles.analyzeBtn}
                            disabled={!canAnalyze}
                            onClick={() => void handleAnalyze()}
                        >
                            {analyzing && <span className={styles.analyzeBtnSpinner} />}
                            {analyzing ? 'Analyzing your voice…' : '🧬 Analyze My Voice'}
                        </button>
                    </>
                )}
            </main>
            <Footer />
        </>
    );
}
