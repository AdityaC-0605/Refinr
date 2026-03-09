import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { cookies } from 'next/headers';
import {
    buildAlternativeRewriteSystemPrompt,
    buildAlternativeRewriteUserPrompt,
    buildPolishSystemPrompt,
    buildPolishUserPrompt,
    buildStreamingSystemPrompt,
    buildStreamingUserPrompt,
    HumanizeSettings,
    RewritePreset,
} from '@/lib/prompt';
import {
    DEFAULT_HUMANIZE_SETTINGS,
    DEFAULT_REWRITE_PRESET,
    isValidHumanizeSettings,
    isValidRewritePreset,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW_MS,
} from '@/lib/config';
import {
    assessRewriteQuality,
    chooseBetterRewrite,
    cleanModelEditedText,
    generateChangeSummary,
    getClientIpFromHeaders,
    getStreamTextDelta,
    isRetryableError,
    MODELS_TO_TRY,
    shouldGenerateAlternativeRewrite,
    shouldRunPolishPassWithSettings,
    StreamCompletePayload,
} from '@/lib/humanize';
import { sanitizeInput, validateInput } from '@/lib/sanitize';
import { getSessionUserFromCookies } from '@/lib/firebase-admin';
import { loadVoiceProfile } from '@/lib/voice-store';
import { computeVoiceMatchScore } from '@/lib/voice-scoring';
import type { VoiceMatchScore } from '@/lib/voice-types';

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= RATE_LIMIT_REQUESTS) {
        return false;
    }

    entry.count++;
    return true;
}

function createSseMessage(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

    return 'Failed to process your text. Please try again.';
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

        const { text, settings, preset, voiceDNAActive } = (body ?? {}) as {
            text?: unknown;
            settings?: unknown;
            preset?: unknown;
            voiceDNAActive?: unknown;
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

        const cleanText = sanitizeInput(text);
        const validation = validateInput(cleanText);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
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

        const systemPrompt = buildStreamingSystemPrompt(safeSettings, safePreset);
        const userPrompt = buildStreamingUserPrompt(cleanText, safePreset, safeSettings);

        // ── Voice DNA: load profile if active ──
        let voicePromptFragment: string | undefined;
        let voiceDNAUserId: string | undefined;

        if (voiceDNAActive === true) {
            try {
                const cookieStore = await cookies();
                const sessionUser = await getSessionUserFromCookies(cookieStore);

                if (sessionUser) {
                    voiceDNAUserId = sessionUser.uid;
                    const profile = await loadVoiceProfile(sessionUser.uid);

                    if (profile) {
                        voicePromptFragment = profile.promptFragment;
                    }
                }
            } catch {
                // Silent failure — fall back to normal refinement
            }
        }

        const finalSystemPrompt = voicePromptFragment
            ? buildStreamingSystemPrompt(safeSettings, safePreset, voicePromptFragment)
            : systemPrompt;
        const ai = new GoogleGenAI({ apiKey });
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    let streamedText = '';
                    let lastError: unknown = null;

                    for (const modelName of MODELS_TO_TRY) {
                        try {
                            const response = await ai.models.generateContentStream({
                                model: modelName,
                                contents: userPrompt,
                                config: {
                                    systemInstruction: finalSystemPrompt,
                                },
                            });

                            for await (const chunk of response) {
                                const chunkText = chunk.text ?? '';
                                const delta = getStreamTextDelta(chunkText, streamedText);

                                if (!delta) {
                                    continue;
                                }

                                streamedText += delta;
                                controller.enqueue(
                                    encoder.encode(createSseMessage('chunk', { text: delta }))
                                );
                            }

                            if (!streamedText.trim()) {
                                throw new Error('Empty response from model');
                            }

                            lastError = null;
                            console.log(`✓ Successfully streamed model: ${modelName}`);
                            break;
                        } catch (error) {
                            lastError = error;
                            const message = error instanceof Error ? error.message : String(error);

                            if (isRetryableError(message) && streamedText.length === 0) {
                                console.warn(`⚠ Streaming model ${modelName} unavailable: ${message.slice(0, 100)}`);
                                continue;
                            }

                            throw error;
                        }
                    }

                    if (lastError) {
                        throw lastError;
                    }

                    let cleanedEditedText = cleanModelEditedText(streamedText);
                    let assessment = assessRewriteQuality(cleanText, cleanedEditedText, {
                        settings: safeSettings,
                    });

                    if (shouldGenerateAlternativeRewrite(cleanText, cleanedEditedText, safeSettings)) {
                        for (const modelName of MODELS_TO_TRY) {
                            try {
                                const altResponse = await ai.models.generateContent({
                                    model: modelName,
                                    contents: buildAlternativeRewriteUserPrompt({
                                        originalText: cleanText,
                                        firstDraft: cleanedEditedText,
                                        issues: assessment.issues.slice(0, 4),
                                    }, safePreset, safeSettings),
                                    config: {
                                        systemInstruction: buildAlternativeRewriteSystemPrompt(safeSettings, safePreset),
                                    },
                                });

                                const alternativeText = cleanModelEditedText(altResponse.text ?? '');
                                if (!alternativeText) {
                                    continue;
                                }

                                cleanedEditedText = chooseBetterRewrite(
                                    cleanText,
                                    cleanedEditedText,
                                    alternativeText,
                                    safeSettings
                                );
                                assessment = assessRewriteQuality(cleanText, cleanedEditedText, {
                                    settings: safeSettings,
                                });
                                break;
                            } catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                if (isRetryableError(message)) {
                                    continue;
                                }
                                break;
                            }
                        }
                    }

                    if (shouldRunPolishPassWithSettings(cleanText, cleanedEditedText, safeSettings)) {
                        for (const modelName of MODELS_TO_TRY) {
                            try {
                                const polishResponse = await ai.models.generateContent({
                                    model: modelName,
                                    contents: buildPolishUserPrompt({
                                        originalText: cleanText,
                                        candidateText: cleanedEditedText,
                                        issues: assessment.issues.slice(0, 4),
                                    }, safeSettings),
                                    config: {
                                        systemInstruction: buildPolishSystemPrompt(safeSettings, safePreset),
                                    },
                                });

                                const polishedText = cleanModelEditedText(polishResponse.text ?? '');
                                if (!polishedText) {
                                    continue;
                                }

                                const preferredText = chooseBetterRewrite(
                                    cleanText,
                                    cleanedEditedText,
                                    polishedText,
                                    safeSettings
                                );
                                if (preferredText !== cleanedEditedText) {
                                    cleanedEditedText = preferredText;
                                }
                                break;
                            } catch (error) {
                                const message = error instanceof Error ? error.message : String(error);
                                if (isRetryableError(message)) {
                                    continue;
                                }
                                break;
                            }
                        }
                    }

                    const payload: StreamCompletePayload & { voiceMatchScore?: VoiceMatchScore } = {
                        edited_text: cleanedEditedText,
                        change_summary: generateChangeSummary(cleanText, cleanedEditedText),
                    };

                    // ── Voice DNA: compute match score if active ──
                    if (voiceDNAUserId && voicePromptFragment) {
                        try {
                            const profile = await loadVoiceProfile(voiceDNAUserId);

                            if (profile) {
                                payload.voiceMatchScore = computeVoiceMatchScore(cleanedEditedText, profile);
                            }
                        } catch {
                            // Silent failure — omit score
                        }
                    }

                    controller.enqueue(
                        encoder.encode(createSseMessage('complete', payload))
                    );
                    controller.close();
                } catch (error) {
                    console.error('Refinr streaming API error:', error);
                    controller.enqueue(
                        encoder.encode(createSseMessage('error', { error: getPublicErrorMessage(error) }))
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    } catch (error) {
        console.error('Refinr streaming route setup error:', error);

        return NextResponse.json(
            { error: getPublicErrorMessage(error) },
            { status: 500 }
        );
    }
}
