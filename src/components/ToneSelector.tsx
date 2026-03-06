'use client';

import type { Tone, Intensity, VocabLevel, HumanizeSettings } from '@/lib/prompt';
import styles from './ToneSelector.module.css';

interface ToneSelectorProps {
    settings: HumanizeSettings;
    onChange: (settings: HumanizeSettings) => void;
    onHumanize: () => void;
    loading: boolean;
    disabled: boolean;
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

export default function ToneSelector({
    settings,
    onChange,
    onHumanize,
    loading,
    disabled,
}: ToneSelectorProps) {
    const update = (partial: Partial<HumanizeSettings>) => {
        onChange({ ...settings, ...partial });
    };

    return (
        <div className={styles.container}>
            {/* Tone */}
            <div className={styles.section}>
                <span className={styles.sectionLabel}>Tone</span>
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

            {/* Humanize Button */}
            <button
                type="button"
                className={styles.humanizeBtn}
                onClick={onHumanize}
                disabled={disabled || loading}
                id="humanize-btn"
            >
                {loading && <span className={styles.loadingSpinner} />}
                {loading ? 'Refining...' : '✨ Refine Text'}
            </button>
        </div>
    );
}
