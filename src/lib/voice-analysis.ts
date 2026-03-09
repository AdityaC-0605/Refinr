/**
 * Voice DNA — Statistical analysis of writing samples
 * All metrics are computed in pure TypeScript without AI
 */

import type { VoiceDNAStatistical, VoiceDNAQualitative, PunctuationStyleVector } from './voice-types.ts';

/* ─── Sentence / Paragraph Splitting ─── */

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z"'"\u201C])/;
const PARAGRAPH_BOUNDARY = /\n\s*\n/;

function splitSentences(text: string): string[] {
    return text
        .split(SENTENCE_BOUNDARY)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function splitParagraphs(text: string): string[] {
    return text
        .split(PARAGRAPH_BOUNDARY)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

function getWords(text: string): string[] {
    return text
        .split(/\s+/)
        .map(w => w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ''))
        .filter(w => w.length > 0);
}

/* ─── Syllable Counter ─── */

function countSyllables(word: string): number {
    const lower = word.toLowerCase().replace(/[^a-z]/g, '');

    if (lower.length <= 2) {
        return 1;
    }

    let count = 0;
    let prevVowel = false;

    for (let i = 0; i < lower.length; i++) {
        const isVowel = 'aeiouy'.includes(lower[i]);

        if (isVowel && !prevVowel) {
            count++;
        }

        prevVowel = isVowel;
    }

    // Trailing silent e
    if (lower.endsWith('e') && count > 1) {
        count--;
    }

    // Trailing silent es/ed adjustments
    if ((lower.endsWith('es') || lower.endsWith('ed')) && count > 1) {
        // Keep count as-is — already decremented
    }

    return Math.max(1, count);
}

/* ─── Passive Voice Detection ─── */

const PASSIVE_PATTERN = /\b(?:is|are|was|were|been|being|be)\s+(?:\w+ly\s+)?(?:\w+ed|written|built|made|done|seen|known|taken|given|found|told|thought|shown|left|held|brought|set|kept|run|put|paid|read|cut|let|sent|met|lost|won|drawn|felt|led|gone|stood|begun|spoken)\b/gi;

function estimatePassiveVoiceRatio(sentences: string[]): number {
    if (sentences.length === 0) {
        return 0;
    }

    let passiveCount = 0;

    for (const sentence of sentences) {
        if (PASSIVE_PATTERN.test(sentence)) {
            passiveCount++;
        }
        // Reset lastIndex for global regex
        PASSIVE_PATTERN.lastIndex = 0;
    }

    return passiveCount / sentences.length;
}

/* ─── Punctuation Style ─── */

function computePunctuationStyle(text: string, totalWords: number): PunctuationStyleVector {
    const per1000 = totalWords > 0 ? 1000 / totalWords : 0;

    const emDashCount = (text.match(/—|--/g) ?? []).length;
    const ellipsisCount = (text.match(/\.{3}|…/g) ?? []).length;
    const semicolonCount = (text.match(/;/g) ?? []).length;
    const colonCount = (text.match(/:/g) ?? []).length;

    return {
        emDash: Math.round(emDashCount * per1000 * 100) / 100,
        ellipsis: Math.round(ellipsisCount * per1000 * 100) / 100,
        semicolon: Math.round(semicolonCount * per1000 * 100) / 100,
        colon: Math.round(colonCount * per1000 * 100) / 100,
    };
}

/* ─── Connectors / Transitions ─── */

const CONNECTOR_PHRASES = [
    'however', 'therefore', 'moreover', 'in addition', 'furthermore',
    'consequently', 'nevertheless', 'nonetheless', 'accordingly',
    'in contrast', 'on the other hand', 'for example', 'for instance',
    'in particular', 'specifically', 'in fact', 'indeed', 'meanwhile',
    'similarly', 'likewise', 'instead', 'otherwise', 'as a result',
    'in other words', 'that said', 'still', 'yet', 'thus', 'hence',
];

function extractTopConnectors(text: string, limit: number): string[] {
    const lower = text.toLowerCase();
    const counts: Record<string, number> = {};

    for (const connector of CONNECTOR_PHRASES) {
        const pattern = new RegExp(`\\b${connector.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = lower.match(pattern);

        if (matches && matches.length > 0) {
            counts[connector] = matches.length;
        }
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([connector]) => connector);
}

/* ─── Sentence Starters ─── */

function extractSentenceStarters(sentences: string[], limit: number): string[] {
    const counts: Record<string, number> = {};

    for (const sentence of sentences) {
        const firstWord = sentence.replace(/^[^a-zA-Z]*/, '').split(/\s+/)[0]?.toLowerCase();

        if (firstWord && firstWord.length > 1) {
            counts[firstWord] = (counts[firstWord] ?? 0) + 1;
        }
    }

    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word]) => word);
}

/* ─── Standard Deviation ─── */

function standardDeviation(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

    return Math.sqrt(variance);
}

/* ─── Main Statistical Extraction ─── */

export function extractStatisticalProfile(combinedText: string): VoiceDNAStatistical {
    const sentences = splitSentences(combinedText);
    const paragraphs = splitParagraphs(combinedText);
    const allWords = getWords(combinedText);
    const totalWords = allWords.length;

    // Sentence length stats
    const sentenceWordCounts = sentences.map(s => getWords(s).length);
    const avgSentenceLength = sentenceWordCounts.length > 0
        ? sentenceWordCounts.reduce((sum, c) => sum + c, 0) / sentenceWordCounts.length
        : 0;
    const sentenceLengthVariance = standardDeviation(sentenceWordCounts);

    // Word length
    const avgWordLength = totalWords > 0
        ? allWords.reduce((sum, w) => sum + w.length, 0) / totalWords
        : 0;

    // Vocabulary richness (TTR)
    const uniqueWords = new Set(allWords.map(w => w.toLowerCase()));
    const vocabularyRichness = totalWords > 0 ? uniqueWords.size / totalWords : 0;

    // Paragraph length (sentences per paragraph)
    const paragraphSentenceCounts = paragraphs.map(p => splitSentences(p).length);
    const avgParagraphLength = paragraphSentenceCounts.length > 0
        ? paragraphSentenceCounts.reduce((sum, c) => sum + c, 0) / paragraphSentenceCounts.length
        : 0;

    // Punctuation
    const punctuationStyle = computePunctuationStyle(combinedText, totalWords);

    // Connectors and starters
    const commonConnectors = extractTopConnectors(combinedText, 10);
    const sentenceStarters = extractSentenceStarters(sentences, 5);

    // Passive voice
    const passiveVoiceRatio = estimatePassiveVoiceRatio(sentences);

    // Question frequency
    const questionCount = sentences.filter(s => s.trim().endsWith('?')).length;
    const questionFrequency = sentences.length > 0 ? (questionCount / sentences.length) * 100 : 0;

    // Syllables
    const totalSyllables = allWords.reduce((sum, w) => sum + countSyllables(w), 0);
    const averageSyllablesPerWord = totalWords > 0 ? totalSyllables / totalWords : 0;

    return {
        avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
        sentenceLengthVariance: Math.round(sentenceLengthVariance * 10) / 10,
        avgWordLength: Math.round(avgWordLength * 10) / 10,
        vocabularyRichness: Math.round(vocabularyRichness * 1000) / 1000,
        avgParagraphLength: Math.round(avgParagraphLength * 10) / 10,
        punctuationStyle,
        commonConnectors,
        sentenceStarters,
        passiveVoiceRatio: Math.round(passiveVoiceRatio * 1000) / 1000,
        questionFrequency: Math.round(questionFrequency * 10) / 10,
        averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
    };
}

/* ─── Prompt Fragment Builder ─── */

export function buildPromptFragment(
    statistical: VoiceDNAStatistical,
    qualitative: VoiceDNAQualitative | null
): string {
    const parts: string[] = [];

    parts.push('Write in the author\'s personal voice with these characteristics:');

    if (qualitative) {
        parts.push(qualitative.toneDescription);
        parts.push(`Their writing is ${qualitative.writingPersonality.join(', ')}.`);

        if (qualitative.distinctiveHabits.length > 0) {
            parts.push(`Typical habits: ${qualitative.distinctiveHabits.join('; ')}.`);
        }

        parts.push(`Sentence rhythm: ${qualitative.rhythmDescription}`);
        parts.push(`Vocabulary: ${qualitative.vocabularyProfile}`);

        if (qualitative.examplePhrases.length > 0) {
            parts.push(`Mirror these example constructions where natural: ${qualitative.examplePhrases.map(p => `"${p}"`).join(', ')}.`);
        }

        if (qualitative.avoidPatterns.length > 0) {
            parts.push(`Avoid: ${qualitative.avoidPatterns.join('; ')}.`);
        }
    }

    // Statistical targets
    parts.push(
        `Statistically, target ~${statistical.avgSentenceLength} words per sentence with ${statistical.sentenceLengthVariance > 8 ? 'high' : 'moderate'} length variation.`
    );
    parts.push(`Vocabulary richness TTR target: ${statistical.vocabularyRichness.toFixed(3)}.`);
    parts.push(
        statistical.passiveVoiceRatio < 0.1
            ? 'Prefer active voice strongly.'
            : 'Passive voice is acceptable occasionally.'
    );

    return parts.join(' ');
}

/* ─── Qualitative Prompt (for Gemini) ─── */

export const QUALITATIVE_EXTRACTION_PROMPT = `Analyze these writing samples and extract the author's unique voice characteristics. Return a JSON object with these exact fields:
{
  "toneDescription": "string (2-3 sentences describing their overall tone)",
  "writingPersonality": ["4-6 single adjectives: e.g. analytical, warm, direct, witty"],
  "distinctiveHabits": ["3-5 specific stylistic habits observed, e.g. 'Often opens paragraphs with a bold claim then qualifies it'"],
  "vocabularyProfile": "string (1-2 sentences on word choice patterns)",
  "rhythmDescription": "string (1-2 sentences on sentence rhythm and flow)",
  "examplePhrases": ["3-5 short phrases or constructions typical of this author — extracted directly from the samples"],
  "avoidPatterns": ["2-3 patterns this author never uses or clearly avoids"]
}
Return raw JSON only. No markdown, no explanation, no code fences.`;

export function parseQualitativeResponse(responseText: string): VoiceDNAQualitative | null {
    try {
        // Strip markdown fences if present
        const cleaned = responseText
            .replace(/^```(?:json)?\s*\n?/i, '')
            .replace(/\n?```\s*$/i, '')
            .trim();

        const parsed = JSON.parse(cleaned) as Record<string, unknown>;

        if (typeof parsed.toneDescription !== 'string') {
            return null;
        }

        return {
            toneDescription: parsed.toneDescription,
            writingPersonality: Array.isArray(parsed.writingPersonality)
                ? (parsed.writingPersonality as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 6)
                : [],
            distinctiveHabits: Array.isArray(parsed.distinctiveHabits)
                ? (parsed.distinctiveHabits as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 5)
                : [],
            vocabularyProfile: typeof parsed.vocabularyProfile === 'string' ? parsed.vocabularyProfile : '',
            rhythmDescription: typeof parsed.rhythmDescription === 'string' ? parsed.rhythmDescription : '',
            examplePhrases: Array.isArray(parsed.examplePhrases)
                ? (parsed.examplePhrases as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 5)
                : [],
            avoidPatterns: Array.isArray(parsed.avoidPatterns)
                ? (parsed.avoidPatterns as unknown[]).filter((v): v is string => typeof v === 'string').slice(0, 3)
                : [],
        };
    } catch {
        return null;
    }
}
