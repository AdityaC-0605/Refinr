import { NextRequest, NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/sanitize';
import {
    buildGrammarIssueId,
    mapLanguageToolIssueType,
    type GrammarIssue,
} from '@/lib/output-checks';
import { MAX_INPUT_CHARACTERS } from '@/lib/config';

interface LanguageToolMatch {
    message?: string;
    shortMessage?: string;
    offset?: number;
    length?: number;
    replacements?: Array<{ value?: string }>;
    rule?: {
        issueType?: string;
    };
}

interface GrammarResponseBody {
    matches: GrammarIssue[];
    unavailable?: boolean;
}

function emptyResponse(unavailable = false): NextResponse<GrammarResponseBody> {
    return NextResponse.json({
        matches: [],
        unavailable,
    });
}

export async function POST(request: NextRequest) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return emptyResponse(true);
    }

    const text = typeof (body as { text?: unknown }).text === 'string'
        ? sanitizeInput((body as { text: string }).text)
        : '';

    if (!text || text.length > MAX_INPUT_CHARACTERS) {
        return emptyResponse(true);
    }

    try {
        const params = new URLSearchParams();
        params.set('text', text);
        params.set('language', 'en-US');

        const response = await fetch('https://api.languagetool.org/v2/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: params.toString(),
            cache: 'no-store',
        });

        if (!response.ok) {
            return emptyResponse(true);
        }

        const payload = await response.json() as { matches?: LanguageToolMatch[] };

        const matches = Array.isArray(payload.matches)
            ? payload.matches
                .filter((match): match is Required<Pick<LanguageToolMatch, 'message' | 'offset' | 'length'>> & LanguageToolMatch => (
                    typeof match.message === 'string' &&
                    typeof match.offset === 'number' &&
                    typeof match.length === 'number'
                ))
                .map(match => {
                    const grammarIssue: GrammarIssue = {
                        id: buildGrammarIssueId({
                            offset: match.offset,
                            length: match.length,
                            message: match.message,
                        }),
                        message: match.message,
                        shortDescription: typeof match.shortMessage === 'string' ? match.shortMessage : '',
                        offset: match.offset,
                        length: match.length,
                        replacements: Array.isArray(match.replacements)
                            ? match.replacements
                                .map(replacement => typeof replacement.value === 'string' ? replacement.value : '')
                                .filter(Boolean)
                                .slice(0, 5)
                            : [],
                        issueType: mapLanguageToolIssueType(match.rule?.issueType),
                    };

                    return grammarIssue;
                })
                .filter(match => match.length > 0)
            : [];

        return NextResponse.json({ matches });
    } catch {
        return emptyResponse(true);
    }
}
