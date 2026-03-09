import type { HumanizeSettings, RewritePreset } from './prompt.ts';

export interface HumanizeBenchmarkCase {
    id: string;
    title: string;
    preset: RewritePreset;
    settings: HumanizeSettings;
    originalText: string;
    referenceOutput: string;
    expectedSignals: string[];
    bannedPatterns: RegExp[];
}

const moderateProfessional: HumanizeSettings = {
    tone: 'professional',
    intensity: 'moderate',
    vocabLevel: 'standard',
    rewriteIntent: 'humanize',
    preserveLength: false,
};

export const HUMANIZE_BENCHMARK_CASES: HumanizeBenchmarkCase[] = [
    {
        id: 'corp-filler',
        title: 'Corporate filler cleanup',
        preset: 'none',
        settings: moderateProfessional,
        originalText: 'Additionally, our team is excited to leverage this initiative in order to drive meaningful impact across the organization.',
        referenceOutput: 'Our team is using this initiative to make the work more useful across the organization.',
        expectedSignals: ['initiative', 'organization'],
        bannedPatterns: [/in today['’]s fast-paced world/i, /\bleverage\b/i, /\bmeaningful impact\b/i, /\badditionally\b/i],
    },
    {
        id: 'detail-preservation',
        title: 'Preserve concrete details',
        preset: 'email',
        settings: {
            tone: 'professional',
            intensity: 'moderate',
            vocabLevel: 'standard',
            rewriteIntent: 'clarify',
            preserveLength: true,
        },
        originalText: 'On March 1, 2026, OpenAI shipped GPT-4.1 to the Acme Analytics pilot group and shared notes at https://example.com/release.',
        referenceOutput: 'On March 1, 2026, OpenAI shipped GPT-4.1 to the Acme Analytics pilot group and shared the release notes at https://example.com/release.',
        expectedSignals: ['March 1', '2026', 'OpenAI', 'GPT-4.1', 'Acme Analytics', 'https://example.com/release'],
        bannedPatterns: [/recently/i, /\bthe company\b/i, /\ba new model\b/i],
    },
    {
        id: 'cadence-preservation',
        title: 'Keep punchy cadence',
        preset: 'linkedin-post',
        settings: {
            tone: 'friendly',
            intensity: 'light',
            vocabLevel: 'standard',
            rewriteIntent: 'humanize',
            preserveLength: false,
        },
        originalText: 'We shipped it. Fast. The first version worked, but it felt clunky in the hand. Now it doesn’t.',
        referenceOutput: 'We shipped it. Fast. The first version worked, but it felt clunky in the hand. Now it feels right.',
        expectedSignals: ['We shipped it.', 'Fast.'],
        bannedPatterns: [/in today['’]s fast-paced world/i, /\bit is important to note\b/i],
    },
    {
        id: 'question-structure',
        title: 'Keep question-driven structure',
        preset: 'blog-post',
        settings: {
            tone: 'conversational',
            intensity: 'moderate',
            vocabLevel: 'standard',
            rewriteIntent: 'clarify',
            preserveLength: false,
        },
        originalText: 'What changed? The team stopped treating the onboarding flow like a checklist and started treating it like a conversation.',
        referenceOutput: 'What changed? The team stopped treating onboarding like a checklist and started treating it like a conversation.',
        expectedSignals: ['What changed?'],
        bannedPatterns: [/in conclusion/i, /\bmoreover\b/i],
    },
    {
        id: 'academic-clarity',
        title: 'Academic clarity without flattening',
        preset: 'essay',
        settings: {
            tone: 'academic',
            intensity: 'moderate',
            vocabLevel: 'advanced',
            rewriteIntent: 'clarify',
            preserveLength: true,
        },
        originalText: 'The argument is not that digital archives replace historical judgment; rather, they alter the conditions under which that judgment is exercised.',
        referenceOutput: 'The argument is not that digital archives replace historical judgment; rather, they change the conditions under which that judgment is exercised.',
        expectedSignals: ['digital archives', 'historical judgment'],
        bannedPatterns: [/super simple/i, /\bkids\b/i],
    },
];
