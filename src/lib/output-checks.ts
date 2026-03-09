export type GrammarIssueType = 'spelling' | 'grammar' | 'style';

export interface GrammarIssue {
    id: string;
    message: string;
    shortDescription: string;
    offset: number;
    length: number;
    replacements: string[];
    issueType: GrammarIssueType;
}

export interface ToneCheckFinding {
    sentence: string;
    reason: string;
    severity: 'mild' | 'strong';
}

export interface ToneIssue extends ToneCheckFinding {
    id: string;
    offset: number;
    length: number;
}

export interface AnnotatedTextSegment {
    text: string;
    grammarIssueType: GrammarIssueType | null;
    toneSeverity: ToneIssue['severity'] | null;
}

function clampOffset(offset: number, textLength: number): number {
    return Math.max(0, Math.min(offset, textLength));
}

function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

export function mapLanguageToolIssueType(issueType: string | undefined): GrammarIssueType {
    const normalized = (issueType ?? '').toLowerCase();

    if (normalized === 'misspelling' || normalized === 'typographical') {
        return 'spelling';
    }

    if (normalized === 'style' || normalized === 'locale-violation' || normalized === 'duplication') {
        return 'style';
    }

    return 'grammar';
}

export function buildGrammarIssueId(issue: Pick<GrammarIssue, 'offset' | 'length' | 'message'>): string {
    return `${issue.offset}:${issue.length}:${issue.message}`;
}

export function applyGrammarSuggestion(
    text: string,
    issue: Pick<GrammarIssue, 'offset' | 'length'>,
    replacement: string
): string {
    const safeOffset = clampOffset(issue.offset, text.length);
    const safeEnd = clampOffset(issue.offset + issue.length, text.length);

    return `${text.slice(0, safeOffset)}${replacement}${text.slice(safeEnd)}`;
}

export function applyAllGrammarSuggestions(
    text: string,
    issues: Array<Pick<GrammarIssue, 'offset' | 'length' | 'replacements'>>
): string {
    const applicableIssues = issues
        .filter(issue => typeof issue.replacements[0] === 'string' && issue.replacements[0].length > 0)
        .sort((left, right) => right.offset - left.offset);

    return applicableIssues.reduce((nextText, issue) => (
        applyGrammarSuggestion(nextText, issue, issue.replacements[0])
    ), text);
}

export function mapToneFindingsToIssues(
    text: string,
    findings: ToneCheckFinding[]
): ToneIssue[] {
    const usedRanges: Array<{ start: number; end: number }> = [];

    return findings.flatMap((finding, index) => {
        const normalizedSentence = normalizeWhitespace(finding.sentence);

        if (!normalizedSentence) {
            return [];
        }

        let startIndex = -1;
        let searchIndex = 0;

        while (searchIndex < text.length) {
            const candidateIndex = text.indexOf(finding.sentence, searchIndex);

            if (candidateIndex === -1) {
                break;
            }

            const candidateEnd = candidateIndex + finding.sentence.length;
            const overlaps = usedRanges.some(range => candidateIndex < range.end && candidateEnd > range.start);

            if (!overlaps) {
                startIndex = candidateIndex;
                usedRanges.push({ start: candidateIndex, end: candidateEnd });
                break;
            }

            searchIndex = candidateEnd;
        }

        if (startIndex === -1) {
            const normalizedText = normalizeWhitespace(text).toLowerCase();
            const normalizedIndex = normalizedText.indexOf(normalizedSentence.toLowerCase());

            if (normalizedIndex === -1) {
                return [];
            }

            startIndex = text.toLowerCase().indexOf(normalizedSentence.toLowerCase());
            if (startIndex === -1) {
                return [];
            }
        }

        return [{
            ...finding,
            id: `${index}:${startIndex}:${finding.severity}`,
            offset: startIndex,
            length: finding.sentence.length,
        }];
    });
}

export function buildAnnotatedTextSegments(
    text: string,
    grammarIssues: GrammarIssue[],
    toneIssues: ToneIssue[]
): AnnotatedTextSegment[] {
    if (!text) {
        return [];
    }

    const boundaries = new Set<number>([0, text.length]);

    grammarIssues.forEach(issue => {
        boundaries.add(clampOffset(issue.offset, text.length));
        boundaries.add(clampOffset(issue.offset + issue.length, text.length));
    });

    toneIssues.forEach(issue => {
        boundaries.add(clampOffset(issue.offset, text.length));
        boundaries.add(clampOffset(issue.offset + issue.length, text.length));
    });

    const sortedBoundaries = [...boundaries].sort((left, right) => left - right);
    const segments: AnnotatedTextSegment[] = [];

    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const start = sortedBoundaries[index];
        const end = sortedBoundaries[index + 1];

        if (start === end) {
            continue;
        }

        const segmentText = text.slice(start, end);
        const coveringGrammarIssue = grammarIssues.find(issue => start >= issue.offset && end <= issue.offset + issue.length) ?? null;
        const coveringToneIssue = toneIssues.find(issue => start >= issue.offset && end <= issue.offset + issue.length) ?? null;

        segments.push({
            text: segmentText,
            grammarIssueType: coveringGrammarIssue?.issueType ?? null,
            toneSeverity: coveringToneIssue?.severity ?? null,
        });
    }

    return segments;
}
