'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import TextEditor from '@/components/TextEditor';
import ToneSelector from '@/components/ToneSelector';
import OutputPanel, { ViewMode } from '@/components/OutputPanel';
import DiffView from '@/components/DiffView';
import ReadabilityScore from '@/components/ReadabilityScore';
import ChangeSummary from '@/components/ChangeSummary';
import EthicsModal from '@/components/EthicsModal';
import { HumanizeSettings } from '@/lib/prompt';
import { validateInput, sanitizeInput } from '@/lib/sanitize';
import styles from './page.module.css';

interface HumanizeResult {
    editedText: string;
    changeSummary: string[];
}

export default function Home() {
    // State
    const [inputText, setInputText] = useState('');
    const [settings, setSettings] = useState<HumanizeSettings>({
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'standard',
        preserveLength: false,
    });
    const [result, setResult] = useState<HumanizeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('output');
    const [originalText, setOriginalText] = useState('');
    const [toolbarOpen, setToolbarOpen] = useState(false);

    const handleHumanize = async () => {
        const clean = sanitizeInput(inputText);
        const validation = validateInput(clean);

        if (!validation.valid) {
            setError(validation.error || 'Invalid input');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        setOriginalText(clean);
        setViewMode('output');

        try {
            const response = await fetch('/api/humanize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: clean, settings }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process text');
            }

            setResult({
                editedText: data.edited_text,
                changeSummary: data.change_summary,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isDisabled = !inputText.trim() || !validateInput(inputText).valid;

    return (
        <div className={styles.page}>
            <Header />
            <EthicsModal />

            <main className={styles.main}>
                {/* Hero */}
                <section className={styles.hero}>
                    <h1 className={styles.heroTitle}>
                        Polish your text into{' '}
                        <span className="gradient-text">natural prose</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Transform stiff AI-generated text into clear, engaging writing.
                        Ethical editing — no detection evasion, ever.
                    </p>
                </section>

                {/* Toolbar - Tone Selector */}
                <div className={styles.toolbar}>
                    <button
                        type="button"
                        className={styles.toolbarToggle}
                        onClick={() => setToolbarOpen(!toolbarOpen)}
                    >
                        {toolbarOpen ? '▲' : '▼'} Settings — {settings.tone} · {settings.intensity} · {settings.vocabLevel}
                    </button>
                    <div className={`${styles.toolbarContent} ${toolbarOpen ? styles.toolbarContentOpen : ''}`}>
                        <ToneSelector
                            settings={settings}
                            onChange={setSettings}
                            onHumanize={handleHumanize}
                            loading={loading}
                            disabled={isDisabled}
                        />
                    </div>
                    {/* Desktop: always show */}
                    <div className={styles.toolbarDesktop}>
                        <ToneSelector
                            settings={settings}
                            onChange={setSettings}
                            onHumanize={handleHumanize}
                            loading={loading}
                            disabled={isDisabled}
                        />
                    </div>
                </div>

                {/* Editor Split Pane */}
                <div className={styles.editorArea}>
                    <div className={styles.inputPane}>
                        <TextEditor
                            value={inputText}
                            onChange={setInputText}
                            disabled={loading}
                        />
                    </div>
                    <div className={styles.outputPane}>
                        <OutputPanel
                            text={result?.editedText || ''}
                            loading={loading}
                            error={error}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            hasResult={!!result}
                            diffContent={
                                result ? (
                                    <DiffView original={originalText} edited={result.editedText} />
                                ) : undefined
                            }
                        />
                    </div>
                </div>

                {/* Bottom Panels: Readability + Change Summary */}
                {result && (
                    <div className={styles.bottomPanels}>
                        <div className={styles.scorePanel}>
                            <div className={styles.scorePanelHeader}>📊 Readability Analysis</div>
                            <ReadabilityScore
                                originalText={originalText}
                                editedText={result.editedText}
                            />
                        </div>
                        <div className={styles.changesPanel}>
                            <ChangeSummary changes={result.changeSummary} />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
