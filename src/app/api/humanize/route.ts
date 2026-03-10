import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
    buildAlternativeRewriteSystemPrompt,
    buildAlternativeRewriteUserPrompt,
    buildPolishSystemPrompt,
    buildPolishUserPrompt,
    buildSystemPrompt,
    buildUserPrompt,
    HumanizeSettings,
    RewritePreset,
} from '@/lib/prompt';
import {
    DEFAULT_HUMANIZE_SETTINGS,
    DEFAULT_REWRITE_PRESET,
    isValidHumanizeSettings,
    isValidRewritePreset,
} from '@/lib/config';
import { createRateLimiter } from '@/lib/rate-limit';
import { getPublicErrorMessage } from '@/lib/api-errors';
import {
    assessRewriteQuality,
    chooseBetterRewrite,
    getClientIpFromHeaders,
    isRetryableError,
    MODELS_TO_TRY,
    parseHumanizeResponse,
    shouldGenerateAlternativeRewrite,
    shouldRunPolishPassWithSettings,
} from '@/lib/humanize';
import { sanitizeInput, validateInput } from '@/lib/sanitize';

const checkRateLimit = createRateLimiter();

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = getClientIpFromHeaders(request.headers);
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Please try again later.' },
                { status: 429 }
            );
        }

        // Parse body
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body.' },
                { status: 400 }
            );
        }

        const { text, settings, preset } = (body ?? {}) as {
            text?: unknown;
            settings?: unknown;
            preset?: unknown;
        };

        if (typeof text !== 'string' || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'Text is required.' },
                { status: 400 }
            );
        }

        if (settings !== undefined && !isValidHumanizeSettings(settings)) {
            return NextResponse.json(
                { error: 'Invalid settings provided.' },
                { status: 400 }
            );
        }

        if (preset !== undefined && !isValidRewritePreset(preset)) {
            return NextResponse.json(
                { error: 'Invalid preset provided.' },
                { status: 400 }
            );
        }

        const safeSettings: HumanizeSettings = isValidHumanizeSettings(settings)
            ? settings
            : DEFAULT_HUMANIZE_SETTINGS;
        const safePreset: RewritePreset = isValidRewritePreset(preset)
            ? preset
            : DEFAULT_REWRITE_PRESET;

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
        const systemPrompt = buildSystemPrompt(safeSettings, safePreset);
        const userPrompt = buildUserPrompt(cleanText, safePreset, safeSettings);

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

        let parsed = parseHumanizeResponse(responseText, cleanText);
        let assessment = assessRewriteQuality(cleanText, parsed.edited_text, {
            settings: safeSettings,
        });

        if (shouldGenerateAlternativeRewrite(cleanText, parsed.edited_text, safeSettings)) {
            for (const modelName of MODELS_TO_TRY) {
                try {
                    const altResponse = await ai.models.generateContent({
                        model: modelName,
                        contents: buildAlternativeRewriteUserPrompt({
                            originalText: cleanText,
                            firstDraft: parsed.edited_text,
                            issues: assessment.issues.slice(0, 4),
                        }, safePreset, safeSettings),
                        config: {
                            systemInstruction: buildAlternativeRewriteSystemPrompt(safeSettings, safePreset),
                        },
                    });

                    const preferredText = chooseBetterRewrite(
                        cleanText,
                        parsed.edited_text,
                        altResponse.text ?? '',
                        safeSettings
                    );

                    if (preferredText !== parsed.edited_text) {
                        parsed = {
                            edited_text: preferredText,
                            change_summary: parsed.change_summary,
                        };
                        assessment = assessRewriteQuality(cleanText, parsed.edited_text, {
                            settings: safeSettings,
                        });
                    }
                    break;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);

                    if (isRetryableError(msg)) {
                        continue;
                    }

                    break;
                }
            }
        }

        if (shouldRunPolishPassWithSettings(cleanText, parsed.edited_text, safeSettings)) {
            for (const modelName of MODELS_TO_TRY) {
                try {
                    const polishResponse = await ai.models.generateContent({
                        model: modelName,
                        contents: buildPolishUserPrompt({
                            originalText: cleanText,
                            candidateText: parsed.edited_text,
                            issues: assessment.issues.slice(0, 4),
                        }, safeSettings),
                        config: {
                            systemInstruction: buildPolishSystemPrompt(safeSettings, safePreset),
                        },
                    });

                    const preferredText = chooseBetterRewrite(
                        cleanText,
                        parsed.edited_text,
                        polishResponse.text ?? '',
                        safeSettings
                    );

                    if (preferredText !== parsed.edited_text) {
                        parsed = {
                            edited_text: preferredText,
                            change_summary: parsed.change_summary,
                        };
                    }
                    break;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);

                    if (isRetryableError(msg)) {
                        continue;
                    }

                    break;
                }
            }
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
                { error: getPublicErrorMessage(error) },
                { status: 401 }
            );
        }

        if (message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('429')) {
            return NextResponse.json(
                { error: getPublicErrorMessage(error) },
                { status: 429 }
            );
        }

        if (message.includes('503') || message.includes('high demand') || message.includes('Service Unavailable')) {
            return NextResponse.json(
                { error: getPublicErrorMessage(error) },
                { status: 503 }
            );
        }

        return NextResponse.json(
            { error: getPublicErrorMessage(error) },
            { status: 500 }
        );
    }
}
