import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
    buildExplanationSystemPrompt,
    buildExplanationUserPrompt,
} from '@/lib/prompt';
import {
    getClientIpFromHeaders,
    isRetryableError,
    MODELS_TO_TRY,
    parseExplanationResponse,
} from '@/lib/humanize';
import { sanitizeInput } from '@/lib/sanitize';
import {
    MAX_INPUT_CHARACTERS,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
} from '@/lib/config';

const explanationRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = explanationRateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        explanationRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_REQUESTS) {
        return false;
    }

    entry.count += 1;
    return true;
}

function getPublicErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
        return 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local';
    }

    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
        return 'All model quotas exhausted. Please wait a few minutes and try again.';
    }

    if (message.includes('503') || message.includes('high demand') || message.includes('Service Unavailable')) {
        return 'All models are currently experiencing high demand. Please try again in a moment.';
    }

    return 'Failed to generate explanations.';
}

export async function POST(request: NextRequest) {
    try {
        const ip = getClientIpFromHeaders(request.headers);

        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body.' },
                { status: 400 }
            );
        }

        const { originalText, revisedText } = (body ?? {}) as {
            originalText?: unknown;
            revisedText?: unknown;
        };

        if (typeof originalText !== 'string' || typeof revisedText !== 'string') {
            return NextResponse.json(
                { error: 'Original and revised text are required.' },
                { status: 400 }
            );
        }

        const safeOriginalText = sanitizeInput(originalText);
        const safeRevisedText = sanitizeInput(revisedText);

        if (
            !safeOriginalText ||
            !safeRevisedText ||
            safeOriginalText.length > MAX_INPUT_CHARACTERS ||
            safeRevisedText.length > MAX_INPUT_CHARACTERS
        ) {
            return NextResponse.json(
                { error: 'Both original and revised text are required and must stay within the input limits.' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return NextResponse.json(
                { error: 'Gemini API key is not configured. Please add your GEMINI_API_KEY to .env.local' },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = buildExplanationSystemPrompt();
        const userPrompt = buildExplanationUserPrompt({
            originalText: safeOriginalText,
            revisedText: safeRevisedText,
        });

        for (const modelName of MODELS_TO_TRY) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: userPrompt,
                    config: {
                        systemInstruction: systemPrompt,
                    },
                });

                const explanationText = response.text ?? '';
                const explanations = parseExplanationResponse(explanationText);

                return NextResponse.json({ explanations });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                if (isRetryableError(message)) {
                    console.warn(`⚠ Explanation model ${modelName} unavailable: ${message.slice(0, 100)}`);
                    continue;
                }

                throw error;
            }
        }

        return NextResponse.json({ explanations: [] });
    } catch (error) {
        console.error('Refinr explanation API error:', error);

        return NextResponse.json(
            { error: getPublicErrorMessage(error) },
            { status: 500 }
        );
    }
}
