'use client';

import Link from 'next/link';
import PresetSelector from './PresetSelector';
import type { Tone, Intensity, VocabLevel, RewriteIntent, HumanizeSettings, RewritePreset } from '@/lib/prompt';
import styles from './ToneSelector.module.css';

interface ToneSelectorProps {
    preset: RewritePreset;
    settings: HumanizeSettings;
    onPresetChange: (preset: RewritePreset) => void;
    onChange: (settings: HumanizeSettings) => void;
    onHumanize: () => void;
    loading: boolean;
    disabled: boolean;
    voiceDNAAvailable?: boolean;
    voiceDNAActive?: boolean;
    onVoiceDNAToggle?: (active: boolean) => void;
    isLoggedIn?: boolean;
}

const TONES: { value: Tone; label: string; emoji: string }[] = [
    { value: 'formal', label: 'Formal', emoji: '🎩' },
    { value: 'professional', label: 'Professional', emoji: '💼' },
    { value: 'conversational', label: 'Conversational', emoji: '💬' },
    { value: 'friendly', label: 'Friendly', emoji: '😊' },
    { value: 'academic', label: 'Academic', emoji: '🎓' },
];

const INTENSITIES: { value: Intensity; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'thorough', label: 'Thorough' },
];

const VOCAB_LEVELS: { value: VocabLevel; label: string }[] = [
    { value: 'simplified', label: 'Simple' },
    { value: 'standard', label: 'Standard' },
    { value: 'advanced', label: 'Advanced' },
];

const REWRITE_INTENTS: { value: RewriteIntent; label: string }[] = [
    { value: 'humanize', label: 'Humanize' },
    { value: 'clarify', label: 'Clarify' },
    { value: 'tighten', label: 'Tighten' },
    { value: 'concise', label: 'Concise' },
    { value: 'persuasive', label: 'Persuasive' },
];

const TONE_NOTES: Record<Tone, string> = {
    formal: 'Structured, precise, and suitable for official writing or reports.',
    professional: 'Clean, polished phrasing for workplace communication and presentations.',
    conversational: 'Relaxed and natural, like a confident human speaker.',
    friendly: 'Warm, engaging copy with more approachability and softness.',
    academic: 'Measured, scholarly language with analytical restraint.',
};

const INTENSITY_NOTES: Record<Intensity, string> = {
    light: 'Small adjustments that preserve most wording and structure.',
    moderate: 'Balanced editing for stronger rhythm and clearer phrasing.',
    thorough: 'A deeper pass that can reshape structure for much better flow.',
};

const VOCAB_NOTES: Record<VocabLevel, string> = {
    simplified: 'Shorter, clearer wording for broad readability.',
    standard: 'A balanced vocabulary that feels polished without being dense.',
    advanced: 'Richer language for expert, academic, or high-context writing.',
};

const INTENT_NOTES: Record<RewriteIntent, string> = {
    humanize: 'Reduce robotic phrasing and make the draft sound more natural.',
    clarify: 'Improve readability, logic, and flow so the message lands faster.',
    tighten: 'Sharpen the writing by trimming softness and unnecessary drag.',
    concise: 'Compress the draft and remove bulk while keeping the main point intact.',
    persuasive: 'Add conviction and momentum without tipping into hype.',
};

export default function ToneSelector({
    preset,
    settings,
    onPresetChange,
    onChange,
    onHumanize,
    loading,
    disabled,
    voiceDNAAvailable = false,
    voiceDNAActive = false,
    onVoiceDNAToggle,
    isLoggedIn = false,
}: ToneSelectorProps) {
    const update = (partial: Partial<HumanizeSettings>) => {
        onChange({ ...settings, ...partial });
    };

    const selectedTone = TONES.find(t => t.value === settings.tone);
    const controlsDimmed = voiceDNAActive;

    return (
        <div className={styles.container}>
            {/* Voice DNA Toggle */}
            {isLoggedIn && (
                <div className={styles.voiceDnaSection}>
                    {voiceDNAAvailable ? (
                        <div className={styles.voiceDnaRow}>
                            <span className={styles.voiceDnaLabel}>
                                🧬 Voice DNA
                            </span>
                            <input
                                type="checkbox"
                                className={styles.toggle}
                                checked={voiceDNAActive}
                                onChange={e => onVoiceDNAToggle?.(e.target.checked)}
                                aria-label="Toggle Voice DNA mode"
                            />
                        </div>
                    ) : (
                        <Link href="/voice" className={styles.voiceDnaSetupLink}>
                            🧬 Set up Voice DNA →
                        </Link>
                    )}
                    {voiceDNAActive && (
                        <p className={styles.voiceDnaHint}>
                            Voice DNA overrides tone presets — your personal style will be used
                        </p>
                    )}
                </div>
            )}

            <div style={{ opacity: controlsDimmed ? 0.4 : 1, pointerEvents: controlsDimmed ? 'none' : undefined, transition: 'opacity 0.2s' }}>
                <PresetSelector preset={preset} onChange={onPresetChange} />

                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Rewrite intent</span>
                    <p className={styles.sectionInfo}>{INTENT_NOTES[settings.rewriteIntent]}</p>
                    <div className={styles.sliderTrack}>
                        {REWRITE_INTENTS.map(intent => (
                            <button
                                key={intent.value}
                                type="button"
                                className={`${styles.sliderOption} ${settings.rewriteIntent === intent.value ? styles.sliderOptionActive : ''}`}
                                onClick={() => update({ rewriteIntent: intent.value })}
                            >
                                {intent.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tone */}
                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Tone</span>
                    <p className={styles.sectionInfo}>{TONE_NOTES[settings.tone]}</p>
                    <div className={styles.toneGrid}>
                        {TONES.map(t => (
                            <button
                                key={t.value}
                                type="button"
                                className={`${styles.tonePill} ${settings.tone === t.value ? styles.tonePillActive : ''}`}
                                onClick={() => update({ tone: t.value })}
                            >
                                {t.emoji} {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Intensity */}
                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Intensity</span>
                    <p className={styles.sectionInfo}>{INTENSITY_NOTES[settings.intensity]}</p>
                    <div className={styles.sliderTrack}>
                        {INTENSITIES.map(i => (
                            <button
                                key={i.value}
                                type="button"
                                className={`${styles.sliderOption} ${settings.intensity === i.value ? styles.sliderOptionActive : ''}`}
                                onClick={() => update({ intensity: i.value })}
                            >
                                {i.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Vocabulary */}
                <div className={styles.section}>
                    <span className={styles.sectionLabel}>Vocabulary</span>
                    <p className={styles.sectionInfo}>{VOCAB_NOTES[settings.vocabLevel]}</p>
                    <div className={styles.vocabToggle}>
                        {VOCAB_LEVELS.map(v => (
                            <button
                                key={v.value}
                                type="button"
                                className={`${styles.vocabOption} ${settings.vocabLevel === v.value ? styles.vocabOptionActive : ''}`}
                                onClick={() => update({ vocabLevel: v.value })}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preserve Length */}
                <div className={styles.preserveRow}>
                    <span className={styles.preserveLabel}>Preserve length</span>
                    <input
                        type="checkbox"
                        className={styles.toggle}
                        checked={settings.preserveLength}
                        onChange={e => update({ preserveLength: e.target.checked })}
                        aria-label="Preserve text length"
                    />
                </div>

                <div className={styles.previewPanel}>
                    <div className={styles.previewHeader}>
                        <span className={styles.previewEyebrow}>Current direction</span>
                        <span className={styles.previewBadge}>
                            {selectedTone?.emoji} {selectedTone?.label}
                        </span>
                    </div>
                    <p className={styles.previewText}>
                        {INTENT_NOTES[settings.rewriteIntent]} {INTENSITY_NOTES[settings.intensity]} {VOCAB_NOTES[settings.vocabLevel]}
                    </p>
                    <div className={styles.previewMeta}>
                        <span>{preset === 'none' ? 'No preset' : preset.replace('-', ' ')}</span>
                        <span>{settings.rewriteIntent}</span>
                        <span>{settings.intensity}</span>
                        <span>{settings.vocabLevel}</span>
                        <span>{settings.preserveLength ? 'Length locked' : 'Length flexible'}</span>
                    </div>
                </div>

            </div>

            {/* Humanize Button */}
            <button
                type="button"
                className={styles.humanizeBtn}
                onClick={onHumanize}
                disabled={disabled || loading}
                id="humanize-btn"
            >
                {loading && <span className={styles.loadingSpinner} />}
                {loading ? 'Refining...' : voiceDNAActive ? '🧬 Refine in My Voice' : '✨ Refine Text'}
            </button>
        </div>
    );
}
