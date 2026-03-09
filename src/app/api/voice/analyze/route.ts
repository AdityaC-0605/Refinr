import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleGenAI } from '@google/genai';
import { getSessionUserFromCookies } from '@/lib/firebase-admin';
import { saveVoiceProfile } from '@/lib/voice-store';
import {
    extractStatisticalProfile,
    buildPromptFragment,
    QUALITATIVE_EXTRACTION_PROMPT,
    parseQualitativeResponse,
} from '@/lib/voice-analysis';
import { countWords } from '@/lib/sanitize';
import { isRetryableError, MODELS_TO_TRY } from '@/lib/humanize';
import type { VoiceDNAProfile, VoiceDNAQualitative } from '@/lib/voice-types';

const MIN_SAMPLES = 2;
const MAX_SAMPLES = 5;
const MIN_WORDS_PER_SAMPLE = 100;

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const user = await getSessionUserFromCookies(cookieStore);

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
        }

        const { samples } = (body ?? {}) as { samples?: unknown };

        if (!Array.isArray(samples) || samples.length < MIN_SAMPLES || samples.length > MAX_SAMPLES) {
            return NextResponse.json(
                { error: `Please provide between ${MIN_SAMPLES} and ${MAX_SAMPLES} writing samples.` },
                { status: 400 }
            );
        }

        const validSamples: string[] = [];
        for (const sample of samples) {
            if (typeof sample !== 'string') {
                return NextResponse.json({ error: 'Each sample must be a string.' }, { status: 400 });
            }

            if (countWords(sample) < MIN_WORDS_PER_SAMPLE) {
                return NextResponse.json(
                    { error: `Each sample must be at least ${MIN_WORDS_PER_SAMPLE} words.` },
                    { status: 400 }
                );
            }

            validSamples.push(sample.trim());
        }

        // ── Pass 1: Statistical extraction ──
        const combinedText = validSamples.join('\n\n');
        const statistical = extractStatisticalProfile(combinedText);
        const totalWordCount = countWords(combinedText);

        // ── Pass 2: Qualitative extraction via Gemini ──
        let qualitative: VoiceDNAQualitative | null = null;

        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey && apiKey !== 'your_gemini_api_key_here') {
            const ai = new GoogleGenAI({ apiKey });
            const userPrompt = `${QUALITATIVE_EXTRACTION_PROMPT}\n\nHere are the writing samples:\n\n${validSamples.map((s, i) => `--- Sample ${i + 1} ---\n${s}`).join('\n\n')}`;

            let attempts = 0;
            const maxAttempts = 2;

            while (attempts < maxAttempts && !qualitative) {
                attempts++;

                for (const modelName of MODELS_TO_TRY) {
                    try {
                        const response = await ai.models.generateContent({
                            model: modelName,
                            contents: userPrompt,
                            config: {
                                systemInstruction: 'You are a writing style analyst. Return raw JSON only.',
                            },
                        });

                        const parsed = parseQualitativeResponse(response.text ?? '');

                        if (parsed) {
                            qualitative = parsed;
                            break;
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);

                        if (isRetryableError(message)) {
                            continue;
                        }

                        break;
                    }
                }
            }
        }

        // ── Build profile ──
        const now = new Date().toISOString();
        const promptFragment = buildPromptFragment(statistical, qualitative);

        const profile: VoiceDNAProfile = {
            userId: user.uid,
            createdAt: now,
            updatedAt: now,
            sampleCount: validSamples.length,
            totalWordCount,
            statistical,
            qualitative,
            promptFragment,
        };

        // Save to Firestore
        await saveVoiceProfile(user.uid, profile);

        return NextResponse.json({ profile });
    } catch (error) {
        console.error('Voice DNA analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze writing samples. Please try again.' },
            { status: 500 }
        );
    }
}
