import type { HumanizeSettings, Intensity, RewriteIntent, RewritePreset, Tone, VocabLevel } from './prompt.ts';

export const MIN_INPUT_WORDS = 10;
export const MAX_INPUT_WORDS = 5000;
export const MAX_INPUT_CHARACTERS = 30000;

export const RATE_LIMIT_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export const DEFAULT_HUMANIZE_SETTINGS: HumanizeSettings = {
    tone: 'professional',
    intensity: 'moderate',
    vocabLevel: 'standard',
    rewriteIntent: 'humanize',
    preserveLength: false,
};

export const DEFAULT_REWRITE_PRESET: RewritePreset = 'none';

export const PRESET_RECOMMENDED_SETTINGS: Record<RewritePreset, Pick<HumanizeSettings, 'tone' | 'intensity' | 'vocabLevel' | 'rewriteIntent'>> = {
    none: {
        tone: DEFAULT_HUMANIZE_SETTINGS.tone,
        intensity: DEFAULT_HUMANIZE_SETTINGS.intensity,
        vocabLevel: DEFAULT_HUMANIZE_SETTINGS.vocabLevel,
        rewriteIntent: DEFAULT_HUMANIZE_SETTINGS.rewriteIntent,
    },
    email: {
        tone: 'professional',
        intensity: 'moderate',
        vocabLevel: 'standard',
        rewriteIntent: 'clarify',
    },
    'blog-post': {
        tone: 'friendly',
        intensity: 'thorough',
        vocabLevel: 'standard',
        rewriteIntent: 'humanize',
    },
    essay: {
        tone: 'academic',
        intensity: 'moderate',
        vocabLevel: 'advanced',
        rewriteIntent: 'clarify',
    },
    'linkedin-post': {
        tone: 'professional',
        intensity: 'light',
        vocabLevel: 'standard',
        rewriteIntent: 'persuasive',
    },
};

const VALID_TONES = new Set<Tone>([
    'formal',
    'professional',
    'conversational',
    'friendly',
    'academic',
]);

const VALID_INTENSITIES = new Set<Intensity>([
    'light',
    'moderate',
    'thorough',
]);

const VALID_VOCAB_LEVELS = new Set<VocabLevel>([
    'simplified',
    'standard',
    'advanced',
]);

const VALID_REWRITE_INTENTS = new Set<RewriteIntent>([
    'humanize',
    'clarify',
    'tighten',
    'concise',
    'persuasive',
]);

const VALID_PRESETS = new Set<RewritePreset>([
    'none',
    'email',
    'blog-post',
    'essay',
    'linkedin-post',
]);

export function isValidHumanizeSettings(value: unknown): value is HumanizeSettings {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const settings = value as Partial<HumanizeSettings>;

    return (
        typeof settings.preserveLength === 'boolean' &&
        typeof settings.tone === 'string' &&
        typeof settings.intensity === 'string' &&
        typeof settings.vocabLevel === 'string' &&
        typeof settings.rewriteIntent === 'string' &&
        VALID_TONES.has(settings.tone as Tone) &&
        VALID_INTENSITIES.has(settings.intensity as Intensity) &&
        VALID_VOCAB_LEVELS.has(settings.vocabLevel as VocabLevel) &&
        VALID_REWRITE_INTENTS.has(settings.rewriteIntent as RewriteIntent)
    );
}

export function isValidRewritePreset(value: unknown): value is RewritePreset {
    return typeof value === 'string' && VALID_PRESETS.has(value as RewritePreset);
}
