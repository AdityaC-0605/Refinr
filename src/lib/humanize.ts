import { calculateReadability } from './readability.ts';
import { countWords } from './sanitize.ts';
import type { HumanizeSettings } from './prompt.ts';

export const MODELS_TO_TRY = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
] as const;

const ACADEMIC_DISCLOSURE_NOTE =
    'This appears to be academic writing. Follow your institution\'s AI disclosure policy before submitting it.';

export interface ParsedHumanizeResponse {
    edited_text: string;
    change_summary: string[];
}

export interface ChangeExplanation {
    original: string;
    revised: string;
    reason: string;
}

export interface RewriteQualityAssessment {
    score: number;
    issues: string[];
}

interface RewriteAssessmentOptions {
    settings?: HumanizeSettings;
}

const AI_CLICHE_PATTERNS = [
    /in today['’]s fast-paced world/gi,
    /\bit is important to note\b/gi,
    /\bwe are excited to\b/gi,
    /\bdelve\b/gi,
    /\btapestry\b/gi,
    /\bleverage\b/gi,
    /\bmoreover\b/gi,
    /\bfurthermore\b/gi,
    /\bembark on\b/gi,
    /\bunlock\b/gi,
    /\belevate\b/gi,
] as const;

const WEAK_TRANSITION_PATTERN = /\b(additionally|moreover|furthermore|therefore|overall|in conclusion)\b/gi;
const YEAR_OR_NUMBER_PATTERN = /\b\d[\d,]*(?:\.\d+)?%?\b/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+\b/gi;
const ACRONYM_PATTERN = /\b[A-Z]{2,}(?:[-/][A-Z0-9]{2,})*\b/g;
const QUOTED_PHRASE_PATTERN = /[“"]([^”"\n]{3,80})[”"]/g;
const CAMEL_CASE_PATTERN = /\b[A-Z][a-z]+[A-Z][A-Za-z0-9]+\b/g;
const COMMON_CAPITALIZED_WORDS = new Set([
    'A', 'An', 'And', 'As', 'At', 'But', 'By', 'For', 'From', 'He', 'Her', 'His', 'I', 'If', 'In',
    'It', 'Its', 'My', 'Of', 'On', 'Or', 'Our', 'She', 'That', 'The', 'Their', 'There', 'These',
    'They', 'This', 'Those', 'To', 'We', 'With', 'You', 'Your',
]);

function stripFencedBlock(text: string): string {
    const fenceMatch = text.match(/^```(?:\w+)?\s*\n?([\s\S]*?)\n?```$/);
    return fenceMatch ? fenceMatch[1].trim() : text.trim();
}

function stripLeadingRewriteLabel(text: string): string {
    const labelPatterns = [
        /^(?:edited|rewritten|revised|refined)\s+(?:text|version|draft)?\s*:\s*/i,
        /^here(?:'|’)s\s+(?:a\s+)?(?:refined|rewritten|revised|edited)\s+(?:version|draft)\s*:\s*/i,
        /^here\s+is\s+(?:a\s+)?(?:refined|rewritten|revised|edited)\s+(?:version|draft)\s*:\s*/i,
        /^output\s*:\s*/i,
        /^final\s+(?:version|draft)\s*:\s*/i,
    ];

    let cleaned = text.trim();

    for (const pattern of labelPatterns) {
        cleaned = cleaned.replace(pattern, '').trim();
    }

    return cleaned;
}

function stripTrailingSummarySection(text: string): string {
    return text
        .replace(/\n{2,}(?:change summary|summary|notes?)\s*:\s*[\s\S]*$/i, '')
        .trim();
}

function stripWrappingQuotes(text: string): string {
    const trimmed = text.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
        (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    ) {
        return trimmed.slice(1, -1).trim();
    }

    return trimmed;
}

export function cleanModelEditedText(text: string): string {
    const withoutFence = stripFencedBlock(text);
    const withoutLabel = stripLeadingRewriteLabel(withoutFence);
    const withoutSummary = stripTrailingSummarySection(withoutLabel);
    const withoutQuotes = stripWrappingQuotes(withoutSummary);

    return withoutQuotes
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function normalizeWords(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2);
}

function countDistinctOverlap(originalWords: string[], editedWords: string[]): number {
    const originalSet = new Set(originalWords);
    const editedSet = new Set(editedWords);
    let overlap = 0;

    for (const word of editedSet) {
        if (originalSet.has(word)) {
            overlap += 1;
        }
    }

    return overlap;
}

function getSentenceStarts(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(Boolean)
        .map(sentence => {
            const [firstWord = ''] = sentence.toLowerCase().replace(/^[^a-z0-9]+/i, '').split(/\s+/);
            return firstWord;
        })
        .filter(Boolean);
}

function hasRepeatedSentenceStarts(text: string): boolean {
    const starts = getSentenceStarts(text);

    for (let index = 1; index < starts.length; index += 1) {
        if (starts[index] === starts[index - 1]) {
            return true;
        }
    }

    return false;
}

function countPatternMatches(text: string, pattern: RegExp): number {
    return text.match(pattern)?.length ?? 0;
}

function extractConcreteDetails(text: string): string[] {
    const details = new Set<string>();

    const addMatches = (pattern: RegExp, maxItems = 8) => {
        const matches = text.match(pattern) ?? [];
        matches.slice(0, maxItems).forEach(match => details.add(match.trim()));
    };

    addMatches(YEAR_OR_NUMBER_PATTERN);
    addMatches(URL_PATTERN, 4);
    addMatches(ACRONYM_PATTERN, 6);
    addMatches(CAMEL_CASE_PATTERN, 6);

    const quotedMatches = text.match(QUOTED_PHRASE_PATTERN) ?? [];
    quotedMatches.slice(0, 4).forEach(match => {
        const cleaned = match.replace(/^[“"]|[”"]$/g, '').trim();
        if (cleaned.length >= 3) {
            details.add(cleaned);
        }
    });

    const capitalizedPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
    capitalizedPhrases.forEach(phrase => {
        if (phrase.includes(' ') && !COMMON_CAPITALIZED_WORDS.has(phrase)) {
            details.add(phrase.trim());
        }
    });

    return [...details].slice(0, 8);
}

export function assessRewriteQuality(
    originalText: string,
    editedText: string,
    options: RewriteAssessmentOptions = {}
): RewriteQualityAssessment {
    const cleanedEditedText = cleanModelEditedText(editedText);
    const cleanedOriginalText = cleanModelEditedText(originalText);
    const issues: string[] = [];
    let score = 100;
    const settings = options.settings;

    const originalWords = normalizeWords(cleanedOriginalText);
    const editedWords = normalizeWords(cleanedEditedText);
    const concreteDetails = extractConcreteDetails(cleanedOriginalText);
    const overlap = countDistinctOverlap(originalWords, editedWords);
    const overlapRatio = editedWords.length > 0 ? overlap / new Set(editedWords).size : 1;

    if (cleanedEditedText.length === 0) {
        return {
            score: 0,
            issues: ['The rewrite came back empty or unusably short.'],
        };
    }

    if (cleanedEditedText === cleanedOriginalText) {
        const penalty = settings?.intensity === 'light' ? 18 : settings?.intensity === 'moderate' ? 45 : 58;
        score -= penalty;
        if (settings?.intensity === 'light') {
            issues.push('The rewrite is almost identical to the original. Make a few more meaningful edits while keeping the light touch.');
        } else {
            issues.push('The rewrite stayed almost identical to the original and needs a more meaningful pass.');
        }
    } else if (overlapRatio > 0.92 && originalWords.length >= 35) {
        const penalty = settings?.intensity === 'light' ? 6 : settings?.intensity === 'moderate' ? 18 : 26;
        score -= penalty;
        issues.push(
            settings?.intensity === 'thorough'
                ? 'The rewrite still hugs the original wording too closely for a thorough pass.'
                : 'The rewrite still hugs the original wording too closely in several places.'
        );
    }

    const clicheCount = AI_CLICHE_PATTERNS.reduce(
        (total, pattern) => total + countPatternMatches(cleanedEditedText, pattern),
        0
    );
    if (clicheCount > 0) {
        score -= Math.min(24, clicheCount * 8);
        issues.push('Replace generic AI-sounding phrases with more grounded, specific wording.');
    }

    const missingConcreteDetails = concreteDetails.filter(detail => !cleanedEditedText.includes(detail));
    if (missingConcreteDetails.length > 0) {
        score -= Math.min(24, missingConcreteDetails.length * 8);
        issues.push(`Preserve important concrete details from the original, including ${missingConcreteDetails.slice(0, 3).join(', ')}.`);
    }

    const originalParagraphCount = cleanedOriginalText.split(/\n\s*\n/).filter(Boolean).length;
    const editedParagraphCount = cleanedEditedText.split(/\n\s*\n/).filter(Boolean).length;
    if (originalParagraphCount >= 2 && editedParagraphCount === 1) {
        score -= 8;
        issues.push('Keep the paragraph structure instead of collapsing the draft into one block.');
    }

    const originalQuestionCount = countPatternMatches(cleanedOriginalText, /\?/g);
    const editedQuestionCount = countPatternMatches(cleanedEditedText, /\?/g);
    if (originalQuestionCount > 0 && editedQuestionCount === 0) {
        score -= 6;
        issues.push('Keep direct questions when they matter to the tone or structure of the original.');
    }

    const transitionCount = countPatternMatches(cleanedEditedText, WEAK_TRANSITION_PATTERN);
    if (transitionCount >= 2) {
        score -= 8;
        issues.push('Smooth out formulaic transitions so the draft moves more naturally between ideas.');
    }

    if (hasRepeatedSentenceStarts(cleanedEditedText)) {
        score -= 8;
        issues.push('Vary consecutive sentence openings to improve rhythm.');
    }

    const originalReadability = calculateReadability(cleanedOriginalText);
    const editedReadability = calculateReadability(cleanedEditedText);
    if (
        cleanedOriginalText.length > 120 &&
        editedReadability.fleschKincaid < originalReadability.fleschKincaid - 6
    ) {
        score -= 10;
        issues.push('The rewrite became denser than necessary and could be made clearer without losing sophistication.');
    }

    const editedWordCount = countWords(cleanedEditedText);
    const originalWordCount = countWords(cleanedOriginalText);
    const lengthRatio = originalWordCount > 0 ? editedWordCount / originalWordCount : 1;
    if (originalWordCount > 0 && editedWordCount > originalWordCount * 1.45) {
        score -= 10;
        issues.push('Trim expansion that adds bulk without adding meaning.');
    }

    if (settings?.preserveLength && originalWordCount > 0) {
        if (lengthRatio > 1.18 || lengthRatio < 0.82) {
            score -= 14;
            issues.push('Stay closer to the original length because preserve-length mode is enabled.');
        }
    } else if (settings?.intensity === 'light') {
        if (lengthRatio > 1.25 || lengthRatio < 0.78) {
            score -= 10;
            issues.push('Keep a lighter touch instead of changing the length this much.');
        }
    }

    if (settings?.vocabLevel === 'simplified') {
        if (editedReadability.fleschKincaid < originalReadability.fleschKincaid - 3) {
            score -= 12;
            issues.push('Use simpler, more accessible wording to match the simplified vocabulary setting.');
        }
    }

    if (settings?.vocabLevel === 'advanced') {
        if (editedReadability.fleschKincaid > originalReadability.fleschKincaid + 8) {
            score -= 8;
            issues.push('The rewrite became too plain for the advanced vocabulary setting.');
        }
    }

    if (settings?.rewriteIntent === 'clarify') {
        if (editedReadability.fleschKincaid < originalReadability.fleschKincaid - 2) {
            score -= 12;
            issues.push('Clarify mode should make the draft easier to follow, not denser.');
        }
    }

    if (settings?.rewriteIntent === 'tighten') {
        if (lengthRatio > 1.06) {
            score -= 14;
            issues.push('Tighten mode should cut drag instead of expanding the draft.');
        }

        if (overlapRatio > 0.9 && originalWords.length >= 30) {
            score -= 8;
            issues.push('Tighten mode should make firmer line edits instead of staying this close to the source wording.');
        }
    }

    if (settings?.rewriteIntent === 'concise') {
        if (lengthRatio > 0.96) {
            score -= 18;
            issues.push('Concise mode should deliver a noticeably leaner draft.');
        }

        if (lengthRatio < 0.58) {
            score -= 8;
            issues.push('Concise mode should cut bulk without stripping away too much substance.');
        }
    }

    if (settings?.rewriteIntent === 'persuasive') {
        if (countPatternMatches(cleanedEditedText, /\b(maybe|perhaps|sort of|kind of)\b/gi) >= 2) {
            score -= 8;
            issues.push('Persuasive mode should sound more confident and decisive.');
        }
    }

    if (issues.length === 0) {
        issues.push('Keep the strongest parts of the draft and make only small rhythm and clarity adjustments.');
    }

    return {
        score: Math.max(0, Math.min(100, score)),
        issues,
    };
}

export function shouldRunPolishPass(originalText: string, editedText: string): boolean {
    return assessRewriteQuality(originalText, editedText).score < 78;
}

export function shouldRunPolishPassWithSettings(
    originalText: string,
    editedText: string,
    settings: HumanizeSettings
): boolean {
    const baseThreshold = settings.intensity === 'light' ? 72 : settings.intensity === 'moderate' ? 78 : 82;
    const intentAdjustment = settings.rewriteIntent === 'humanize'
        ? 0
        : settings.rewriteIntent === 'persuasive'
            ? 2
            : 4;
    const threshold = baseThreshold + intentAdjustment;
    return assessRewriteQuality(originalText, editedText, { settings }).score < threshold;
}

export function shouldGenerateAlternativeRewrite(
    originalText: string,
    editedText: string,
    settings: HumanizeSettings
): boolean {
    const score = assessRewriteQuality(originalText, editedText, { settings }).score;
    const intentAdjustment = settings.rewriteIntent === 'humanize'
        ? 0
        : settings.rewriteIntent === 'persuasive'
            ? 2
            : 4;

    if (settings.intensity === 'thorough') {
        return score < 95 + intentAdjustment;
    }

    if (settings.intensity === 'moderate') {
        return score < 84 + intentAdjustment;
    }

    return score < 76 + intentAdjustment;
}

export function chooseBetterRewrite(
    originalText: string,
    currentText: string,
    candidateText: string,
    settings?: HumanizeSettings
): string {
    const currentAssessment = assessRewriteQuality(originalText, currentText, { settings });
    const candidateAssessment = assessRewriteQuality(originalText, candidateText, { settings });

    if (candidateAssessment.score > currentAssessment.score + 4) {
        return cleanModelEditedText(candidateText);
    }

    return cleanModelEditedText(currentText);
}

export function isRetryableError(msg: string): boolean {
    return (
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('404') ||
        msg.toLowerCase().includes('quota') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('Service Unavailable') ||
        msg.includes('high demand') ||
        msg.includes('not found') ||
        msg.includes('not supported')
    );
}

export function getClientIpFromHeaders(headers: Headers): string {
    const forwardedFor = headers.get('x-forwarded-for');
    if (forwardedFor) {
        const firstIp = forwardedFor
            .split(',')
            .map(value => value.trim())
            .find(Boolean);

        if (firstIp) {
            return firstIp;
        }
    }

    const realIp = headers.get('x-real-ip')?.trim();
    if (realIp) {
        return realIp;
    }

    return 'anonymous';
}

export function looksLikeAcademicText(text: string): boolean {
    const normalized = text.toLowerCase();

    const academicSignals = [
        'abstract',
        'introduction',
        'methodology',
        'conclusion',
        'references',
        'citation',
        'thesis',
        'dissertation',
        'research paper',
        'literature review',
        'works cited',
    ];

    return academicSignals.some(signal => normalized.includes(signal));
}

export function normalizeChangeSummary(
    changeSummary: unknown,
    originalText: string
): string[] {
    const items = Array.isArray(changeSummary)
        ? changeSummary
        : typeof changeSummary === 'string'
            ? [changeSummary]
            : [];

    const normalized = items
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 6);

    if (normalized.length === 0) {
        normalized.push('Text was edited for improved readability and natural flow.');
    }

    if (looksLikeAcademicText(originalText)) {
        const alreadyIncluded = normalized.some(item =>
            item.toLowerCase().includes('disclosure policy')
        );

        if (!alreadyIncluded) {
            normalized.push(ACADEMIC_DISCLOSURE_NOTE);
        }
    }

    return normalized;
}

export function parseHumanizeResponse(
    responseText: string,
    originalText: string
): ParsedHumanizeResponse {
    try {
        const parsed = JSON.parse(stripFencedBlock(responseText)) as Partial<ParsedHumanizeResponse>;

        if (typeof parsed.edited_text !== 'string' || parsed.edited_text.trim().length === 0) {
            throw new Error('Missing edited_text in response');
        }

        return {
            edited_text: cleanModelEditedText(parsed.edited_text),
            change_summary: normalizeChangeSummary(parsed.change_summary, originalText),
        };
    } catch {
        return {
            edited_text: cleanModelEditedText(responseText),
            change_summary: normalizeChangeSummary([], originalText),
        };
    }
}

export function parseExplanationResponse(responseText: string): ChangeExplanation[] {
    try {
        const parsed = JSON.parse(stripFencedBlock(responseText)) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((item): item is Partial<ChangeExplanation> => typeof item === 'object' && item !== null)
            .map(item => ({
                original: typeof item.original === 'string' ? item.original.trim() : '',
                revised: typeof item.revised === 'string' ? item.revised.trim() : '',
                reason: typeof item.reason === 'string' ? item.reason.trim() : '',
            }))
            .filter(item => item.original.length > 0 && item.revised.length > 0 && item.reason.length > 0)
            .slice(0, 24);
    } catch {
        return [];
    }
}

export function getStreamTextDelta(nextText: string, currentText: string): string {
    if (!nextText) {
        return '';
    }

    if (currentText && nextText.startsWith(currentText)) {
        return nextText.slice(currentText.length);
    }

    return nextText;
}

export function generateChangeSummary(originalText: string, editedText: string): string[] {
    const originalWords = countWords(originalText);
    const editedWords = countWords(editedText);
    const originalReadability = calculateReadability(originalText);
    const editedReadability = calculateReadability(editedText);

    const changes: string[] = [
        'Adjusted sentence structure and transitions for a more natural reading rhythm.',
    ];

    const wordDelta = editedWords - originalWords;
    if (wordDelta <= Math.round(originalWords * -0.08)) {
        changes.push('Trimmed repetition and filler to tighten the overall draft.');
    } else if (wordDelta >= Math.round(originalWords * 0.08)) {
        changes.push('Expanded a few passages to make the meaning clearer and smoother.');
    } else {
        changes.push('Kept the overall length close to the original while refining the phrasing.');
    }

    const readabilityDelta = editedReadability.fleschKincaid - originalReadability.fleschKincaid;
    if (readabilityDelta >= 3) {
        changes.push('Improved readability with clearer phrasing and easier transitions between ideas.');
    } else if (readabilityDelta <= -3) {
        changes.push('Shifted the language toward a denser or more formal register to match the chosen style.');
    } else {
        changes.push('Refined word choice to better align with the selected tone and vocabulary level.');
    }

    return normalizeChangeSummary(changes, originalText);
}
