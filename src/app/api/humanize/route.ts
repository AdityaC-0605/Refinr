import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { buildSystemPrompt, buildUserPrompt, HumanizeSettings } from '@/lib/prompt';
import { sanitizeInput, validateInput } from '@/lib/sanitize';

// Simple in-memory rate limiter for MVP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
        return true;
    }

    if (entry.count >= RATE_LIMIT) {
        return false;
    }

    entry.count++;
    return true;
}

// Models to try in order — each has its own separate free-tier quota
const MODELS_TO_TRY = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
];

// Check if an error is retryable (quota, rate limit, temporary unavailability, or model not found)
function isRetryableError(msg: string): boolean {
    return (
        msg.includes('429') ||
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('404') ||
        msg.includes('quota') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('Service Unavailable') ||
        msg.includes('high demand') ||
        msg.includes('not found') ||
        msg.includes('not supported')
    );
}

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        // Parse body
        const body = await request.json();
        const { text, settings } = body as { text: string; settings: HumanizeSettings };

        if (!text) {
            return NextResponse.json(
                { error: 'Text is required.' },
                { status: 400 }
            );
        }

        // Sanitize and validate
        const cleanText = sanitizeInput(text);
        const validation = validateInput(cleanText);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Check API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_gemini_api_key_here') {
            return NextResponse.json(
                { error: 'Gemini API key is not configured. Please add your GEMINI_API_KEY to .env.local' },
                { status: 500 }
            );
        }

        // Build prompt
        const systemPrompt = buildSystemPrompt(settings);
        const userPrompt = buildUserPrompt(cleanText);

        // Initialize the new Google GenAI SDK
        const ai = new GoogleGenAI({ apiKey });

        // Try models in order until one succeeds
        let responseText = '';
        let lastError: unknown = null;

        for (const modelName of MODELS_TO_TRY) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: userPrompt,
                    config: {
                        systemInstruction: systemPrompt,
                    },
                });

                responseText = response.text ?? '';
                if (!responseText) {
                    throw new Error('Empty response from model');
                }

                lastError = null;
                console.log(`✓ Successfully used model: ${modelName}`);
                break; // success
            } catch (err) {
                lastError = err;
                const msg = err instanceof Error ? err.message : String(err);

                if (isRetryableError(msg)) {
                    console.warn(`⚠ Model ${modelName} unavailable: ${msg.slice(0, 100)}`);
                    continue; // try next model
                }

                // Non-retryable error — stop immediately
                throw err;
            }
        }

        if (lastError) {
            throw lastError; // all models failed
        }

        // Parse the JSON response from Gemini
        let parsed: { edited_text: string; change_summary: string[] };

        try {
            // Try to extract JSON from the response (Gemini sometimes wraps in markdown)
            let jsonStr = responseText;

            // Remove markdown code fences if present
            const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1];
            }

            parsed = JSON.parse(jsonStr.trim());

            if (!parsed.edited_text) {
                throw new Error('Missing edited_text in response');
            }
            if (!Array.isArray(parsed.change_summary)) {
                parsed.change_summary = [parsed.change_summary || 'Text was edited for improved readability'];
            }
        } catch {
            // If JSON parsing fails, use the raw response as the edited text
            parsed = {
                edited_text: responseText,
                change_summary: ['Text was edited for improved readability and natural flow'],
            };
        }

        return NextResponse.json({
            edited_text: parsed.edited_text,
            change_summary: parsed.change_summary,
        });
    } catch (error) {
        console.error('Refinr API error:', error);

        const message = error instanceof Error ? error.message : 'An unexpected error occurred';

        // Check for common Gemini API errors
        if (message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
            return NextResponse.json(
                { error: 'Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local' },
                { status: 401 }
            );
        }

        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
            return NextResponse.json(
                { error: 'All model quotas exhausted. Please wait a few minutes and try again.' },
                { status: 429 }
            );
        }

        if (message.includes('503') || message.includes('high demand') || message.includes('Service Unavailable')) {
            return NextResponse.json(
                { error: 'All models are currently experiencing high demand. Please try again in a moment.' },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to process your text. Please try again.' },
            { status: 500 }
        );
    }
}
