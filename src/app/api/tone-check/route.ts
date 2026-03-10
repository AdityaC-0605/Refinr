import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { MAX_INPUT_CHARACTERS } from '@/lib/config';
import { createRateLimiter } from '@/lib/rate-limit';
import { getClientIpFromHeaders, isRetryableError, MODELS_TO_TRY } from '@/lib/humanize';
import { sanitizeInput } from '@/lib/sanitize';
import type { ToneCheckFinding } from '@/lib/output-checks';

const checkRateLimit = createRateLimiter();

function stripCodeFences(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

    return match ? match[1].trim() : trimmed;
}

function parseToneCheckResponse(text: string): ToneCheckFinding[] {
    try {
        const parsed = JSON.parse(stripCodeFences(text)) as unknown;

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((item): item is Partial<ToneCheckFinding> => typeof item === 'object' && item !== null)
            .map(item => ({
                sentence: typeof item.sentence === 'string' ? item.sentence.trim() : '',
                reason: typeof item.reason === 'string' ? item.reason.trim() : '',
                severity: item.severity === 'strong' ? 'strong' : item.severity === 'mild' ? 'mild' : null,
            }))
            .filter((item): item is ToneCheckFinding => item.sentence.length > 0 && item.reason.length > 0 && item.severity !== null)
            .slice(0, 24);
    } catch {
        return [];
    }
}

function unavailableResponse() {
    return NextResponse.json({
        inconsistencies: [] as ToneCheckFinding[],
        unavailable: true,
    });
}

export async function POST(request: NextRequest) {
    const ip = getClientIpFromHeaders(request.headers);

    if (!checkRateLimit(ip)) {
        return unavailableResponse();
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return unavailableResponse();
    }

    const { text, targetTone } = (body ?? {}) as {
        text?: unknown;
        targetTone?: unknown;
    };

    const safeText = typeof text === 'string' ? sanitizeInput(text) : '';
    const safeTargetTone = typeof targetTone === 'string' ? targetTone.trim() : '';

    if (!safeText || !safeTargetTone || safeText.length > MAX_INPUT_CHARACTERS) {
        return unavailableResponse();
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        return unavailableResponse();
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analyze the following text for tone consistency. The intended tone is: ${safeTargetTone}.
Return a JSON array of sentences that feel inconsistent with this tone.
Each item must have: sentence (exact text), reason (1 sentence explanation), 
severity (mild or strong).
If all sentences are consistent, return an empty array.
Return raw JSON only — no markdown, no explanation, no code fences.

TEXT:
${safeText}`;

    for (const modelName of MODELS_TO_TRY) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
            });

            const inconsistencies = parseToneCheckResponse(response.text ?? '');

            return NextResponse.json({
                inconsistencies,
                unavailable: false,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            if (isRetryableError(message)) {
                continue;
            }

            return unavailableResponse();
        }
    }

    return unavailableResponse();
}
