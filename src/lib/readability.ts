/**
 * Readability scoring utilities
 * Implements Flesch-Kincaid readability calculations
 */

export interface ReadabilityResult {
    fleschKincaid: number;
    gradeLevel: number;
    sentenceCount: number;
    wordCount: number;
    avgWordsPerSentence: number;
    avgSyllablesPerWord: number;
}

function countSyllables(word: string): number {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 2) return 1;

    // Remove trailing silent e
    word = word.replace(/e$/, '');

    // Count vowel groups
    const vowelGroups = word.match(/[aeiouy]+/g);
    const count = vowelGroups ? vowelGroups.length : 1;

    return Math.max(1, count);
}

function splitSentences(text: string): string[] {
    return text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function splitWords(text: string): string[] {
    return text
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z'-]/g, ''))
        .filter(w => w.length > 0);
}

export function calculateReadability(text: string): ReadabilityResult {
    if (!text || text.trim().length === 0) {
        return {
            fleschKincaid: 0,
            gradeLevel: 0,
            sentenceCount: 0,
            wordCount: 0,
            avgWordsPerSentence: 0,
            avgSyllablesPerWord: 0,
        };
    }

    const sentences = splitSentences(text);
    const words = splitWords(text);
    const sentenceCount = Math.max(sentences.length, 1);
    const wordCount = words.length;

    if (wordCount === 0) {
        return {
            fleschKincaid: 0,
            gradeLevel: 0,
            sentenceCount: 0,
            wordCount: 0,
            avgWordsPerSentence: 0,
            avgSyllablesPerWord: 0,
        };
    }

    const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = totalSyllables / wordCount;

    // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
    const fleschKincaid = Math.max(
        0,
        Math.min(
            100,
            206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord
        )
    );

    // Flesch-Kincaid Grade Level: 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
    const gradeLevel = Math.max(
        0,
        0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
    );

    return {
        fleschKincaid: Math.round(fleschKincaid * 10) / 10,
        gradeLevel: Math.round(gradeLevel * 10) / 10,
        sentenceCount,
        wordCount,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    };
}

export function getReadabilityLabel(score: number): string {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
}

export function getReadabilityColor(score: number): string {
    if (score >= 70) return 'var(--accent-emerald)';
    if (score >= 50) return 'var(--accent-amber)';
    return 'var(--accent-rose)';
}
