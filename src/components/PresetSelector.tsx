'use client';

import type { RewritePreset } from '@/lib/prompt';
import styles from './PresetSelector.module.css';

interface PresetSelectorProps {
    preset: RewritePreset;
    onChange: (preset: RewritePreset) => void;
}

const PRESETS: { value: RewritePreset; label: string; note: string }[] = [
    { value: 'none', label: 'None', note: 'Manual control only' },
    { value: 'email', label: 'Email', note: 'Professional and concise' },
    { value: 'blog-post', label: 'Blog Post', note: 'Readable and engaging' },
    { value: 'essay', label: 'Essay', note: 'Structured and analytical' },
    { value: 'linkedin-post', label: 'LinkedIn Post', note: 'Sharp and social-professional' },
];

export default function PresetSelector({ preset, onChange }: PresetSelectorProps) {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.label}>Preset</span>
                <span className={styles.note}>
                    {PRESETS.find(item => item.value === preset)?.note}
                </span>
            </div>
            <div className={styles.grid}>
                {PRESETS.map(option => (
                    <button
                        key={option.value}
                        type="button"
                        className={`${styles.option} ${preset === option.value ? styles.optionActive : ''}`}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
